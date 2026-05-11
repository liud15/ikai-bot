// Sistema de Advertencias (Warns) — Solo admins pueden usarlo
const MAX_WARNS = 3

let handler = async (m, { conn, text, command, usedPrefix, participants, isAdmin, isBotAdmin }) => {
    if (!isAdmin) return m.reply('❌ Solo los *admins* pueden usar este comando.')

    // === WARN ===
    if (/^warn$/i.test(command)) {
        if (!isBotAdmin) return m.reply('❌ El bot necesita ser admin para poder expulsar.')

        const target = m.mentionedJid?.[0] || (m.quoted?.sender)
        if (!target) return m.reply(`✳️ Menciona o responde al usuario.\nUso: *${usedPrefix}warn @usuario [razón]*`)
        if (target === m.sender) return m.reply('❌ No puedes advertirte a ti mismo.')
        if (target === conn.user.jid) return m.reply('❌ No puedes advertir al bot.')

        // Verificar si es admin
        const targetIsAdmin = participants.find(p => p.id === target)?.admin
        if (targetIsAdmin) return m.reply('❌ No puedes advertir a un admin.')

        const reason = (text || '').replace(/@\d+/g, '').trim() || 'Sin razón especificada'

        const user = global.db.data.users[target] || (global.db.data.users[target] = {})
        if (!Number.isFinite(user.warn)) user.warn = 0
        user.warn += 1

        if (user.warn >= MAX_WARNS) {
            user.warn = 0
            await conn.sendMessage(m.chat, {
                text: `⚠️ *ADVERTENCIA ${MAX_WARNS}/${MAX_WARNS}*\n\n👤 @${global.getJidNum(target)}\n📝 Razón: ${reason}\n\n🔴 *Límite alcanzado — Expulsado del grupo*`,
                mentions: [`${global.getJidNum(target)}@s.whatsapp.net`]
            }, { quoted: m })

            try {
                await conn.groupParticipantsUpdate(m.chat, [target], 'remove')
            } catch (e) {
                return m.reply('❌ No se pudo expulsar al usuario.')
            }
            return
        }

        return conn.sendMessage(m.chat, {
            text: `⚠️ *ADVERTENCIA ${user.warn}/${MAX_WARNS}*\n\n👤 @${global.getJidNum(target)}\n📝 Razón: ${reason}\n\n${user.warn === MAX_WARNS - 1 ? '🔴 *¡Próxima advertencia = expulsión!*' : `⏳ Le quedan *${MAX_WARNS - user.warn}* advertencia(s)`}`,
            mentions: [`${global.getJidNum(target)}@s.whatsapp.net`]
        }, { quoted: m })
    }

    // === UNWARN ===
    if (/^unwarn$/i.test(command)) {
        const target = m.mentionedJid?.[0] || (m.quoted?.sender)
        if (!target) return m.reply(`✳️ Menciona o responde al usuario.\nUso: *${usedPrefix}unwarn @usuario*`)

        const user = global.db.data.users[target] || (global.db.data.users[target] = {})
        if (!Number.isFinite(user.warn)) user.warn = 0

        if (user.warn <= 0) return m.reply(`✅ @${global.getJidNum(target)} no tiene advertencias.`)

        user.warn -= 1

        return conn.sendMessage(m.chat, {
            text: `✅ Advertencia removida\n👤 @${global.getJidNum(target)}\n⚠️ Warns restantes: *${user.warn}/${MAX_WARNS}*`,
            mentions: [`${global.getJidNum(target)}@s.whatsapp.net`]
        }, { quoted: m })
    }

    // === RESETWARN ===
    if (/^(resetwarn|clearwarn)$/i.test(command)) {
        const target = m.mentionedJid?.[0] || (m.quoted?.sender)
        if (!target) return m.reply(`✳️ Menciona o responde al usuario.\nUso: *${usedPrefix}resetwarn @usuario*`)

        const user = global.db.data.users[target] || (global.db.data.users[target] = {})
        user.warn = 0

        return conn.sendMessage(m.chat, {
            text: `✅ Warns reseteadas para @${global.getJidNum(target)}`,
            mentions: [`${global.getJidNum(target)}@s.whatsapp.net`]
        }, { quoted: m })
    }

    // === WARNLIST ===
    if (/^(warnlist|warns)$/i.test(command)) {
        const users = global.db.data.users
        const memberIds = participants.map(p => p.id)

        const warned = memberIds
            .filter(jid => users[jid] && Number.isFinite(users[jid].warn) && users[jid].warn > 0)
            .sort((a, b) => (users[b].warn || 0) - (users[a].warn || 0))

        if (warned.length === 0) return m.reply('✅ No hay usuarios con advertencias en este grupo.')

        const list = warned.map((jid, i) =>
            `${i + 1}. @${global.getJidNum(jid)} — ⚠️ *${users[jid].warn}/${MAX_WARNS}*`
        ).join('\n')

        return conn.sendMessage(m.chat, {
            text: `⚠️ *LISTA DE ADVERTENCIAS*\n━━━━━━━━━━━━━━━━\n${list}\n━━━━━━━━━━━━━━━━\n📊 Total: ${warned.length} usuario(s)`,
            mentions: warned.map(jid => `${global.getJidNum(jid)}@s.whatsapp.net`)
        }, { quoted: m })
    }
}

handler.help = ['warn @user [razón]', 'unwarn @user', 'resetwarn @user', 'warnlist']
handler.tags = ['grupo']
handler.command = ['warn', 'unwarn', 'resetwarn', 'clearwarn', 'warnlist', 'warns']
handler.group = true

export default handler
