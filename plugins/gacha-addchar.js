import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'
import FormData from 'form-data'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

// ═══════════════════════════════════════════════════════
//  PIXIV SEARCH → Busca ilustraciones por nombre + source
// ═══════════════════════════════════════════════════════
async function searchPixiv(query) {
    const encoded = encodeURIComponent(query)
    const url = `https://www.pixiv.net/ajax/search/artworks/${encoded}?word=${encoded}&order=popular_d&mode=safe&p=1&s_mode=s_tag&type=illust&lang=en`

    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.pixiv.net/',
            'Accept': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Pixiv search HTTP ${res.status}`)
    const json = await res.json()

    if (json.error) throw new Error('Pixiv API error: ' + JSON.stringify(json.message))

    const data = json.body?.illustManga?.data
    if (!data || data.length === 0) return []

    // Filtrar: solo ilustraciones (illustType 0), una sola página, y preferir no-AI
    const candidates = data.filter(item => {
        return item.illustType === 0      // solo ilustraciones normales
            && item.pageCount === 1        // solo imágenes de una página (evitar manga)
            && item.xRestrict === 0        // solo SFW
            && item.width >= 600           // resolución mínima aceptable
            && item.height >= 600
    })

    // Priorizar arte manual sobre AI, pero permitir AI si no hay manual
    const manual = candidates.filter(c => c.aiType === 1)
    const pool = manual.length >= 3 ? manual : candidates

    // Tomar los mejores 10 para elegir uno aleatorio
    return pool.slice(0, 10).map(item => ({
        id: item.id,
        title: item.title,
        artist: item.userName,
        width: item.width,
        height: item.height,
        isAI: item.aiType === 2
    }))
}

// ═══════════════════════════════════════════════════════
//  PIXIV.CAT PROXY → Descarga la imagen original vía proxy
// ═══════════════════════════════════════════════════════
async function downloadFromPixivCat(artworkId) {
    // pixiv.cat devuelve la imagen original (jpg)
    const proxyUrl = `https://pixiv.cat/${artworkId}.jpg`

    const res = await axios.get(proxyUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 400
    })

    const buffer = Buffer.from(res.data)
    if (buffer.length < 5000) throw new Error('Imagen demasiado pequeña, posible error')

    return buffer
}

// ═══════════════════════════════════════════════════════
//  IMAGE UPLOAD → Catbox con fallback a freeimage.host
// ═══════════════════════════════════════════════════════
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function uploadToCatbox(buffer) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename: 'character.jpg', contentType: 'image/jpeg' })

    const response = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: {
            ...form.getHeaders(),
            'User-Agent': BROWSER_UA,
            'Origin': 'https://catbox.moe',
            'Referer': 'https://catbox.moe/'
        },
        timeout: 60000
    })

    if (!response.data || !String(response.data).startsWith('http')) {
        throw new Error(response.data || 'Error al subir a Catbox')
    }
    return String(response.data).trim()
}

async function uploadToFreeimage(buffer) {
    const form = new FormData()
    form.append('key', '6d207e02198a847aa98d0a2a901485a5')
    form.append('action', 'upload')
    form.append('format', 'json')
    form.append('source', buffer, { filename: 'character.jpg', contentType: 'image/jpeg' })

    const response = await axios.post('https://freeimage.host/api/1/upload', form, {
        headers: {
            ...form.getHeaders(),
            'User-Agent': BROWSER_UA
        },
        timeout: 60000
    })

    const data = response.data
    if (data && data.status_code === 200 && data.image && data.image.url) {
        return data.image.url
    }
    throw new Error('Respuesta inválida de Freeimage.host')
}

async function uploadImage(buffer) {
    // Intentar Catbox primero, fallback a Freeimage.host
    try {
        return await uploadToCatbox(buffer)
    } catch (e) {
        console.log('[addchar] Catbox falló:', e.message, '→ Intentando Freeimage.host...')
        return await uploadToFreeimage(buffer)
    }
}

