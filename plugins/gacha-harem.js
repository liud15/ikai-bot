import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

const ITEMS_PER_PAGE = 10

// Normaliza un JID eliminando el sufijo de dispositivo (:XX) sin romper @lid ni @s.whatsapp.net
const stripDevice = (jid = '') => String(jid).replace(/:\d+(?=@)/, '')

let handler = async (m, { conn, args }) => {
    const chat = global.db.data.chats[m.chat]

    if (!chat.gacha) chat.gacha = { claimed: {}, activeRolls: {} }
    if (!chat.gacha.claimed) chat.gacha.claimed = {}

    // Determinar de quién ver el harem (compatible con LID)
    const rawTargetUser = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender
    const targetUser = stripDevice(rawTargetUser)
    const userName = conn.getName(rawTargetUser) || 'Usuario'
    const isSelf = targetUser === stripDevice(m.sender)

    // Leer personajes
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        characters = JSON.parse(raw)
    } catch (e) {
        return m.reply('❌ Error al leer la base de datos de personajes.')
    }

    // Filtrar personajes del usuario en este grupo
    const userChars = []
    for (const [charId, data] of Object.entries(chat.gacha.claimed)) {
        if (data.owner === targetUser) {
            const char = characters.find(c => String(c.id) === charId)
            if (char) {
                userChars.push({ ...char, claimData: data })
            }
        }
    }

    if (userChars.length === 0) {
        return m.reply(isSelf
            ? '📭 No tienes personajes en tu harem de este grupo.\nUsa *#rw* para hacer una tirada.'
            : `📭 *${userName}* no tiene personajes en su harem de este grupo.`)
    }

    // Paginación
    const page = parseInt(args[0]) || 1
    const totalPages = Math.ceil(userChars.length / ITEMS_PER_PAGE)
    const currentPage = Math.min(Math.max(1, page), totalPages)
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    const pageChars = userChars.slice(start, start + ITEMS_PER_PAGE)

    // Calcular valor total
    const totalValue = userChars.reduce((sum, c) => sum + (parseInt(c.value) || 0), 0)

    // Encontrar favorito
    const favChar = userChars.find(c => c.claimData.fav)

    let list = pageChars.map((c, i) => {
        const idx = start + i + 1
        const fav = c.claimData.fav ? ' ⭐' : ''
        const msg = c.claimData.claimMsg ? ` 💬` : ''
        return `│ ${idx}. ${fav}${msg} *${c.name}* — ${c.source} (💰${c.value}) [ID:${c.id}]`
    }).join('\n')

    let txt = `
╭─⬣「 🏰 HAREM DE ${userName.toUpperCase()} 」⬣
│
│ 📊 *Personajes:* ${userChars.length}
│ 💰 *Valor total:* ${totalValue.toLocaleString()}
│${favChar ? ` ⭐ *Favorito:* ${favChar.name}` : ''}
│
│ ─── Página ${currentPage}/${totalPages} ───
│
${list}
│
╰─⬣${totalPages > 1 ? ` Usa #harem ${currentPage < totalPages ? currentPage + 1 : 1} para ver más` : ''} ⬣
  `.trim()

    await conn.reply(m.chat, txt, m)
}

handler.help = ['harem [@usuario] [página]']
handler.tags = ['gacha']
handler.command = ['harem', 'myharem', 'coleccion']
handler.group = true

export default handler
