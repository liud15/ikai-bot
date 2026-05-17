// ╔══════════════════════════════════════════╗
// ║        grupo-silenciar.js                ║
// ║  Silencia usuarios eliminando sus msgs   ║
// ╚══════════════════════════════════════════╝

let handler = async (m, { conn, command, usedPrefix, participants, isAdmin, isBotAdmin }) => {
    if (!isAdmin) return m.reply('❌ Solo los *admins* pueden usar este comando.')
    if (!isBotAdmin) return m.reply('❌ Necesito ser *admin* del grupo para poder eliminar mensajes.')

    // Obtener el usuario objetivo
    const target = m.mentionedJid?.[0] || m.quoted?.sender
    if (!target) {
        return m.reply(
            `📌 *Uso del comando:*\n` +
            `› *${usedPrefix}silenciar @usuario* — silencia a un usuario\n` +
            `› *${usedPrefix}dessilenciar @usuario* — quita el silencio\n` +
            `› *${usedPrefix}silenciados* — lista de usuarios silenciados\n\n` +
            `_Responde al mensaje del usuario o menciónalo._`
        )
    }

    // Guardar silenciados por grupo en db (array serializable)
    const chat = global.db.data.chats[m.chat]
    if (!Array.isArray(chat.mutedUsers)) chat.mutedUsers = []

    const isMuted = chat.mutedUsers.includes(target)

    // === SILENCIAR ===
    if (/^(silenciar|mute|mutear|callar)$/i.test(command)) {
        if (target === conn.user.jid) return m.reply('❌ No puedo silenciarme a mí mismo.')
        if (target === m.sender)      return m.reply('❌ No puedes silenciarte a ti mismo.')

        const targetParticipant = participants.find(p => p.id === target)
        if (!targetParticipant) return m.reply('❌ El usuario no está en este grupo.')
        if (targetParticipant.admin) return m.reply('❌ No puedo silenciar a un administrador.')

        if (isMuted) {
            return conn.sendMessage(m.chat, {
                text: `⚠️ @${target.split('@')[0]} ya está silenciado en este grupo.`,
                mentions: [target]
            }, { quoted: m })
        }

        chat.mutedUsers.push(target)

        return conn.sendMessage(m.chat, {
            text: `🔇 *Usuario silenciado*\n\n` +
                  `👤 @${target.split('@')[0]}\n` +
                  `📋 Sus mensajes serán eliminados automáticamente.\n` +
                  `🔊 Usa *${usedPrefix}dessilenciar* para reactivarlo.`,
            mentions: [target]
        }, { quoted: m })
    }

    // === DESSILENCIAR ===
    if (/^(dessilenciar|desmutear|unmute|desmutar|activar)$/i.test(command)) {
        if (!isMuted) {
            return conn.sendMessage(m.chat, {
                text: `⚠️ @${target.split('@')[0]} no está silenciado.`,
                mentions: [target]
            }, { quoted: m })
        }

        chat.mutedUsers = chat.mutedUsers.filter(j => j !== target)

        return conn.sendMessage(m.chat, {
            text: `🔊 *Usuario activado*\n\n` +
                  `👤 @${target.split('@')[0]}\n` +
                  `✅ Ya puede enviar mensajes normalmente.`,
            mentions: [target]
        }, { quoted: m })
    }
}

// === LISTA DE SILENCIADOS (comando separado pero mismo archivo) ===
let listHandler = async (m, { conn, isAdmin }) => {
    if (!isAdmin) return m.reply('❌ Solo los *admins* pueden ver esta lista.')

    const chat = global.db.data.chats[m.chat]
    if (!Array.isArray(chat.mutedUsers) || chat.mutedUsers.length === 0) {
        return m.reply('✅ No hay usuarios silenciados en este grupo.')
    }

    const list = chat.mutedUsers
        .map((jid, i) => `${i + 1}. @${jid.split('@')[0]}`)
        .join('\n')

    return conn.sendMessage(m.chat, {
        text: `🔇 *Usuarios silenciados*\n━━━━━━━━━━━━━━━━\n${list}\n━━━━━━━━━━━━━━━━\n📊 Total: *${chat.mutedUsers.length}*`,
        mentions: chat.mutedUsers
    }, { quoted: m })
}

handler.help    = ['silenciar @user', 'dessilenciar @user', 'silenciados']
handler.tags    = ['grupo']
handler.command = ['silenciar', 'mute', 'mutear', 'callar', 'dessilenciar', 'desmutear', 'unmute', 'desmutar', 'activar']
handler.group   = true
handler.admin   = true
handler.botAdmin = true

export default handler
