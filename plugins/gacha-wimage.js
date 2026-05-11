import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveCharacter } from '../src/lib/gacha-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

let handler = async (m, { conn, args }) => {
    if (!args[0]) {
        return m.reply(`🖼️ *Uso:* #wimage <ID o nombre del personaje>

*Ejemplo:* #wimage 15
*Ejemplo:* #wimage Makima

Envía una imagen aleatoria del personaje indicado.`)
    }

    const charInput = args.join(' ').trim()

    // Leer personajes
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
        characters = JSON.parse(clean)
    } catch (e) {
        console.error('[gacha-wimage] Error:', e.message)
        return m.reply('❌ Error al leer la base de datos de personajes.')
    }

    // Resolver personaje por ID o nombre
    const result = resolveCharacter(characters, charInput)

    if (!result.char) {
        return m.reply(`❌ No se encontró ningún personaje con "*${charInput}*".

💡 Intenta con un nombre, apodo o ID.`)
    }

    const char = result.char
    const fuzzyNote = (result.method === 'fuzzy_name' || result.method === 'fuzzy_alias')
        ? `\n│ 🔮 Similitud: ${Math.round(result.similarity * 100)}%`
        : ''

    if (!char.img || !Array.isArray(char.img) || char.img.length === 0) {
        return m.reply(`😕 El personaje *${char.name}* no tiene imágenes disponibles.`)
    }

    // Seleccionar imagen aleatoria
    const randomImg = char.img[Math.floor(Math.random() * char.img.length)]
    const imgIndex = char.img.indexOf(randomImg) + 1

    // Determinar rareza
    const value = parseInt(char.value) || 0
    let rarity
    if (value >= 7000) rarity = '🌟 LEGENDARIO'
    else if (value >= 4000) rarity = '💎 ÉPICO'
    else if (value >= 2000) rarity = '💜 RARO'
    else if (value >= 1000) rarity = '💙 POCO COMÚN'
    else rarity = '💚 COMÚN'

    const caption = `
╭─⬣「 🖼️ IMAGEN DE PERSONAJE 」⬣
│
│ 🎴 *${char.name}*
│ 📺 *Anime:* ${char.source}
│ 🏷️ *Rareza:* ${rarity}
│ 🆔 *ID:* ${char.id}
│ 🖼️ *Imagen ${imgIndex}/${char.img.length}*${fuzzyNote}
│
╰─⬣ ⬣
  `.trim()

    try {
        await conn.sendMessage(m.chat, {
            image: { url: randomImg },
            caption: caption
        }, { quoted: m })
    } catch (e) {
        // Intentar con otra imagen si falla
        try {
            const fallbackImg = char.img.find(img => img !== randomImg) || randomImg
            await conn.sendMessage(m.chat, {
                image: { url: fallbackImg },
                caption: caption
            }, { quoted: m })
        } catch (e2) {
            await conn.reply(m.chat, `❌ No se pudo enviar la imagen de *${char.name}*.\n${caption}`, m)
        }
    }
}

handler.help = ['wimage <id o nombre>', 'charimage <id o nombre>']
handler.tags = ['gacha']
handler.command = ['wimage', 'charimage', 'imagenpj', 'wimagen']

export default handler
