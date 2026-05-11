import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import FormData from 'form-data'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

async function uploadToCatbox(buffer) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename: 'image.jpg' })

    const response = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: {
            ...form.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://catbox.moe',
            'Referer': 'https://catbox.moe/'
        },
        timeout: 60000
    })

    if (!response.data || !String(response.data).startsWith('http')) throw new Error(response.data || 'Error al subir a Catbox')
    return String(response.data).trim()
}

let handler = async (m, { conn, args }) => {
    const chat = global.db.data.chats[m.chat]

    if (!chat.gacha || !chat.gacha.claimed) {
        return m.reply('❌ No hay datos de gacha en este grupo.')
    }

    if (args.length === 0) {
        return m.reply(`📋 *Uso del comando:*
#subirimagen [ID]

Responde a una imagen con este comando para añadirla a tu personaje y ganar 3,000 coins.
Solo puedes subir imágenes a personajes que pertenezcan a tu harem en este grupo.`)
    }

    const charId = args[0]

    // Verificar si el personaje pertenece al usuario
    const claimData = chat.gacha.claimed[charId]
    if (!claimData || claimData.owner !== m.sender) {
        return m.reply(`❌ Este personaje no existe o no te pertenece (en este grupo). Revisa su ID con *#harem*.`)
    }

    // Obtener imagen
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || q.mediaType || ''

    if (!/image/g.test(mime)) {
        return m.reply('❌ Debes responder a una imagen enviada.')
    }

    await m.react('⏳')

    // Leer characters.json
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        characters = JSON.parse(raw)
    } catch (e) {
        await m.react('❌')
        return m.reply('❌ Error al leer la base de datos de personajes.')
    }

    // Encontrar el personaje y verificar límite
    const charIndex = characters.findIndex(c => String(c.id) === charId)
    if (charIndex === -1) {
        await m.react('❌')
        return m.reply('❌ El personaje no se encuentra en la base de datos global (quizás fue eliminado).')
    }

    const character = characters[charIndex]

    if (character.img && character.img.length >= 10) {
        await m.react('❌')
        return m.reply('❌ Este personaje ya ha alcanzado el límite máximo de 10 imágenes permitidas.')
    }

    let imgBuffer
    try {
        imgBuffer = await q.download?.()
        if (!imgBuffer) throw new Error('No se pudo descargar la imagen.')
    } catch (e) {
        await m.react('❌')
        return m.reply('❌ No se pudo descargar la imagen proporcionada.')
    }

    // Subir imagen a API
    let imgUrl
    try {
        imgUrl = await uploadToCatbox(imgBuffer)
    } catch (e) {
        console.error('Error Catbox SubirImagen:', e)
        await m.react('❌')
        return m.reply('❌ Error al subir la imagen a la nube.')
    }

    if (!character.img) character.img = []
    character.img.push(imgUrl)

    // Guardar characters.json
    try {
        fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters, null, 2), 'utf-8')
    } catch (e) {
        await m.react('❌')
        return m.reply('❌ Error al guardar en la base de datos de personajes.')
    }

    // Dar recompensa de coins
    let user = global.db.data.users[m.sender]
    if (!user) {
        global.db.data.users[m.sender] = { coin: 0 }
        user = global.db.data.users[m.sender]
    }

    // Asegurar que property 'coin' sea numero
    if (typeof user.coin !== 'number') user.coin = 0

    user.coin += 3000

    await m.react('✅')

    const responseMsg = `
╭─⬣「 🖼️ IMAGEN SUBIDA CON ÉXITO 」⬣
│
│ ✨ Has aportado una nueva imagen para 
│ *${character.name}* [ID: ${character.id}]
│
│ 🎁 *Recompensa:* +3,000 Coins 🪙
│ 💰 *Tu saldo actual:* ${user.coin.toLocaleString()} Coins
│
╰─⬣ ¡Gracias por colaborar al gacha!
`.trim()

    await conn.reply(m.chat, responseMsg, m)
}

handler.help = ['subirimagen [ID]']
handler.tags = ['gacha']
handler.command = ['subirimagen', 'addimage', 'subirimg', 'addimg']
handler.group = true

export default handler
