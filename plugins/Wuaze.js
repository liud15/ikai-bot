import fetch from 'node-fetch'
import FormData from 'form-data'

let handler = async (m) => {
  let q = m.quoted ? m.quoted : m
  let mime = (q.msg || q).mimetype || ''
  if (!mime) return conn.reply(m.chat, '💥 Responde a una *Imagen* o *Vídeo.*', m, rcanal)
  await m.react(rwait)

  try {
    conn.reply(m.chat, global.wait, m, {
      contextInfo: {
        externalAdReply: {
          mediaUrl: null,
          mediaType: 1,
          showAdAttribution: true,
          title: packname,
          body: wm,
          previewType: 0,
          thumbnail: icons,
          sourceUrl: channel
        }
      }
    })

    let media = await q.download()
    let link = await uploadWuaze(media, mime)
    let img = Buffer.from(await (await fetch(`${link}`)).arrayBuffer())

    let txt = `乂  *W U A Z E - U P L O A D*  乂\n\n`
    txt += `*» Enlace* : ${link}\n`
    txt += `*» Acortado* : ${await shortUrl(link)}\n`
    txt += `*» Tamaño* : ${formatBytes(media.length)}\n`
    txt += `*» Servicio* : Wuaze\n\n`
    txt += `> *${dev}*`

    await conn.sendFile(m.chat, img, 'thumbnail.jpg', txt, m, fkontak, rcanal)
    await m.react(done)

  } catch (error) {
    console.error('Error:', error)
    await m.react('❌')
  }
}

async function uploadWuaze(buffer, mimetype) {
  const formData = new FormData()

  // Determinar extensión
  let ext = 'bin'
  if (mimetype.includes('jpeg')) ext = 'jpg'
  else if (mimetype.includes('png')) ext = 'png'
  else if (mimetype.includes('gif')) ext = 'gif'
  else if (mimetype.includes('mp4')) ext = 'mp4'
  else if (mimetype.includes('webp')) ext = 'webp'

  formData.append('file', buffer, `file.${ext}`)

  let res = await fetch('https://spacny.wuaze.com/api_upload.php', {
    method: 'POST',
    headers: {
      'X-API-Key': 'sk_Z49RUHfNJxSS0KqBo4y6xobpyyugDtfEndpoint'
    },
    body: formData
  })

  let result = await res.json()
  // Según la documentación, la URL está en data.url
  return result.data?.url || result.url || result.file_url
}

handler.help = ['wuaze']
handler.tags = ['transformador']
handler.command = ['wuaze', 'wuazeup']
export default handler

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`
}

async function shortUrl(url) {
  try {
    let res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`)
    return await res.text()
  } catch {
    return url
  }
}
