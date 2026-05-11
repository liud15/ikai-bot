import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveClaimedChar, resolveCharacter } from '../src/lib/gacha-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

let handler = async (m, { conn, args }) => {
    if (!args[0]) {
        return m.reply(`📋 *Uso:* #release <ID o nombre del personaje> [confirmar]

*Ejemplo:* #release 15
*Ejemplo:* #release Makima
*Ejemplo:* #release Makima confirmar

Libera un personaje de tu harem. ¡Esta acción no se puede deshacer!`)
    }

    const chat = global.db.data.chats[m.chat]
    if (!chat.gacha) chat.gacha = { claimed: {}, activeRolls: {} }
    if (!chat.gacha.claimed) chat.gacha.claimed = {}

    // Leer personajes
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
        characters = JSON.parse(clean)
    } catch (e) {
        return m.reply('❌ Error al leer la base de datos de personajes.')
    }

    // Detectar si "confirmar/confirm" está al final
    const lastArg = args[args.length - 1]?.toLowerCase()
    const hasConfirm = lastArg === 'confirmar' || lastArg === 'confirm'
    const inputArgs = hasConfirm ? args.slice(0, -1) : args
    const charInput = inputArgs.join(' ').trim()

    // Resolver personaje por ID o nombre
    const result = resolveClaimedChar(chat.gacha.claimed, characters, charInput, m.sender)

    if (!result.char) {
        return m.reply(`❌ No se encontró ningún personaje con "*${charInput}*".`)
    }

    if (!result.owned) {
        return m.reply(`❌ El personaje *${result.char.name}* (ID: ${result.charId}) no está en tu harem.`)
    }

    const charId = result.charId
    const char = result.char

    // Si no se confirmó, pedir confirmación
    if (!hasConfirm) {
        return m.reply(`⚠️ ¿Estás seguro de liberar a *${char.name}* (💰${char.value})?

Escribe *#release ${charId} confirmar* para confirmar.
O también: *#release ${char.name} confirmar*`)
    }

    // Liberar
    delete chat.gacha.claimed[charId]

    await conn.reply(m.chat, `
╭─⬣「 🕊️ PERSONAJE LIBERADO 」⬣
│
│ 🎴 *${char.name}* (ID: ${charId})
│ 📺 ${char.source}
│ 💰 Valor: ${char.value}
│
│ El personaje ahora está libre y puede
│ aparecer en futuras tiradas.
│
╰─⬣ ⬣
  `.trim(), m)
}

handler.help = ['release <id o nombre> confirmar']
handler.tags = ['gacha']
handler.command = ['release', 'liberar']
handler.group = true

export default handler
