import yts from 'yt-search'
import fetch from 'node-fetch'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

let handler = async (m, { conn, text, command, usedPrefix }) => {
  if (!text) return m.reply(`✳️ Ingresa el nombre del audio o video.\nEjemplo: *${usedPrefix + command} Confess your love*`)

  try {
    const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
    const query = videoMatch ? 'https://youtu.be/' + videoMatch[1] : text

    const search = await yts(query)
    if (!search.videos.length) throw new Error('No se encontró el video, intenta con otro título.')

    const video = videoMatch
      ? search.videos.find(v => v.videoId === videoMatch[1]) || search.videos[0]
      : search.videos[0]
    const videoUrl = video.url

    const apiUrl = `https://api.evogb.org/dl/ytmp3?url=${encodeURIComponent(videoUrl)}&key=liu-ofc`
    const res = await fetch(apiUrl)
    let json
    try {
      json = await res.json()
    } catch {
      throw new Error('La API no respondió correctamente.')
    }

    if (!json.status || !json.data || !json.data.dl) {
      throw new Error('No se pudo obtener el enlace de descarga de la API.')
    }

    const { title, dl, author, views, duration, image } = json.data
    const thumbUrl = image || video.thumbnail
    const fileName = sanitizeFilename(title)

    // Using fetch directly to buffer avoids Bailey's internal axios throwing 404
    const dlRes = await fetch(dl, {
       headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' }
    })
    if (!dlRes.ok) throw new Error(`Servidor devolvió error ${dlRes.status}`)
    const audioArrayBuffer = await dlRes.arrayBuffer()
    const audioBuff = Buffer.from(audioArrayBuffer)

    if (command === 'play') {
       await conn.sendMessage(m.chat, {
        audio: audioBuff,
        mimetype: 'audio/mpeg',
        contextInfo: {
            externalAdReply: {
                title: title,
                body: author?.name || 'YouTube',
                thumbnailUrl: thumbUrl,
                sourceUrl: videoUrl,
                mediaType: 1,
                renderLargerThumbnail: true
            }
        }
       }, { quoted: m })
    } else if (command === 'playmp4') {
       await conn.sendMessage(m.chat, {
        document: audioBuff,
        mimetype: 'audio/mpeg',
        fileName: `${fileName}.mp3`,
        caption: `📄 ${title}`
       }, { quoted: m })
    } else if (command === 'playaudio') {
       const tempDir = path.join(os.tmpdir(), 'mitabot_tmp')
       if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

       const inputFile = path.join(tempDir, `${Date.now()}_in.mp3`)
       const outputFile = path.join(tempDir, `${Date.now()}_out.opus`)
       fs.writeFileSync(inputFile, audioBuff)

       try {
         await execPromise(`ffmpeg -i "${inputFile}" -c:a libopus -b:a 128k -vbr on -compression_level 10 "${outputFile}"`)
         await conn.sendMessage(m.chat, {
           audio: fs.readFileSync(outputFile),
           mimetype: 'audio/ogg; codecs=opus',
           ptt: true
         }, { quoted: m })
       } catch (err) {
         console.error('Error al convertir audio a opus:', err)
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
    console.error('Error en descargas-play:', e)
    await m.reply(`❌ Ocurrió un error.\n*Detalles:* ${e.message}`)
  }
}

handler.help = ['play <título>', 'playmp4 <título>', 'playaudio <título>']
handler.tags = ['downloader']
handler.command = ['play', 'playmp4', 'playaudio']
handler.limit = true
handler.daftar = true

export default handler

function sanitizeFilename(name = 'archivo') {
  return name.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 100)
}