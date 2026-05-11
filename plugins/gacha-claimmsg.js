import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveClaimedChar } from '../src/lib/gacha-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

let handler = async (m, { conn, args, text }) => {
    const chat = global.db.data.chats[m.chat]
    if (!chat.gacha) chat.gacha = { claimed: {}, activeRolls: {} }
    if (!chat.gacha.claimed) chat.gacha.claimed = {}

    if (!args[0] || !text.includes(' ')) {
        return m.reply(`💬 *Uso:* #claimmsg <ID o nombre del personaje> <nuevo mensaje>

*Ejemplo:* #claimmsg 15 Mi waifu favorita ❤️
*Ejemplo:* #claimmsg Makima La mejor waifu

Edita el mensaje de reclamo de uno de tus personajes.`)
    }

    // Leer personajes para búsqueda por nombre
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
        characters = JSON.parse(clean)
    } catch (e) {
        return m.reply('❌ Error al leer la base de datos de personajes.')
    }

    // Intentar resolver: primero como ID puro, luego por nombre
    let charId, charName
    const firstArg = args[0]
    const isNumericId = /^\d+$/.test(firstArg)

    if (isNumericId) {
        // Primer argumento es ID numérico
        charId = firstArg
        charName = firstArg
    } else {
        // Primer argumento podría ser un nombre (puede ser multi-palabra)
        // Intentar encontrar el personaje probando diferentes cantidades de palabras
        let found = null
        for (let wordCount = args.length - 1; wordCount >= 1; wordCount--) {
            const nameGuess = args.slice(0, wordCount).join(' ')
            const result = resolveClaimedChar(chat.gacha.claimed, characters, nameGuess, m.sender)
            if (result.char && result.owned) {
                found = result
                charId = result.charId
                charName = result.char.name
                // El mensaje sería el resto de args despues del nombre
                const newMsg = args.slice(wordCount).join(' ').trim()
                if (newMsg) {
                    chat.gacha.claimed[charId].claimMsg = newMsg
                    await conn.reply(m.chat, `💬 Mensaje de reclamo actualizado para *${charName}* (ID: ${charId}):\n\n"${newMsg}"`, m)
                    return
                }
            }
        }
        if (!found) {
            return m.reply(`❌ No se encontró un personaje tuyo con "*${firstArg}*".

Verifica que el personaje esté en tu harem.`)
        }
        return m.reply('❌ Debes incluir un mensaje después del nombre del personaje.')
    }

    // Flujo con ID numérico
    const newMsg = args.slice(1).join(' ').trim()

    // Verificar propiedad
    const charData = chat.gacha.claimed[charId]
    if (!charData || charData.owner !== m.sender) {
        return m.reply(`❌ El personaje ID *${charId}* no está en tu harem.`)
    }

    // Obtener nombre del personaje
    const char = characters.find(c => String(c.id) === charId)

    // Actualizar mensaje
    chat.gacha.claimed[charId].claimMsg = newMsg

    await conn.reply(m.chat, `💬 Mensaje de reclamo actualizado para *${char?.name || charId}* (ID: ${charId}):\n\n"${newMsg}"`, m)
}

handler.help = ['claimmsg <id o nombre> <mensaje>']
handler.tags = ['gacha']
handler.command = ['claimmsg', 'editmsg', 'editclaim']
handler.group = true

export default handler
