import { getUser, mention, setRequest, getRequest, deleteRequest, validateAdoption, linkParentChild, unlinkParentChild, getRealJid, resolveJid } from '../src/lib/family-utils.js'

let handler = async (m, { conn, command, text, usedPrefix }) => {
    const me = getUser(m.sender)
    const senderJid = getRealJid(m.sender)

    // ─── ADOPTAR ─────────────────────────────────────────────
    if (/^(adoptar|adopcion)$/i.test(command)) {
        const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!targetRaw) return m.reply(`✳️ Usa: *${usedPrefix + command} @usuario*`)
        const target = getRealJid(targetRaw)

        const error = validateAdoption(senderJid, target)
        if (error) return m.reply(error)

        setRequest('adoption', target, senderJid)
        return conn.sendMessage(m.chat, {
            text: `👨‍👩‍👧 ${await mention(target, m)}, ${await mention(senderJid, m)} quiere adoptarte.\n` +
                `Responde con *${usedPrefix}aceptaradopcion* o *${usedPrefix}rechazaradopcion*.\n` +
                `⏳ La solicitud expira en 5 minutos.`,
            mentions: [await resolveJid(target, m), await resolveJid(senderJid, m)]
        }, { quoted: m })
    }

    // ─── ACEPTAR ADOPCIÓN ────────────────────────────────────
    if (/^aceptaradopcion$/i.test(command)) {
        const req = getRequest('adoption', senderJid)
        if (!req) return m.reply('❌ No tienes solicitudes de adopción pendientes (o ya expiró).')

        const reqFrom = getRealJid(req.from)

        // Re-validar por si cambió algo mientras esperaba
        const error = validateAdoption(reqFrom, senderJid)
        if (error) {
            deleteRequest('adoption', senderJid)
            return m.reply(error)
        }

        linkParentChild(reqFrom, senderJid)
        deleteRequest('adoption', senderJid)

        return conn.sendMessage(m.chat, {
            text: `✅ Adopción confirmada\n${await mention(reqFrom, m)} ahora es padre/madre de ${await mention(senderJid, m)}.`,
            mentions: [await resolveJid(reqFrom, m), await resolveJid(senderJid, m)]
        }, { quoted: m })
    }

    // ─── RECHAZAR ADOPCIÓN ───────────────────────────────────
    if (/^rechazaradopcion$/i.test(command)) {
        const req = getRequest('adoption', senderJid)
        if (!req) return m.reply('❌ No tienes solicitudes de adopción pendientes.')
        deleteRequest('adoption', senderJid)
        return m.reply('🚫 Solicitud de adopción rechazada.')
    }

    // ─── DESHEREDAR (padre quita un hijo) ────────────────────
    if (/^desheredar$/i.test(command)) {
        const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!targetRaw) return m.reply(`✳️ Usa: *${usedPrefix + command} @usuario*`)
        const target = getRealJid(targetRaw)

        if (!me.children.includes(target))
            return m.reply('❌ Esa persona no es tu hijo/a.')

        unlinkParentChild(senderJid, target)
        return conn.sendMessage(m.chat, {
            text: `💢 ${await mention(senderJid, m)} ha desheredado a ${await mention(target, m)}.`,
            mentions: [await resolveJid(senderJid, m), await resolveJid(target, m)]
        }, { quoted: m })
    }

    // ─── EMANCIPAR (hijo se desvincula de sus padres) ────────
    if (/^emancipar$/i.test(command)) {
        if (!me.parents.length) return m.reply('❌ No tienes padres registrados.')

        const parentsList = [...me.parents]
        for (const p of parentsList) {
            unlinkParentChild(p, senderJid)
        }

        const resolvedParents = await Promise.all(parentsList.map(p => resolveJid(p, m)))
        return conn.sendMessage(m.chat, {
            text: `🆓 ${await mention(senderJid, m)} se ha emancipado de ${(await Promise.all(parentsList.map(p => mention(p, m)))).join(' y ')}.`,
            mentions: [await resolveJid(senderJid, m), ...resolvedParents]
        }, { quoted: m })
    }
}

handler.help = ['adoptar @user', 'aceptaradopcion', 'rechazaradopcion', 'desheredar @user', 'emancipar']
handler.tags = ['economy']
handler.command = ['adoptar', 'adopcion', 'aceptaradopcion', 'rechazaradopcion', 'desheredar', 'emancipar']
handler.group = true

export default handler
