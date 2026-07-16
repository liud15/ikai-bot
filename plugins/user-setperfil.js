import fetch from 'node-fetch'
import FormData from 'form-data'

// ───────────────────────────────────────────────────
//  user-setperfil.js
//  Permite al usuario guardar una imagen de perfil
//  personalizada en la database del bot.
//  Uso: #setperfil (respondiendo a una imagen)
//       #setperfil https://url.com/imagen.jpg
//       #setperfil borrar   → elimina la foto guardada
// ───────────────────────────────────────────────────

/**
 * Sube una imagen a Evogb y devuelve la URL pública.
 * @param {Buffer} buffer
 * @param {string} username
 * @returns {Promise<string>}
 */
async function uploadToEvogb(buffer, username = 'IkaiBot') {
  const form = new FormData()
  form.append('file', buffer, {
    filename: `perfil-${username}-${Date.now()}.jpg`,
    contentType: 'image/jpeg'
  })
  form.append('urlMode', 'custom_name')
  form.append('author', username)

  const res = await fetch('https://evogb.win/api/upload', {
    method: 'POST',
    headers: form.getHeaders(),
    body: form
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`)
  if (!data?.success || !data?.url || !String(data.url).startsWith('http')) {
    throw new Error('Respuesta inválida de Evogb: ' + JSON.stringify(data))
  }

  return String(data.url).trim()
}

let handler = async (m, { conn, args, text }) => {
  // Inicializar usuario si no existe
  if (!global.db.data.users[m.sender]) {
    global.db.data.users[m.sender] = {}
  }
  const user = global.db.data.users[m.sender]

  // ── Opción: borrar foto personalizada ──────────────
  if (args[0] && ['borrar', 'reset', 'eliminar', 'delete'].includes(args[0].toLowerCase())) {
    if (!user.customPP) {
      return m.reply('❌ No tienes ninguna foto de perfil personalizada guardada.')
    }
    delete user.customPP
    await m.react('🗑️')
    return m.reply('✅ Tu foto de perfil personalizada ha sido eliminada.\nEl bot volverá a usar tu foto de WhatsApp.')
  }

  // ── Obtener imagen ──────────────────────────────────
  const q       = m.quoted ? m.quoted : m
  const mime    = (q.msg || q).mimetype || q.mediaType || ''
  const isImage = /image/i.test(mime)

  // ¿Se envió una URL como argumento?
  const urlArg = (text || '').match(/https?:\/\/\S+/i)
  const sourceUrl = urlArg ? urlArg[0].trim() : ''

  if (!isImage && !sourceUrl) {
    const helpText = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃  🖼️ *SET PERFIL*
╰━━━━━━━━━━━━━━━━━━━━╯
Guarda tu propia imagen de perfil en la database del bot, independiente de tu foto de WhatsApp.

*Opciones:*
▸ Responde a una imagen con *#setperfil*
▸ Envía *#setperfil <URL>* con el link directo a una imagen
▸ Usa *#setperfil borrar* para eliminar la foto guardada

La imagen aparecerá en tu *#perfil* del bot.
`.trim()
    return m.reply(helpText)
  }

  await m.react('⏳')

  // ── Descargar imagen ────────────────────────────────
  let imgBuffer
  try {
    if (sourceUrl) {
      const imgRes = await fetch(sourceUrl)
      if (!imgRes.ok) throw new Error(`No se pudo descargar la URL: HTTP ${imgRes.status}`)
      const contentType = imgRes.headers.get('content-type') || ''
      if (!/^image\//i.test(contentType)) throw new Error('La URL no es una imagen válida.')
      imgBuffer = Buffer.from(await imgRes.arrayBuffer())
    } else {
      imgBuffer = await q.download?.()
      if (!imgBuffer) throw new Error('No se pudo descargar la imagen del mensaje.')
    }
  } catch (e) {
    await m.react('❌')
    return m.reply('❌ Error al obtener la imagen:\n' + (e.message || e))
  }

  // ── Subir a Evogb ───────────────────────────────────
  // Se usa el número del JID (sin @s.whatsapp.net) para evitar
  // errores con caracteres especiales en nombres de usuario.
  let imgUrl
  try {
    const lidNumber = m.sender.split('@')[0]
    imgUrl = await uploadToEvogb(imgBuffer, lidNumber)
  } catch (e) {
    console.error('[setperfil] Error Evogb:', e)
    await m.react('❌')
    return m.reply('❌ Error al subir la imagen.\n' + (e.message || e))
  }

  // ── Guardar en la database ──────────────────────────
  user.customPP = imgUrl

  await m.react('✅')

  await conn.sendMessage(m.chat, {
    image: imgBuffer,
    caption: `✅ *¡Foto de perfil guardada exitosamente!*\n\n` +
             `📌 Esta imagen ahora aparecerá en tu *#perfil*.\n` +
             `🔗 URL guardada: ${imgUrl}\n\n` +
             `_Usa *#setperfil borrar* para eliminarla en cualquier momento._`
  }, { quoted: m })
}

handler.help      = ['setperfil', 'setperfil <URL>', 'setperfil borrar']
handler.tags      = ['user', 'economy']
handler.command   = ['setperfil', 'setpp', 'fotoperfil', 'profilepic']
handler.group     = false   // funciona en grupo y privado

export default handler
