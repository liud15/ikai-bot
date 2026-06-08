import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

function resolveName(userId, conn) {
    const u = global.db.data.users?.[userId]
    if (u?.name && u.name.trim()) return u.name.trim()
    const fromConn = conn.getName(userId)
    if (fromConn) return fromConn
    if (userId.endsWith('@lid')) {
        const real = global.db.data.lidmap?.[userId]
        if (real) return '+' + real.split('@')[0]
    }
    return userId.split('@')[0]
}

let handler = async (m, { conn }) => {
    const chat = global.db.data.chats[m.chat]
    if (!chat.gacha || !chat.gacha.claimed || Object.keys(chat.gacha.claimed).length === 0) {
        return m.reply('📭 Nadie ha reclamado personajes en este grupo aún.\nUsa *#rw* para empezar.')
    }

    // Leer personajes
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        characters = JSON.parse(raw)
    } catch (e) {
        return m.reply('❌ Error al leer la base de datos de personajes.')
    }

    // Obtener los personajes reclamados en este grupo y sus datos
    let claimedChars = []
    for (const [charId, data] of Object.entries(chat.gacha.claimed)) {
        const char = characters.find(c => String(c.id) === String(charId))
        if (char) {
            claimedChars.push({
                ...char,
                owner: data.owner
            })
        }
    }

    if (claimedChars.length === 0) {
        return m.reply('❌ Error: No se encontraron los datos de los personajes reclamados.')
    }

    // Ordenar por valor (mayor a menor)
    claimedChars.sort((a, b) => (parseInt(b.value) || 0) - (parseInt(a.value) || 0))
    const topChars = claimedChars.slice(0, 15)

    const medals = ['👑', '🥈', '🥉']

    let ranking = topChars.map((char, i) => {
        const ownerName = resolveName(char.owner, conn)
        const medal = medals[i] || `${i + 1}.`
        const value = parseInt(char.value) || 0
        return `│ ${medal} *${char.name}*\n│    💰 Valor: ${value.toLocaleString()} \n│    👤 Dueño: ${ownerName}`
    }).join('\n│\n')

    let txt = `
╭─⬣「 🌟 TOP WAIFUS (Reclamadas) 」⬣
│
│ 🏆 Las waifus más valiosas del grupo
│
│ ─── RANKING ───
│
${ranking}
│
╰─⬣
  `.trim()

    await conn.reply(m.chat, txt, m)
}

handler.help = ['wtop']
handler.tags = ['gacha']
handler.command = ['wtop', 'topwaifus', 'bestwaifus']
handler.group = true

export default handler
