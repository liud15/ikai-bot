import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

const COOLDOWN_CLAIM = 15 * 60 * 1000 // 15 minutos
const CLAIM_EXPIRY = 60 * 1000 // 1 minuto para reclamar

// Set de bloqueo para evitar doble-claim simultáneo
const claimingLocks = new Set()

let handler = async (m, { conn, text }) => {
    const user = global.db.data.users[m.sender]
    const chat = global.db.data.chats[m.chat]

    // Inicializar
    if (!chat.gacha) chat.gacha = { claimed: {}, activeRolls: {} }
    if (!chat.gacha.claimed) chat.gacha.claimed = {}

    // Migración: convertir activeRoll (viejo) a activeRolls (nuevo)
    if (chat.gacha.activeRoll && !chat.gacha.activeRolls) {
        chat.gacha.activeRolls = {}
        if (chat.gacha.activeRoll.userId) {
            chat.gacha.activeRolls[chat.gacha.activeRoll.userId] = {
                charId: chat.gacha.activeRoll.charId,
                timestamp: chat.gacha.activeRoll.timestamp
            }
        }
        delete chat.gacha.activeRoll
    }
    if (!chat.gacha.activeRolls) chat.gacha.activeRolls = {}

    // Buscar la tirada activa del usuario que hace claim
    const roll = chat.gacha.activeRolls[m.sender]

    if (!roll) {
        return m.reply('❌ No tienes ninguna tirada activa para reclamar.\nUsa *#rw* primero para hacer una tirada.')
    }

    const now = Date.now()

    // Verificar que no haya expirado
    if (now - roll.timestamp > CLAIM_EXPIRY) {
        delete chat.gacha.activeRolls[m.sender]
        return m.reply('⏰ El tiempo para reclamar ese personaje ha expirado.\nUsa *#rw* para hacer otra tirada.')
    }

    // Bloqueo anti-spam: evitar que el mismo usuario haga claim doble
    const lockKey = `${m.chat}_${m.sender}`
    if (claimingLocks.has(lockKey)) {
        return m.reply('⏳ Tu reclamo anterior aún se está procesando, espera un momento.')
    }
    claimingLocks.add(lockKey)

    try {
        // Cooldown de claim
        if (!user.lastGachaClaim) user.lastGachaClaim = 0
        const diff = now - user.lastGachaClaim
        if (diff < COOLDOWN_CLAIM) {
            const remaining = COOLDOWN_CLAIM - diff
            const mins = Math.floor(remaining / 60000)
            const secs = Math.floor((remaining % 60000) / 1000)
            return m.reply(`⏳ Debes esperar *${mins}m ${secs}s* para reclamar otro personaje.`)
        }

        // Doble verificación: que el personaje no haya sido reclamado entre rw y claim
        if (chat.gacha.claimed[roll.charId]) {
            delete chat.gacha.activeRolls[m.sender]
            return m.reply('❌ Este personaje ya fue reclamado por alguien más antes de que pudieras reclamarlo.\nUsa *#rw* para intentar otra tirada.')
        }

        // Leer datos del personaje
        let characters, char
        try {
            const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
            const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
            characters = JSON.parse(clean)
            char = characters.find(c => String(c.id) === roll.charId)
        } catch (e) {
            console.error('[gacha-claim] Error:', e.message)
            return m.reply(`❌ Error al leer la base de datos de personajes.\n${e.message}`)
        }

        if (!char) {
            delete chat.gacha.activeRolls[m.sender]
            return m.reply('❌ Personaje no encontrado en la base de datos.')
        }

        // Segunda verificación justo antes de escribir (por si alguien reclamó mientras leíamos)
        if (chat.gacha.claimed[roll.charId]) {
            delete chat.gacha.activeRolls[m.sender]
            return m.reply('❌ Este personaje acaba de ser reclamado por alguien más.\nUsa *#rw* para intentar otra tirada.')
        }

        // Mensaje personalizado del claim
        const claimMsg = text ? text.trim() : ''

        // Reclamar
        chat.gacha.claimed[roll.charId] = {
            owner: m.sender,
            claimMsg: claimMsg,
            claimTime: now,
            fav: false
        }

        // Actualizar cooldown y limpiar tirada activa del usuario
        user.lastGachaClaim = now
        delete chat.gacha.activeRolls[m.sender]

        const userName = conn.getName(m.sender) || m.pushName || 'Usuario'

        let response = `
╭─⬣「 ✅ PERSONAJE RECLAMADO 」⬣
│
│ 🎴 *${char.name}*
│ 📺 ${char.source}
│ 💰 Valor: ${char.value}
│ 👤 Reclamado por: *${userName}*
│${claimMsg ? `\n│ 💬 "${claimMsg}"` : ''}
│
╰─⬣ ¡Felicidades! ⬣
    `.trim()

        await conn.reply(m.chat, response, m)
    } finally {
        // SIEMPRE liberar el lock, sin importar si hubo error o return
        claimingLocks.delete(lockKey)
    }
}

handler.help = ['claim [mensaje]']
handler.tags = ['gacha']
handler.command = ['claim', 'reclamar', 'c']
handler.group = true

export default handler
