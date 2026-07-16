import fetch from 'node-fetch'
import { lookup } from 'mime-types'

const MAX_SIZE_MB = 80
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * Scrapea Mp4upload para obtener el link de descarga directa.
 *
 * Mp4upload usa JWPlayer y embebe la URL del video en su configuración JS:
 *
 *   player.setup({ sources: [{ file: "https://www.mp4upload.com:282/d/..." }] })
 *
 * o en la página embed como variable JS:
 *
 *   var playerConfig = { file: "https://..." }
 *
 * Primero intentamos la página embed (más limpia), luego la página normal.
 */
async function scrapeMp4upload(url) {
  // Construir URL embed desde cualquier formato de entrada
  const embedUrl = toEmbedUrl(url)
  const pageUrl  = toPageUrl(url)

  // Intentar primero con la página embed
  let html = await fetchHtml(embedUrl, pageUrl)

  // Patrones para encontrar el archivo de video en la config del player
  let match = html.match(/"file"\s*:\s*"(https?:\/\/[^"]+\.(mp4|mkv|avi|mov|webm)[^"]*)"/i)
           || html.match(/file\s*:\s*["'](https?:\/\/[^"']+\.(mp4|mkv|avi|mov|webm)[^"']*)["']/i)
           || html.match(/<source[^>]+src=["'](https?:\/\/[^"']+\.(mp4|mkv|avi|mov|webm)[^"']*)["']/i)
           // Patrón sin extensión específica (por si el server no la incluye)
           || html.match(/"file"\s*:\s*"(https?:\/\/(?:www\.)?mp4upload\.com[^"]+)"/i)
           || html.match(/file\s*:\s*["'](https?:\/\/(?:www\.)?mp4upload\.com[^"']+)["']/i)

  // Si no encontramos en embed, intentar con la página normal
  if (!match) {
    html = await fetchHtml(pageUrl, pageUrl)
    match = html.match(/"file"\s*:\s*"(https?:\/\/[^"]+\.(mp4|mkv|avi|mov|webm)[^"]*)"/i)
         || html.match(/file\s*:\s*["'](https?:\/\/[^"']+\.(mp4|mkv|avi|mov|webm)[^"']*)["']/i)
         || html.match(/<source[^>]+src=["'](https?:\/\/[^"']+\.(mp4|mkv|avi|mov|webm)[^"']*)["']/i)
  }

  if (!match) throw new Error('No se pudo extraer el link de descarga de Mp4upload.\nEl archivo puede ser privado o el link inválido.')

  const dl = match[1]

  // Extraer nombre del archivo
  const titleMatch = html.match(/<title[^>]*>([^<]+)</)
  const rawTitle   = titleMatch?.[1]
    ?.replace(/\s*[-|–]\s*mp4upload.*$/i, '')
    ?.replace(/^mp4upload\s*[-|–]?\s*/i, '')
    ?.trim()

  // Intentar extraer el nombre del propio URL del archivo
  const urlFilename = dl.split('/').pop()?.split('?')[0] || ''
  const filename    = rawTitle || urlFilename || 'video.mp4'

  return { dl, filename }
}

function toEmbedUrl(url) {
  // https://www.mp4upload.com/XXXXXXXX → https://www.mp4upload.com/embed-XXXXXXXX.html
  return url
    .replace(/^(https?:\/\/(?:www\.)?mp4upload\.com\/)(?!embed-)([a-z0-9]+)(\.html)?$/i,
             '$1embed-$2.html')
}

function toPageUrl(url) {
  // https://www.mp4upload.com/embed-XXXXXXXX.html → https://www.mp4upload.com/XXXXXXXX
  return url
    .replace(/^(https?:\/\/(?:www\.)?mp4upload\.com\/)embed-([a-z0-9]+)\.html$/i, '$1$2')
}

async function fetchHtml(url, referer) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9',
      'Referer': referer || 'https://www.mp4upload.com/',
    },
    follow: 10
  })
  return res.text()
}

// ─────────────────────────────────────────
let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text) return conn.reply(m.chat, `Por favor, ingresa un link de Mp4upload.`, m)
  if (!/^https?:\/\/(www\.)?mp4upload\.com\//i.test(text))
    return conn.reply(m.chat, `❌ Enlace inválido. Debe ser un link de Mp4upload.`, m)

  try {
    await m.react('🕒')

    // 1) Scrapear Mp4upload para obtener el link de descarga
    const { dl, filename } = await scrapeMp4upload(text)
    const mimetype = lookup(filename) || 'video/mp4'
    const caption  = `乂 MP4UPLOAD - DESCARGAS 乂\n\n✩ Nombre » ${filename}\n✩ Enlace » ${text}`

    // 2) Descargar con headers que simulan un navegador
    const fileRes = await fetch(dl, {
      headers: {
        'User-Agent': UA,
        'Referer':    'https://www.mp4upload.com/',
        'Accept':     '*/*',
        'Origin':     'https://www.mp4upload.com',
      },
      follow: 10
    })

    const contentType = fileRes.headers.get('content-type') || ''

    // Validar tamaño desde Content-Length antes de descargar
    const contentLength = parseInt(fileRes.headers.get('content-length') || '0')
    const sizeMB = contentLength / (1024 * 1024)

    if (sizeMB > MAX_SIZE_MB && contentLength > 0) {
      await m.react('❌')
      const sizeStr = sizeMB >= 1024
        ? `${(sizeMB / 1024).toFixed(2)} GB`
        : `${sizeMB.toFixed(2)} MB`
      return conn.reply(
        m.chat,
        `⚠️ El archivo pesa *${sizeStr}* y supera el límite de ${MAX_SIZE_MB}MB.\n\n🔗 Descárgalo manualmente:\n${dl}`,
        m
      )
    }

    if (contentType.includes('text/html')) {
      throw new Error(`Mp4upload bloqueó la descarga.\n🔗 Intenta manualmente: ${dl}`)
    }

    const fileBuffer = await fileRes.buffer()
    await conn.sendMessage(m.chat, { document: fileBuffer, fileName: filename, mimetype, caption }, { quoted: m })
    await m.react('✔️')

  } catch (e) {
    await m.react('✖️')
    return conn.reply(m.chat, `⚠︎ Ocurrió un error.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e.message}`, m)
  }
}

handler.command = ['mp4up', 'mp4upload']
handler.help    = ['mp4upload <url>']
handler.tags    = ['descargas']
handler.group   = true

export default handler