// ═══════════════════════════════════════════════════════
//  HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════
let handler = async (m, { conn, text, isOwner }) => {
    // Verificar permisos: owner o usuario autorizado (gachaAdmin)
    const settings = global.db.data.settings[conn.user.jid] || {}
    const gachaAdmins = settings.gachaAdmins || []
    const isGachaAdmin = gachaAdmins.includes(m.sender)

    if (!isOwner && !isGachaAdmin) {
        return m.reply('❌ Solo el *owner* o los *admins de gacha* designados pueden agregar personajes.\n\nEl owner puede autorizarte con:\n*#gachaadmin add @usuario*')
    }

    if (!text) {
        return m.reply(`📋 *Uso:* #addchar nombre | género | source

🔍 *Modo Pixiv (automático):*
Escribe solo el comando con los datos y el bot buscará automáticamente una imagen de alta calidad en Pixiv, la descargará y la subirá a Catbox.

📎 *Modo manual (imagen adjunta):*
Envía o responde a una imagen junto con el comando.

*Ejemplo (automático):*
#addchar Rem | Mujer | Re:Zero

*Ejemplo (con imagen):*
(adjunta una imagen y escribe)
#addchar Rem | Mujer | Re:Zero

*Géneros válidos:* Mujer, Hombre, desconocido`)
    }

    const parts = text.split('|').map(p => p.trim())
    if (parts.length < 3) {
        return m.reply('❌ Formato incorrecto. Usa:\n*#addchar nombre | género | source*')
    }

    const [name, gender, source] = parts

    if (!name || !gender || !source) {
        return m.reply('❌ Debes proporcionar nombre, género y source.')
    }

    const validGenders = ['mujer', 'hombre', 'desconocido']
    if (!validGenders.includes(gender.toLowerCase())) {
        return m.reply(`❌ Género inválido. Usa: *Mujer*, *Hombre* o *desconocido*`)
    }

    const genderFormatted = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()

    // Detectar si hay imagen adjunta
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || q.mediaType || ''
    const hasImage = /image/g.test(mime)

    await m.react('⏳')

    let imgBuffer = null
    let pixivInfo = null // Para mostrar info de la fuente

    if (hasImage) {
        // ── MODO MANUAL: imagen adjunta ──
        try {
            imgBuffer = await q.download?.()
            if (!imgBuffer) throw new Error('No se pudo descargar')
        } catch (e) {
            await m.react('❌')
            return m.reply('❌ No se pudo descargar la imagen adjunta.')
        }
    } else {
        // ── MODO PIXIV: búsqueda automática ──
        try {
            await conn.reply(m.chat, `🔍 Buscando imagen en *Pixiv* para *${name}* (${source})...`, m)

            // Intentar varias búsquedas con diferentes queries
            const queries = [
                `${name} ${source}`,
                name,
                `${name} anime`
            ]

            let results = []
            for (const query of queries) {
                try {
                    results = await searchPixiv(query)
                    if (results.length > 0) break
                } catch (e) {
                    console.log(`[addchar] Pixiv search failed for "${query}":`, e.message)
                }
            }

            if (results.length === 0) {
                await m.react('❌')
                return m.reply(`❌ No se encontraron imágenes en Pixiv para *${name}* (${source}).

💡 *Alternativa:* Adjunta una imagen manualmente:
1. Envía una imagen al chat
2. Responde a esa imagen con:
   *#addchar ${name} | ${gender} | ${source}*`)
            }

            // Seleccionar una imagen aleatoria del pool
            const selected = results[Math.floor(Math.random() * results.length)]
            pixivInfo = selected

            await conn.reply(m.chat, `📥 Descargando imagen de *${selected.artist}* (ID: ${selected.id})...`, m)

            // Descargar vía pixiv.cat proxy
            imgBuffer = await downloadFromPixivCat(selected.id)

        } catch (e) {
            console.error('[addchar] Error Pixiv:', e)
            await m.react('❌')
            return m.reply(`❌ Error al buscar/descargar imagen de Pixiv: ${e.message}

💡 *Alternativa:* Adjunta una imagen manualmente.`)
        }
    }

    // ── SUBIR IMAGEN ──
    let imgUrl
    try {
        imgUrl = await uploadImage(imgBuffer)
    } catch (e) {
        console.error('[addchar] Error upload:', e)
        await m.react('❌')
        return m.reply('❌ Error al subir la imagen: ' + (e.message || 'desconocido'))
    }

    // ── LEER characters.json ──
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
        characters = JSON.parse(clean)
    } catch (e) {
        await m.react('❌')
        return m.reply('❌ Error al leer la base de datos de personajes.')
    }

    // Verificar duplicado
    const exists = characters.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (exists) {
        await m.react('⚠️')
        return m.reply(`⚠️ Ya existe un personaje con el nombre *${exists.name}* (ID: ${exists.id}).`)
    }

    // Generar ID
    const maxId = characters.reduce((max, c) => {
        const id = parseInt(c.id) || 0
        return id > max ? id : max
    }, 0)
    const newId = String(maxId + 1)

    // Valor aleatorio entre 500 y 3000
    const value = String(Math.floor(Math.random() * 2501) + 500)

    const newChar = {
        id: newId,
        name: name,
        gender: genderFormatted,
        value: value,
        source: source,
        img: [imgUrl],
        vid: [],
        user: null,
        status: "Libre",
        votes: 0,
        aliases: ""
    }

    characters.push(newChar)
    try {
        fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters, null, 2), 'utf-8')
    } catch (e) {
        await m.react('❌')
        return m.reply('❌ Error al guardar en la base de datos.')
    }

    await m.react('✅')

    const genderEmoji = genderFormatted === 'Mujer' ? '♀️' : genderFormatted === 'Hombre' ? '♂️' : '⚧️'
    const pixivLine = pixivInfo
        ? `│ 🎨 *Artista:* ${pixivInfo.artist}\n│ 🔗 *Pixiv ID:* ${pixivInfo.id}\n│ 📐 *Resolución:* ${pixivInfo.width}x${pixivInfo.height}${pixivInfo.isAI ? '\n│ 🤖 *Tipo:* AI Generated' : ''}\n`
        : ''

    const caption = `
╭─⬣「 ✅ PERSONAJE AGREGADO 」⬣
│
│ 🆔 *ID:* ${newId}
│ 🎴 *Nombre:* ${name}
│ ${genderEmoji} *Género:* ${genderFormatted}
│ 📺 *Source:* ${source}
│ 💰 *Valor:* ${value}
│ 🖼️ *Imagen:* Catbox ✓
${pixivLine}│
╰─⬣ Total: ${characters.length} personajes ⬣
  `.trim()

    try {
        await conn.sendMessage(m.chat, {
            image: { url: imgUrl },
            caption: caption
        }, { quoted: m })
    } catch (e) {
        await conn.reply(m.chat, caption, m)
    }
}

handler.help = ['addchar nombre | género | source']
handler.tags = ['gacha']
handler.command = ['addchar', 'agregarchar', 'addpersonaje']
handler.owner = false

export default handler
