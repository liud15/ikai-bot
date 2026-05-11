import { getUser, mention, setRequest, getRequest, linkCouple, unlinkCouple, deleteRequest, getRealJid, resolveJid } from '../src/lib/family-utils.js'

let handler = async (m, { conn, command, text, usedPrefix }) => {
    const me = getUser(m.sender)

    // ─── PAREJA ───────────────────────────────────────────────
    if (/^(pareja|casar|proponer)$/i.test(command)) {
        const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!targetRaw) return m.reply(`✳️ Usa: *${usedPrefix + command} @usuario*`)

        const target = getRealJid(targetRaw)
        const sender = getRealJid(m.sender)
        if (target === sender) return m.reply('❌ No puedes emparejarte contigo mismo.')

        const other = getUser(target)

        if (me.marry) return m.reply('❌ Ya tienes pareja. Usa *#divorcio* para terminar tu relación.')
        if (other.marry) return m.reply('❌ Esa persona ya tiene pareja.')

        // No emparejarse con tu hijo/padre
        if (me.children.includes(target)) return m.reply('❌ No puedes emparejarte con tu hijo/a.')
        if (me.parents.includes(target)) return m.reply('❌ No puedes emparejarte con tu padre/madre.')

        setRequest('couple', target, sender)
        return conn.sendMessage(m.chat, {
            text: `💍 ${await mention(target, m)}, ${await mention(sender, m)} quiere formar pareja contigo.\n` +
                `Responde con *${usedPrefix}aceptarpareja* o *${usedPrefix}rechazarpareja*.\n` +
                `⏳ La solicitud expira en 5 minutos.`,
            mentions: [await resolveJid(target, m), await resolveJid(sender, m)]
        }, { quoted: m })
    }

    // ─── ACEPTAR PAREJA ──────────────────────────────────────
    if (/^aceptarpareja$/i.test(command)) {
        const sender = getRealJid(m.sender)
        const req = getRequest('couple', sender)
        if (!req) return m.reply('❌ No tienes solicitudes de pareja pendientes (o ya expiró).')

        const reqFrom = getRealJid(req.from)
        const fromUser = getUser(reqFrom)
        const receiverUser = getUser(sender)

        if (fromUser.marry || receiverUser.marry) {
            deleteRequest('couple', sender)
            return m.reply('❌ No se puede completar, una de las personas ya tiene pareja.')
        }

        linkCouple(reqFrom, sender)
        deleteRequest('couple', sender)

        return conn.sendMessage(m.chat, {
            text: `💞 ¡Nueva pareja!\n${await mention(reqFrom, m)} ❤️ ${await mention(sender, m)}`,
            mentions: [await resolveJid(reqFrom, m), await resolveJid(sender, m)]
        }, { quoted: m })
    }

    // ─── RECHAZAR PAREJA ─────────────────────────────────────
    if (/^rechazarpareja$/i.test(command)) {
        const sender = getRealJid(m.sender)
        const req = getRequest('couple', sender)
        if (!req) return m.reply('❌ No tienes solicitudes de pareja pendientes.')
        deleteRequest('couple', sender)
        return m.reply('🚫 Solicitud de pareja rechazada.')
    }

    // ─── DIVORCIO (solo matrimonio, NO toca padres/hijos) ────
    if (/^divorcio$/i.test(command)) {
        if (!me.marry) return m.reply('❌ No tienes pareja registrada.')
        const sender = getRealJid(m.sender)
        const ex = unlinkCouple(sender)
        return conn.sendMessage(m.chat, {
            text: `💔 Divorcio completado entre ${await mention(sender, m)} y ${await mention(ex, m)}.`,
            mentions: [await resolveJid(sender, m), await resolveJid(ex, m)]
        }, { quoted: m })
    }
}

handler.help = ['pareja @user', 'aceptarpareja', 'rechazarpareja', 'divorcio']
handler.tags = ['economy']
handler.command = ['pareja', 'casar', 'proponer', 'aceptarpareja', 'rechazarpareja', 'divorcio']
handler.group = true

export default handler
