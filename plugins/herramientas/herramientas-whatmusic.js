import fetch from 'node-fetch'
import FormData from 'form-data'
import { fileTypeFromBuffer } from 'file-type'

// ╔══════════════════════════════════════════════╗
// ║         WHAT MUSIC — EVOGB SHAZAM API        ║
// ║         Subida a files.evogb.win             ║
// ║         Detección vía api.evogb.org          ║
// ╚══════════════════════════════════════════════╝

const EVOGB_UPLOAD_URL = 'https://evogb.win/api/upload'
const EVOGB_API_URL    = 'https://api.evogb.org/tools/whatmusic-shazam'
const EVOGB_API_KEY    = 'sasuke'

// ── Subir buffer a files.evogb.win ──────────────────────────────────────────
async function uploadToEvogb(buffer, mime) {
    const { ext } = (await fileTypeFromBuffer(buffer)) || { ext: 'mp3' }
    const form = new FormData()
    form.append('file', buffer, {
        filename: `audio.${ext}`,
        contentType: mime || 'audio/mpeg'
    })
    form.append('urlMode', 'default')
    form.append('expireValue', '1')
    form.append('expireUnit', 'day')
    form.append('author', `${global.botname || 'IkaiBot'}-Shazam`)

    const res = await fetch(EVOGB_UPLOAD_URL, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
    })

    const json = await res.json()
    if (!json.success || !json.url) throw new Error('Error al subir archivo a evogb.win')
    return json.url
}

// ── Detectar canción con la API Evogb ────────────────────────────────────────
async function detectWithEvogb(fileUrl) {
    const url = `${EVOGB_API_URL}?method=url&url=${encodeURIComponent(fileUrl)}&key=${EVOGB_API_KEY}`
    const res = await fetch(url, {
        headers: { 'User-Agent': `${global.botname || 'IkaiBot'}/2.0` }
    })
    const json = await res.json()
    if (!json.status || !json.data?.info?.title) return null
    return json.data
}

// ── Barra de confianza visual ────────────────────────────────────────────────
function buildConfidenceBar(pct) {
    const filled = Math.round((pct / 100) * 10)
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)
    return `${bar} ${pct}%`
}

// ── Handler principal ────────────────────────────────────────────────────────
let handler = async (m, { conn, usedPrefix, command }) => {
    let q = m.quoted ? m.quoted : m
    let mime = (q.msg || q).mimetype || ''

    // Acepta audio y video (video puede tener audio embebido)
    if (!/audio|video/.test(mime)) {
        return m.reply(
            ` ✦ \`\`\`WHAT MUSIC / SHAZAM\`\`\`\n\n` +
            `┃ Responde a un *audio o video* con:\n` +
            `┃ *${usedPrefix + command}*\n\n` +
            `_El bot detectará la canción automáticamente._`
        )
    }

    await conn.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })

    try {
        // 1️⃣ Descargar el media
        let media = await q.download()

        // 2️⃣ Subir a files.evogb.win
        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
        let fileUrl = await uploadToEvogb(media, mime)

        // 3️⃣ Detectar con la API Evogb / Shazam
        let data = await detectWithEvogb(fileUrl)

        if (!data) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
            return m.reply(
                `🍂 *No se detectó ninguna canción.*\n\n` +
                `_Asegúrate de que el audio tenga música reconocible y no sea muy corto._`
            )
        }

        const { info, media: mediaData, links, detection } = data
        const conf = detection?.confidence
        const barConf = conf ? buildConfidenceBar(conf.percentage) : null

        // ── Construir mensaje ───────────────────────────────────────
        let txt = ` ✦ \`\`\`WHAT MUSIC FOUND\`\`\`\n\n`

        txt += `┃ ♪ Artista:  *${info.artist || '—'}*\n`
        txt += `> ⊹ Título:   *${info.title}*\n`

        if (info.album)  txt += `┃ ◉ Álbum:    *${info.album}*\n`
        if (info.year)   txt += `┃ ▷ Año:      *${info.year}*\n`
        if (info.genre)  txt += `┃ ♫ Género:   *${info.genre}*\n`
        if (info.label)  txt += `┃ ⦿ Sello:    *${info.label}*\n`
        if (info.isrc)   txt += `┃ ⧡ ISRC:     *${info.isrc}*\n`

        if (barConf) {
            txt += `\n┃ ◈ Confianza:\n`
            txt += `┃ \`${barConf}\`\n`
            txt += `┃ _${conf.description}_\n`
        }
        txt += `\n`

        // 4️⃣ Enviar imagen + texto juntos (un solo mensaje)
        const coverUrl = mediaData?.cover_hd || mediaData?.cover
        if (coverUrl) {
            try {
                const coverRes = await fetch(coverUrl)
                const coverBuf = Buffer.from(await coverRes.arrayBuffer())
                await conn.sendMessage(m.chat, {
                    image: coverBuf,
                    caption: txt
                }, { quoted: m })
            } catch (imgErr) {
                console.error('[whatmusic] Error al enviar imagen:', imgErr?.message)
                // Fallback: solo texto si la imagen falla
                await conn.sendMessage(m.chat, { text: txt }, { quoted: m })
            }
        } else {
            // Sin portada: enviar solo texto
            await conn.sendMessage(m.chat, { text: txt }, { quoted: m })
        }

        // 5️⃣ Enviar preview de audio si existe
        if (mediaData?.preview_audio) {
            try {
                const previewRes = await fetch(mediaData.preview_audio)
                const previewBuf = Buffer.from(await previewRes.arrayBuffer())
                await conn.sendMessage(m.chat, {
                    audio: previewBuf,
                    mimetype: 'audio/mp4',
                    ptt: false
                }, { quoted: m })
            } catch (audErr) {
                console.error('[whatmusic] Error al enviar preview:', audErr?.message)
                // preview opcional, no bloquea
            }
        }

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

    } catch (e) {
        console.error('[whatmusic] Error:', e)
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        m.reply(`❌ *Error al detectar la canción:*\n_${e?.message || 'Error desconocido'}_`)
    }
}

handler.help = ['whatmusic <audio/video>']
handler.tags = ['herramientas']
handler.command = ['whatmusic', 'shazam', 'wmusic', 'reconocer']
handler.limit = true

export default handler
