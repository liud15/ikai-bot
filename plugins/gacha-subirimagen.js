import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'
import FormData from 'form-data'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

async function uploadToEvogb(buffer, { author = 'IkaiBot', filename = 'gacha-image.jpg', mimetype = 'image/jpeg' } = {}) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mimetype })
    form.append('urlMode', 'custom_name')
    form.append('author', author)

    const res = await fetch('https://evogb.win/api/upload', {
        method: 'POST',
        headers: form.getHeaders(),
        body: form
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`)
    if (!data?.success || !data?.url || !String(data.url).startsWith('http')) {
        throw new Error('Respuesta invalida de Evogb: ' + JSON.stringify(data))
    }

    return String(data.url).trim()
}

function getImageUrl(args = [], text = '') {
    const fromArgs = args.slice(1).join(' ')
    const raw = fromArgs || String(text || '').split(/\s+/).slice(1).join(' ')
    const match = raw.match(/https?:\/\/\S+/i)
    return match ? match[0].trim() : ''
}

let handler = async (m, { conn, args, text }) => {
    const chat = global.db.data.chats[m.chat]

    if (!chat.gacha || !chat.gacha.claimed) {
        return m.reply('No hay datos de gacha en este grupo.')
    }

    if (args.length === 0) {
        return m.reply(`Uso del comando:
#subirimagen [ID]

Responde a una imagen con este comando para anadirla a tu personaje y ganar 3,000 coins.
Tambien puedes usar: #subirimagen [ID] https://imagen.jpg
Solo puedes subir imagenes a personajes que pertenezcan a tu harem en este grupo.`)
    }

    const charId = args[0]
    const sourceUrl = getImageUrl(args, text)

    const claimData = chat.gacha.claimed[charId]
    if (!claimData || claimData.owner !== m.sender) {
        return m.reply('Este personaje no existe o no te pertenece en este grupo. Revisa su ID con #harem.')
    }

    await m.react('⏳')

    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        characters = JSON.parse(raw)
    } catch (e) {
        await m.react('❌')
        return m.reply('Error al leer la base de datos de personajes.')
    }

    const charIndex = characters.findIndex(c => String(c.id) === charId)
    if (charIndex === -1) {
        await m.react('❌')
        return m.reply('El personaje no se encuentra en la base de datos global.')
    }

    const character = characters[charIndex]

    if (character.img && character.img.length >= 10) {
        await m.react('❌')
        return m.reply('Este personaje ya alcanzo el limite maximo de 10 imagenes permitidas.')
    }

    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || q.mediaType || ''
    let imgBuffer
    let uploadMime = mime || 'image/jpeg'

    try {
        if (sourceUrl) {
            const imageRes = await fetch(sourceUrl)
            if (!imageRes.ok) throw new Error(`No se pudo descargar la URL: HTTP ${imageRes.status}`)
            uploadMime = imageRes.headers.get('content-type') || uploadMime
            if (!/^image\//i.test(uploadMime)) throw new Error('La URL no parece ser una imagen valida.')
            imgBuffer = Buffer.from(await imageRes.arrayBuffer())
        } else {
            if (!/image/g.test(mime)) {
                return m.reply('Debes responder a una imagen enviada o usar: #subirimagen ID https://imagen.jpg')
            }
            imgBuffer = await q.download?.()
            if (!imgBuffer) throw new Error('No se pudo descargar la imagen.')
        }
    } catch (e) {
        await m.react('❌')
        return m.reply('No se pudo obtener la imagen.\n' + (e.message || e))
    }

    let imgUrl
    try {
        imgUrl = await uploadToEvogb(imgBuffer, {
            author: conn.getName?.(m.sender) || 'IkaiBot',
            filename: `${character.name || 'gacha'}-${Date.now()}.jpg`.replace(/[\\/:*?"<>|]+/g, '_'),
            mimetype: uploadMime
        })
    } catch (e) {
        console.error('Error Evogb SubirImagen:', e)
        await m.react('❌')
        return m.reply('Error al subir la imagen a Evogb.\n' + (e.message || e))
    }

    if (!character.img) character.img = []
    character.img.push(imgUrl)

    try {
        fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters, null, 2), 'utf-8')
    } catch (e) {
        await m.react('❌')
        return m.reply('Error al guardar en la base de datos de personajes.')
    }

    let user = global.db.data.users[m.sender]
    if (!user) {
        global.db.data.users[m.sender] = { coin: 0 }
        user = global.db.data.users[m.sender]
    }

    if (typeof user.coin !== 'number') user.coin = 0
    user.coin += 3000

    await m.react('✅')

    const responseMsg = `
Imagen subida con exito

Has aportado una nueva imagen para:
*${character.name}* [ID: ${character.id}]

URL: ${imgUrl}
Recompensa: +3,000 Coins
Tu saldo actual: ${user.coin.toLocaleString()} Coins
`.trim()

    await conn.reply(m.chat, responseMsg, m)
}

handler.help = ['subirimagen [ID]']
handler.tags = ['gacha']
handler.command = ['subirimagen', 'addimage', 'subirimg', 'addimg']
handler.group = true

export default handler
