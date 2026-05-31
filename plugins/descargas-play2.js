import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { tmpPath } from '../lib/tmp.js'

const execPromise = promisify(exec)

let handler = async (m, { conn, text, command, usedPrefix }) => {
  if (!text) return m.reply(
    `🎵 Ingresa el nombre o link del audio.\n` +
    `Ejemplo: *${usedPrefix + command} Hijo de la Luna*\n` +
    `También puedes pegar un link de YouTube directamente.`
  )

  try {
    await m.reply('⏳ Buscando y descargando audio, espera un momento...')

    const apiUrl = `https://api.evogb.org/dl/youtubeplay?query=${encodeURIComponent(text)}&type=audio&quality=auto&key=liu-ofc`
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    let json
    try {
      json = await res.json()
    } catch {
      throw new Error('La API no respondió correctamente.')
    }

    if (!json.status || !json.data) {
      throw new Error('No se encontró el audio. Intenta con otro título o link.')
    }

    const data = json.data
    const {
      title,
      url: videoUrl,
      duration,
      views,
      ago,
      image,
      thumbnail,
      author,
      quality,
      quality_contex,
      download
    } = data

    if (!download?.url) throw new Error('No se pudo obtener el enlace de descarga.')

    const thumbUrl = image || thumbnail || null
    const fileName = sanitizeFilename(download.filename || title || 'audio')

    // Descarga el buffer del audio
    const dlRes = await fetch(download.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    if (!dlRes.ok) throw new Error(`Error al descargar el audio: HTTP ${dlRes.status}`)
    const audioArrayBuffer = await dlRes.arrayBuffer()
    const audioBuff = Buffer.from(audioArrayBuffer)

    const fileSizeMB = (audioBuff.length / (1024 * 1024)).toFixed(2)
    const viewsFormatted = views ? Number(views).toLocaleString('es') : 'N/A'
    const durationStr = duration?.timestamp || 'N/A'
    const authorName = author?.name || 'YouTube'

    // ── play2: enviar como audio de WhatsApp con tarjeta de previsualización ──────
    if (command === 'play' || command === 'play2') {
      await conn.sendMessage(m.chat, {
        audio: audioBuff,
        mimetype: 'audio/mpeg',
        contextInfo: {
          externalAdReply: {
            title: title || 'Sin título',
            body: `${authorName} • ${durationStr}`,
            thumbnailUrl: thumbUrl,
            sourceUrl: videoUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: m })

      // ── play2mp4: enviar como documento .mp3 con caption detallado ────────────────
    } else if (command === 'play2mp3') {
      const caption = `
乂  *Y T - A U D I O*

   ⭔  *Título* : ${title || 'N/A'}
   ⭔  *Canal* : ${authorName}
   ⭔  *Duración* : ${durationStr}
   ⭔  *Vistas* : ${viewsFormatted}
   ⭔  *Subido* : ${ago || 'N/A'}
   ⭔  *Calidad* : ${quality_contex || quality || 'N/A'}
   ⭔  *Tamaño* : ${fileSizeMB} MB

${global.wm || ''}`.trim()

      await conn.sendMessage(m.chat, {
        document: audioBuff,
        mimetype: 'audio/mpeg',
        fileName: `${fileName}.mp3`,
        caption
      }, { quoted: m })

      // ── play2audio: enviar como nota de voz (PTT) ─────────────────────────────────
    } else if (command === 'playaudio' || command === 'play2audio') {
      const tempDir = tmpPath('mitabot_tmp')
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

      const inputFile = path.join(tempDir, `${Date.now()}_in.mp3`)
      const outputFile = path.join(tempDir, `${Date.now()}_out.ogg`)
      fs.writeFileSync(inputFile, audioBuff)

      try {
        await execPromise(
          `ffmpeg -y -i "${inputFile}" -vn -c:a libopus -b:a 128k -vbr on -compression_level 10 -f ogg "${outputFile}"`
        )
        if (!fs.existsSync(outputFile) || fs.statSync(outputFile).size === 0) {
          throw new Error('ffmpeg genero un OGG vacio')
        }
        await conn.sendMessage(m.chat, {
          audio: { url: outputFile },
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        }, { quoted: m })
      } catch (err) {
        console.error('Error convirtiendo a opus, enviando mp3 directo:', err)
        await conn.sendMessage(m.chat, {
          audio: audioBuff,
          mimetype: 'audio/mpeg',
          ptt: true
        }, { quoted: m })
      } finally {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile)
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile)
      }
    }

  } catch (e) {
    console.error('Error en descargas-play2:', e)
    await m.reply(`❌ Ocurrió un error.\n*Detalles:* ${e.message}`)
  }
}

handler.help = ['play <título|link>', 'playaudio <título|link>', 'play2 <título|link>', 'play2mp3 <título|link>', 'play2audio <título|link>']
handler.tags = ['downloader']
handler.command = ['play', 'playaudio', 'play2', 'play2mp3', 'play2audio']
handler.limit = true
handler.daftar = true

export default handler

function sanitizeFilename(name = 'audio') {
  return name.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 100)
}
