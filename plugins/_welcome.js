import { WAMessageStubType } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'

export async function before(m, { conn, participants, groupMetadata }) {
  if (!m.messageStubType || !m.isGroup) return true

  let who = m.messageStubParameters[0]
  let taguser = `@${who.split('@')[0]}`
  let chat = global.db.data.chats[m.chat]
  let defaultImage = 'https://i.pinimg.com/1200x/23/d2/5a/23d25a99cd0d7b82892e4eebeceaa854.jpg'

  if (chat.welcome) {
    let img
    try {
      let pp = await conn.profilePictureUrl(who, 'image')
      img = await (await fetch(pp)).buffer()
    } catch {
      img = await (await fetch(defaultImage)).buffer()
    }

    try {
      if (m.messageStubType === WAMessageStubType.GROUP_PARTICIPANT_ADD) {
        let bienvenida = `😼 *Bienvenido* a ${groupMetadata.subject}\n ❤️ ${taguser}\n${global.welcom1 || ''}\n • Disfruta tu estadía en el grupo!\n> 🌉 Puedes usar *#help* para ver la lista de comandos.\n> 🜸 https://whatsapp.com/channel/0029Vafoq2TFsn0kTerYCJ17`
        await conn.sendMessage(m.chat, { image: img, caption: bienvenida, mentions: [who] })
      } else if (
        m.messageStubType === WAMessageStubType.GROUP_PARTICIPANT_REMOVE ||
        m.messageStubType === WAMessageStubType.GROUP_PARTICIPANT_LEAVE
      ) {
        let bye = `😔 *Adiós* de ${groupMetadata.subject}\n 😒 ${taguser}\n${global.welcom2 || ''}\n • ¡Te esperamos pronto!\n> 🌉 Puedes usar *#help* para ver la lista de comandos.\n> 🜸 https://whatsapp.com/channel/0029Vafoq2TFsn0kTerYCJ17`
        await conn.sendMessage(m.chat, { image: img, caption: bye, mentions: [who] })
      }
    } catch (e) {
      console.log(`⚠️ No se pudo enviar mensaje de welcome/bye: ${e.message || e}`)
    }
  }

  return true
}
