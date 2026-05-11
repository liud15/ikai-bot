import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveCharacter, searchCharacters } from '../src/lib/gacha-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

let handler = async (m, { conn, args, text }) => {
    if (!args[0]) {
        return m.reply(`📋 *Uso:* #charinfo <nombre, apodo, anime o ID>

*Ejemplos:*
• #charinfo 15
• #charinfo Makima
• #charinfo Chainsaw Man
• #charinfo Shadow

Busca personajes por nombre, apodo, anime o ID.
También encuentra personajes con errores de escritura (90% similitud).`)
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

    // --- Búsqueda inteligente con fuzzy ---

    // Primero intentar resolución directa (ID exacto, nombre exacto, etc.)
    const direct = resolveCharacter(characters, query)
    if (direct.char) {
        const fuzzyNote = (direct.method === 'fuzzy_name' || direct.method === 'fuzzy_alias')
            ? `\n🔮 Encontrado por similitud: ${Math.round(direct.similarity * 100)}%`
            : ''
        return await sendCharInfo(conn, m, direct.char, chat, fuzzyNote)
    }

    // Si no hay resultado directo, buscar múltiples
    const results = searchCharacters(characters, query, 0.9, 15)

    if (results.length === 0) {
        return m.reply(`❌ No se encontró ningún personaje con: *${query}*

Intenta buscar por nombre, apodo, anime o ID.`)
    }

    // Si hay un solo resultado, mostrar info completa
    if (results.length === 1) {
        const r = results[0]
        const fuzzyNote = r.method === 'fuzzy'
            ? `\n🔮 Encontrado por similitud: ${Math.round(r.similarity * 100)}%`
            : ''
        return await sendCharInfo(conn, m, r.char, chat, fuzzyNote)
    }

    // Si hay pocos resultados (≤ 5), mostrar info del primero + lista
    if (results.length <= 5) {
        const first = results[0]
        const fuzzyNote = first.method === 'fuzzy'
            ? `\n🔮 Encontrado por similitud: ${Math.round(first.similarity * 100)}%`
            : ''
        await sendCharInfo(conn, m, first.char, chat, fuzzyNote)

        if (results.length > 1) {
            let list = `\n📋 *Otros resultados para* "${query}":\n\n`
            for (let i = 1; i < results.length; i++) {
                const r = results[i]
                const tag = r.method === 'fuzzy' ? ` 🔮${Math.round(r.similarity * 100)}%` : ''
                list += `• *${r.char.name}* (ID: ${r.char.id}) — ${r.char.source}${tag}\n`
            }
            list += `\nUsa *#charinfo <ID>* para ver info de otro.`
            await conn.reply(m.chat, list, m)
        }
        return
    }

    // Si hay muchos resultados (> 5), mostrar lista
    const MAX_SHOW = 15
    const showing = results.slice(0, MAX_SHOW)
    let list = `📋 *Se encontraron ${results.length} resultados para* "${query}":\n\n`
    for (const r of showing) {
        const value = parseInt(r.char.value) || 0
        let emoji = '💚'
        if (value >= 7000) emoji = '🌟'
        else if (value >= 4000) emoji = '💎'
        else if (value >= 2000) emoji = '💜'
        else if (value >= 1000) emoji = '💙'

        const claimStatus = chat.gacha.claimed[String(r.char.id)] ? '🔴' : '🟢'
        const tag = r.method === 'fuzzy' ? ` 🔮${Math.round(r.similarity * 100)}%` : ''
        list += `${emoji} *${r.char.name}* (ID: ${r.char.id}) ${claimStatus}${tag}\n   📺 ${r.char.source}\n`
    }
    if (results.length > MAX_SHOW) {
        list += `\n... y ${results.length - MAX_SHOW} más.`
    }
    list += `\n\nUsa *#charinfo <ID>* para ver la info completa de uno.`
    await conn.reply(m.chat, list, m)
}

async function sendCharInfo(conn, m, char, chat, fuzzyNote = '') {
    // Determinar rareza
    const value = parseInt(char.value) || 0
    let rarity
    if (value >= 7000) rarity = '🌟 LEGENDARIO'
    else if (value >= 4000) rarity = '💎 ÉPICO'
    else if (value >= 2000) rarity = '💜 RARO'
    else if (value >= 1000) rarity = '💙 POCO COMÚN'
    else rarity = '💚 COMÚN'

    // Aliases
    const aliases = Array.isArray(char.aliases) ? char.aliases : (typeof char.aliases === 'string' && char.aliases ? [char.aliases] : [])
    const aliasText = aliases.length > 0 ? aliases.join(', ') : 'Ninguno'

    // Estado en este grupo
    const charId = String(char.id)
    const claimed = chat.gacha.claimed[charId]
    let status = '🟢 Libre'
    let ownerInfo = ''
    if (claimed) {
        const ownerName = conn.getName(claimed.owner) || 'Usuario'
        status = '🔴 Reclamado'
        ownerInfo = `│ 👤 *Dueño:* ${ownerName}`
        if (claimed.claimMsg) ownerInfo += `\n│ 💬 "${claimed.claimMsg}"`
        if (claimed.fav) ownerInfo += `\n│ ⭐ Personaje favorito de su dueño`
    }

    const caption = `
╭─⬣「 🎴 INFO DE PERSONAJE 」⬣
│
│ 🆔 *ID:* ${char.id}
│ 🎴 *Nombre:* ${char.name}
│ 📺 *Anime:* ${char.source}
│ ${char.gender === 'Mujer' ? '♀️' : char.gender === 'Hombre' ? '♂️' : '⚧️'} *Género:* ${char.gender}
│ 💰 *Valor:* ${char.value}
│ 🏷️ *Rareza:* ${rarity}
│ 🏷️ *Apodos:* ${aliasText}
│ 📊 *Estado:* ${status}
│ 🗳️ *Votos:* ${char.votes || 0}
${ownerInfo ? ownerInfo + '\n' : ''}│ 🖼️ *Imágenes:* ${char.img?.length || 0}
│ 🎬 *Videos:* ${char.vid?.length || 0}
│${fuzzyNote}
╰─⬣ ⬣
  `.trim()

    // Enviar con imagen si tiene
    if (char.img && char.img.length > 0) {
        const randomImg = char.img[Math.floor(Math.random() * char.img.length)]
        try {
            await conn.sendMessage(m.chat, {
                image: { url: randomImg },
                caption: caption
            }, { quoted: m })
            return
        } catch (e) { }
    }

    await conn.reply(m.chat, caption, m)
}

handler.help = ['charinfo <nombre/apodo/anime/id>']
handler.tags = ['gacha']
handler.command = ['charinfo', 'infochar', 'infopersonaje', 'personaje']

export default handler
