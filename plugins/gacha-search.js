import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { searchCharacters } from '../src/lib/gacha-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

let handler = async (m, { conn, text }) => {
    if (!text || text.trim().length < 2) {
        return m.reply(`🔍 *Uso:* #searchchar <nombre del personaje>

*Ejemplo:* #searchchar Mikasa
*Ejemplo:* #searchchar Zero Two
*Ejemplo:* #searchchar Chainsaw Man

Busca por nombre, apodo, anime/source o similitud (90%).`)
    }

    const query = text.trim()
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

    // Búsqueda con fuzzy matching (90% similitud)
    const results = searchCharacters(characters, query, 0.9, 10)

    if (results.length === 0) {
        return m.reply(`❌ No se encontraron personajes con "*${query}*".

💡 Intenta con otro nombre, apodo o anime.`)
    }

    let list = results.map((r, i) => {
        const c = r.char
        const claimed = chat.gacha.claimed[String(c.id)]
        let status = '🟢 Libre'
        if (claimed) {
            const ownerName = conn.getName(claimed.owner) || 'Usuario'
            status = `🔴 Reclamado por *${ownerName}*`
        }
        const hasImg = c.img && c.img.length > 0 ? '🖼️' : '❌'
        const fuzzyTag = r.method === 'fuzzy' ? ` 🔮${Math.round(r.similarity * 100)}%` : ''
        return `│ ${i + 1}. *${c.name}* [ID:${c.id}]${fuzzyTag}
│    📺 ${c.source} | ${c.gender === 'Mujer' ? '♀️' : c.gender === 'Hombre' ? '♂️' : '⚧️'} | 💰 ${c.value} | ${hasImg}
│    ${status}`
    }).join('\n│\n')

    let txt = `
╭─⬣「 🔍 RESULTADOS DE BÚSQUEDA 」⬣
│
│ Búsqueda: "${query}"
│ Resultados: ${results.length}
│
${list}
│
╰─⬣ Usa #charinfo <ID o nombre> para más detalles ⬣
  `.trim()

    await conn.reply(m.chat, txt, m)
}

handler.help = ['searchchar <nombre>']
handler.tags = ['gacha']
handler.command = ['searchchar', 'buscarchar', 'searchwaifu', 'buscarwaifu', 'buscar']
handler.group = false

export default handler
