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

    const fullText = args.join(' ')
    let rawTargetUser = m.mentionedJid?.[0] || m.quoted?.sender;
    
    if (!rawTargetUser) {
        let numMatch = fullText.match(/@?([0-9]{7,20})/);
        if (numMatch) {
            rawTargetUser = numMatch[1] + '@s.whatsapp.net';
        }
    }

    if (!args[0] || !rawTargetUser) {
        return m.reply(`🎁 *Uso:* #giftchar <ID o nombre> @usuario\n\n*Ejemplo:* #giftchar 15 @usuario\n*Ejemplo:* #giftchar Makima @usuario\n\nTambién puedes *responder* el mensaje del usuario en lugar de etiquetar.\n\nRegala uno de tus personajes a otro usuario.`)
    }

    // Resolver LID a número de teléfono real usando cache
    const targetUser = `${global.getJidNum(rawTargetUser)}@s.whatsapp.net`

    if (targetUser === m.sender || rawTargetUser === m.sender) {
        return m.reply('❌ No puedes regalarte un personaje a ti mismo.')
    }

    // Determinar el input del personaje: quitar cualquier número de teléfono o etiqueta
    let charInput = fullText.replace(/@?[0-9]{7,20}/g, '').trim()
    if (!charInput) {
        return m.reply('❌ Especifica el ID o nombre del personaje a regalar.')
    }

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
    const char = result.char

    // Transferir personaje
    chat.gacha.claimed[charId].owner = targetUser
    chat.gacha.claimed[charId].claimMsg = ''
    chat.gacha.claimed[charId].fav = false

    const senderName = conn.getName(m.sender) || 'Usuario'
    const receiverName = conn.getName(targetUser) || 'Usuario'

    await conn.sendMessage(m.chat, {
        text: `
╭─⬣「 🎁 REGALO DE HAREM 」⬣
│
│ 👤 @${global.getJidNum(m.sender)} *(${senderName})* le regaló a @${global.getJidNum(targetUser)} *(${receiverName})*:
│ 🎴 *${char.name}* (ID: ${char.id})
│ 📺 ${char.source}
│ 💰 Valor: ${char.value}
│
╰─⬣ ¡Qué generosidad! ⬣
  `.trim(),
        mentions: [`${global.getJidNum(m.sender)}@s.whatsapp.net`, `${global.getJidNum(targetUser)}@s.whatsapp.net`]
    }, { quoted: m })
}

handler.help = ['giftchar <id o nombre> @usuario']
handler.tags = ['gacha']
handler.command = ['giftchar', 'regalarpersonaje', 'regalargacha']
handler.group = true

export default handler
