var handler = async (m, { conn, usedPrefix, command, text }) => {

    // Obtener el usuario destino directamente del JID (ya resuelto por el handler)
    const user = m.mentionedJid?.[0] || m.quoted?.sender

    if (!user) {
        return conn.reply(m.chat, `Debes mencionar o responder el mensaje del usuario que quieres promover a admin.`, m)
    }

    try {
        await conn.groupParticipantsUpdate(m.chat, [user], 'promote')
        conn.reply(m.chat, `✅ @${global.getJidNum(user)} fue promovido a administrador.`, m, { mentions: [`${global.getJidNum(user)}@s.whatsapp.net`] })
    } catch (e) {
        conn.reply(m.chat, `❌ No se pudo promover al usuario.`, m)
    }

}

handler.help = ['promote']
handler.tags = ['grupo']
handler.command = ['promote', 'darpija', 'promover']
handler.group = true
handler.admin = true
handler.botAdmin = true
handler.fail = null

export default handler