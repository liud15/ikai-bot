import fetch from 'node-fetch'
import { lookup } from 'mime-types'

const MAX_SIZE_MB = 80
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * Scrapea Streamtape para obtener el link de descarga directa.
 *
 * Streamtape construye la URL de descarga en el JS de la página
 * concatenando dos fragmentos de texto en una asignación innerHTML:
 *
 *   document.getElementById('idelement').innerHTML =
 *     ('//streamtape.com/get_video?id=XX&expires=YY&token=ZZ-' + '-ABC').substring(2)
 *
 * Extraemos ambos fragmentos con regex y los unimos.
 */
async function scrapeStreamtape(url) {
  // Normalizar: aceptar /v/ (viewer) y /e/ (embed)
  const pageUrl = url.replace('/e/', '/v/')

  const res = await fetch(pageUrl, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9',
    },
    follow: 10
  })

  const html = await res.text()

  // --- Extraer la URL de descarga ---
  // Patrón 1: innerHTML con comillas simples
  let match = html.match(/innerHTML\s*=\s*\(\s*'([^']*\/\/[^']+)'\s*\+\s*'([^']+)'\s*\)/)
  // Patrón 2: innerHTML con comillas dobles
           || html.match(/innerHTML\s*=\s*\(\s*"([^"]*\/\/[^"]+)"\s*\+\s*"([^"]+)"\s*\)/)
  // Patrón 3: sin paréntesis externo
           || html.match(/innerHTML\s*=\s*'([^']*\/\/streamtape[^']+)'\s*\+\s*'([^']+)'/)

  if (!match) {
    // Patrón alternativo: norobotlink con href directo
    const alt = html.match(/id="norobotlink"[^>]*href="([^"]+)"/)
             || html.match(/href="(https?:\/\/streamtape\.com\/get_video[^"]+)"/)
    if (!alt) throw new Error('No se pudo extraer el link de descarga de Streamtape.\nEl video puede ser privado o el link inválido.')
    return { dl: alt[1], filename: extractStreamtapeTitle(html) }
  }

  // Unir los dos fragmentos; el resultado empieza con '//' → agregar 'https:'
  const rawUrl = (match[1] + match[2]).replace(/^\/\//, '')
  const dl = 'https://' + rawUrl

  return { dl, filename: extractStreamtapeTitle(html) }
}

function extractStreamtapeTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)</)
  if (!m) return 'video.mp4'
  return m[1]
    .replace(/\s*[-|–]\s*streamtape.*$/i, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .trim() || 'video.mp4'
}

// ─────────────────────────────────────────
let handler = async (m, { conn, text, usedPrefix }) => {
  if (!text) return conn.reply(m.chat, `Por favor, ingresa un link de Streamtape.`, m)
  if (!/^https?:\/\/(www\.)?streamtape\.(com|net|to|xyz|cc)\//i.test(text))
    return conn.reply(m.chat, `❌ Enlace inválido. Debe ser un link de Streamtape.`, m)

  try {
    await m.react('🕒')

    // 1) Scrapear la página para obtener el link de descarga
    const { dl, filename } = await scrapeStreamtape(text)
    const mimetype = lookup(filename) || 'video/mp4'
    const caption  = `乂 STREAMTAPE - DESCARGAS 乂\n\n✩ Nombre » ${filename}\n✩ Enlace » ${text}`

    // 2) Descargar el archivo con headers apropiados
    const fileRes = await fetch(dl, {
      headers: {
        'User-Agent': UA,
        'Referer':    'https://streamtape.com/',
        'Accept':     '*/*',
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
      throw new Error(`Streamtape bloqueó la descarga.\n🔗 Intenta manualmente: ${dl}`)
    }

    const fileBuffer = await fileRes.buffer()
    await conn.sendMessage(m.chat, { document: fileBuffer, fileName: filename, mimetype, caption }, { quoted: m })
    await m.react('✔️')

  } catch (e) {
    await m.react('✖️')
    return conn.reply(m.chat, `⚠︎ Ocurrió un error.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e.message}`, m)
  }
}

handler.command = ['st', 'streamtape']
handler.help    = ['streamtape <url>']
handler.tags    = ['descargas']
handler.group   = true

export default handler
