import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveClaimedChar } from '../src/lib/gacha-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

let handler = async (m, { conn, args }) => {
    const chat = global.db.data.chats[m.chat]
    if (!chat.gacha) chat.gacha = { claimed: {}, activeRolls: {} }
    if (!chat.gacha.claimed) chat.gacha.claimed = {}

    if (!args[0]) {
        return m.reply(`⭐ *Uso:* #fav <ID o nombre del personaje>

*Ejemplo:* #fav 15
*Ejemplo:* #fav Makima

Marca un personaje como tu favorito. Se mostrará destacado en tu harem.
Usa *#unfav* para quitar el favorito.`)
    }

    const charInput = args.join(' ').trim()

    // Leer personajes
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
        characters = JSON.parse(clean)
    } catch (e) {
        return m.reply('❌ Error al leer la base de datos de personajes.')
    }

    // Resolver personaje por ID o nombre
    const result = resolveClaimedChar(chat.gacha.claimed, characters, charInput, m.sender)

    if (!result.char) {
        return m.reply(`❌ No se encontró ningún personaje con "*${charInput}*".`)
    }

    if (!result.owned) {
        return m.reply(`❌ El personaje *${result.char.name}* (ID: ${result.charId}) no está en tu harem.`)
    }

    const charId = result.charId

    // Quitar favorito anterior
    for (const [id, data] of Object.entries(chat.gacha.claimed)) {
        if (data.owner === m.sender && data.fav) {
            chat.gacha.claimed[id].fav = false
        }
    }

    // Marcar nuevo favorito
    chat.gacha.claimed[charId].fav = true

    await conn.reply(m.chat, `⭐ *${result.char.name}* (ID: ${charId}) ahora es tu personaje favorito.`, m)
}

handler.help = ['fav <id o nombre>', 'unfav']
handler.tags = ['gacha']
handler.command = ['fav', 'favorito']
handler.group = true

export default handler
