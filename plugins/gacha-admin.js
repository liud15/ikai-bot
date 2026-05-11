let handler = async (m, { conn, text, args, isOwner }) => {
    if (!isOwner) return m.reply('❌ Solo el *owner* puede gestionar los admins de gacha.')

    // Inicializar settings si no existe
    if (!global.db.data.settings[conn.user.jid]) global.db.data.settings[conn.user.jid] = {}
    const settings = global.db.data.settings[conn.user.jid]
    if (!settings.gachaAdmins) settings.gachaAdmins = []

    const sub = (args[0] || '').toLowerCase()

    if (sub === 'add' || sub === 'agregar') {
        const rawMentioned = m.mentionedJid && m.mentionedJid[0]
        if (!rawMentioned) return m.reply('❌ Debes mencionar al usuario.\n*Ejemplo:* #gachaadmin add @usuario')
        const mentioned = `${global.getJidNum(rawMentioned)}@s.whatsapp.net`

        if (settings.gachaAdmins.includes(mentioned)) {
            return m.reply(`⚠️ @${global.getJidNum(mentioned)} ya es admin de gacha.`, null, { mentions: [mentioned] })
        }

        settings.gachaAdmins.push(mentioned)
        await m.react('✅')
        return conn.reply(m.chat, `✅ @${global.getJidNum(mentioned)} ahora puede usar *#addchar* para agregar personajes.`, m, { mentions: [mentioned] })

    } else if (sub === 'remove' || sub === 'quitar' || sub === 'del') {
        const rawMentioned = m.mentionedJid && m.mentionedJid[0]
        if (!rawMentioned) return m.reply('❌ Debes mencionar al usuario.\n*Ejemplo:* #gachaadmin remove @usuario')
        const mentioned = `${global.getJidNum(rawMentioned)}@s.whatsapp.net`

        const idx = settings.gachaAdmins.indexOf(mentioned)
        if (idx === -1) {
            return m.reply(`⚠️ @${global.getJidNum(mentioned)} no es admin de gacha.`, null, { mentions: [mentioned] })
        }

        settings.gachaAdmins.splice(idx, 1)
        await m.react('✅')
        return conn.reply(m.chat, `✅ @${global.getJidNum(mentioned)} ya no puede usar *#addchar*.`, m, { mentions: [mentioned] })

    } else if (sub === 'list' || sub === 'lista') {
        if (settings.gachaAdmins.length === 0) {
            return m.reply('📋 No hay admins de gacha designados.\n\nEl owner puede agregar con:\n*#gachaadmin add @usuario*')
        }

        const list = settings.gachaAdmins.map((jid, i) => `${i + 1}. @${global.getJidNum(jid)}`).join('\n')
        return conn.reply(m.chat, `╭─⬣「 👑 ADMINS DE GACHA 」⬣\n│\n${list.split('\n').map(l => '│ ' + l).join('\n')}\n│\n╰─⬣ Total: ${settings.gachaAdmins.length} ⬣`, m, { mentions: settings.gachaAdmins })

    } else {
        return m.reply(`👑 *Gestión de Admins de Gacha*

Los admins de gacha pueden usar *#addchar* para agregar personajes.

*Comandos:*
▸ *#gachaadmin add @usuario* — Autorizar usuario
▸ *#gachaadmin remove @usuario* — Quitar autorización
▸ *#gachaadmin list* — Ver lista de admins`)
    }
}

handler.help = ['gachaadmin add/remove/list @usuario']
handler.tags = ['gacha']
handler.command = ['gachaadmin', 'gachamod']
handler.owner = true

export default handler
