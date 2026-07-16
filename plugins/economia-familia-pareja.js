import { getFamilyData, getUser, mention, setRequest, getRequest, linkCouple, unlinkCouple, deleteRequest, getRealJid, resolveJid } from '../src/lib/family-utils.js'

let handler = async (m, { conn, command, text, usedPrefix }) => {
    const senderJid = getRealJid(m.sender)
    const groupJid  = m.chat

    // ─── PAREJA ───────────────────────────────────────────────
    if (/^(pareja|casar|proponer)$/i.test(command)) {
        const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!targetRaw) return m.reply(`✳️ Usa: *${usedPrefix + command} @usuario*`)

        const target = getRealJid(targetRaw)
        if (target === senderJid) return m.reply('❌ No puedes emparejarte contigo mismo.')

        const me    = getFamilyData(senderJid, groupJid)
        const other = getFamilyData(target,    groupJid)

        if (me.marry)    return m.reply('❌ Ya tienes pareja en este grupo. Usa *#divorcio* para terminar tu relación.')
        if (other.marry) return m.reply('❌ Esa persona ya tiene pareja en este grupo.')

        // No emparejarse con tu hijo/padre en este grupo
        if (me.children.includes(target)) return m.reply('❌ No puedes emparejarte con tu hijo/a.')
        if (me.parents.includes(target))  return m.reply('❌ No puedes emparejarte con tu padre/madre.')

        setRequest('couple', target, senderJid)
        return conn.sendMessage(m.chat, {
            text: `💍 ${await mention(target, m)}, ${await mention(senderJid, m)} quiere formar pareja contigo.\n` +
                `Responde con *${usedPrefix}aceptarpareja* o *${usedPrefix}rechazarpareja*.\n` +
                `⏳ La solicitud expira en 5 minutos.`,
            mentions: [await resolveJid(target, m), await resolveJid(senderJid, m)]
        }, { quoted: m })
    }

    // ─── ACEPTAR PAREJA ──────────────────────────────────────
    if (/^aceptarpareja$/i.test(command)) {
        const req = getRequest('couple', senderJid)
        if (!req) return m.reply('❌ No tienes solicitudes de pareja pendientes (o ya expiró).')

        const reqFrom     = getRealJid(req.from)
        const fromUser    = getFamilyData(reqFrom,    groupJid)
        const receiverUser = getFamilyData(senderJid, groupJid)

        if (fromUser.marry || receiverUser.marry) {
            deleteRequest('couple', senderJid)
            return m.reply('❌ No se puede completar, una de las personas ya tiene pareja en este grupo.')
        }

        linkCouple(reqFrom, senderJid, groupJid)
        deleteRequest('couple', senderJid)

        return conn.sendMessage(m.chat, {
            text: `💞 ¡Nueva pareja!\n${await mention(reqFrom, m)} ❤️ ${await mention(senderJid, m)}`,
            mentions: [await resolveJid(reqFrom, m), await resolveJid(senderJid, m)]
        }, { quoted: m })
    }

    // ─── RECHAZAR PAREJA ─────────────────────────────────────
    if (/^rechazarpareja$/i.test(command)) {
        const req = getRequest('couple', senderJid)
        if (!req) return m.reply('❌ No tienes solicitudes de pareja pendientes.')
        deleteRequest('couple', senderJid)
        return m.reply('🚫 Solicitud de pareja rechazada.')
    }

    // ─── DIVORCIO ────────────────────────────────────────────
    if (/^divorcio$/i.test(command)) {
        const me = getFamilyData(senderJid, groupJid)
        if (!me.marry) return m.reply('❌ No tienes pareja registrada en este grupo.')
        const ex = unlinkCouple(senderJid, groupJid)
        return conn.sendMessage(m.chat, {
            text: `💔 Divorcio completado entre ${await mention(senderJid, m)} y ${await mention(ex, m)}.`,
            mentions: [await resolveJid(senderJid, m), await resolveJid(ex, m)]
        }, { quoted: m })
    }
}

handler.help = ['pareja @user', 'aceptarpareja', 'rechazarpareja', 'divorcio']
handler.tags = ['economy']
handler.command = ['pareja', 'casar', 'proponer', 'aceptarpareja', 'rechazarpareja', 'divorcio']
handler.group = true

export default handler
