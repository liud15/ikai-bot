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
    if (!chat.gacha) chat.gacha = { claimed: {}, activeRolls: {} }
    if (!chat.gacha.claimed) chat.gacha.claimed = {}

    // Leer personajes
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        characters = JSON.parse(raw)
    } catch (e) {
        return m.reply('❌ Error al leer la base de datos de personajes.')
    }

    // Agrupar personajes por dueño y calcular valor total
    const haremData = {}
    for (const [charId, data] of Object.entries(chat.gacha.claimed)) {
        const owner = data.owner
        if (!haremData[owner]) {
            haremData[owner] = { count: 0, totalValue: 0 }
        }
        const char = characters.find(c => String(c.id) === charId)
        haremData[owner].count++
        haremData[owner].totalValue += parseInt(char?.value) || 0
    }

    if (Object.keys(haremData).length === 0) {
        return m.reply('📭 Nadie ha reclamado personajes en este grupo aún.\nUsa *#rw* para empezar.')
    }

    // Ordenar por valor total (mayor a menor)
    const sorted = Object.entries(haremData)
        .sort(([, a], [, b]) => b.totalValue - a.totalValue)
        .slice(0, 15)

    const medals = ['👑', '🥈', '🥉']

    let ranking = sorted.map(([userId, data], i) => {
        const name = resolveName(userId, conn)
        const medal = medals[i] || `${i + 1}.`
        return `│ ${medal} *${name}*\n│    🎴 ${data.count} personajes — 💰 ${data.totalValue.toLocaleString()}`
    }).join('\n│\n')

    const totalChars = Object.keys(chat.gacha.claimed).length
    const totalAvailable = characters.length

    let txt = `
╭─⬣「 🏆 TOP HAREM DEL GRUPO 」⬣
│
│ 📊 ${totalChars}/${totalAvailable} personajes reclamados
│
│ ─── RANKING ───
│
${ranking}
│
╰─⬣ ¡Sigue coleccionando con #rw! ⬣
  `.trim()

    await conn.reply(m.chat, txt, m)
}

handler.help = ['topharem']
handler.tags = ['gacha']
handler.command = ['topharem', 'topwaifu', 'rankwaifu', 'rankharem']
handler.group = true

export default handler
