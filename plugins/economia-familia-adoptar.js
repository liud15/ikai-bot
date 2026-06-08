import { getUser, mention, setRequest, getRequest, deleteRequest, validateAdoption, linkParentChild, unlinkParentChild, unlinkCouple, removeAllFamilyLinks, getRealJid, resolveJid, ensureUser } from '../src/lib/family-utils.js'

let handler = async (m, { conn, command, text, usedPrefix, isAdmin, isROwner }) => {
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

        // Normalizar los hijos para comparar JIDs correctamente (compatibilidad LID/PN)
        const hasChild = me.children.some(c => getRealJid(c) === target)
        if (!hasChild)
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

    // ─── LIMPIAR FAMILIA (admin/owner elimina vínculos rotos) ───
    if (/^limpiarfamilia$/i.test(command)) {
        if (!isAdmin && !isROwner) return m.reply('❌ Solo los administradores pueden usar este comando.')

        // Obtener participantes actuales del grupo
        let groupMeta
        try {
            groupMeta = await conn.groupMetadata(m.chat)
        } catch {
            return m.reply('❌ No se pudo obtener la lista de participantes del grupo.')
        }

        const memberJids = new Set(
            (groupMeta.participants || []).map(p => getRealJid(p.id))
        )

        let cleaned = 0
        const allUsers = global.db.data.users

        for (const [jid, userData] of Object.entries(allUsers)) {
            if (!userData) continue
            ensureUser(userData)

            // Limpiar padres que ya no están en el grupo
            const validParents = (userData.parents || []).filter(p => {
                const pJid = getRealJid(p)
                return memberJids.has(pJid)
            })
            if (validParents.length !== (userData.parents || []).length) {
                const removed = (userData.parents || []).filter(p => !memberJids.has(getRealJid(p)))
                for (const rp of removed) {
                    unlinkParentChild(getRealJid(rp), jid)
                    cleaned++
                }
            }

            // Limpiar hijos que ya no están en el grupo
            const validChildren = (userData.children || []).filter(c => {
                const cJid = getRealJid(c)
                return memberJids.has(cJid)
            })
            if (validChildren.length !== (userData.children || []).length) {
                const removed = (userData.children || []).filter(c => !memberJids.has(getRealJid(c)))
                for (const rc of removed) {
                    unlinkParentChild(jid, getRealJid(rc))
                    cleaned++
                }
            }

            // Limpiar pareja que ya no está en el grupo
            if (userData.marry && !memberJids.has(getRealJid(userData.marry))) {
                unlinkCouple(jid)
                cleaned++
            }
        }

        return m.reply(`✅ Limpieza completada. Se eliminaron *${cleaned}* vínculos familiares rotos de usuarios que ya no están en el grupo.`)
    }

    // ─── DESVINCULAR por número (admin quita a alguien de una familia por número) ──
    if (/^desvincularfamilia$/i.test(command)) {
        if (!isAdmin && !isROwner) return m.reply('❌ Solo los administradores pueden usar este comando.')
        const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!targetRaw) return m.reply(`✳️ Usa: *${usedPrefix + command} @usuario* (menciona o escribe el número)`)
        const target = getRealJid(targetRaw)

        const targetUser = getUser(target)
        ensureUser(targetUser)

        const hadLinks = targetUser.marry || targetUser.parents.length > 0 || targetUser.children.length > 0
        if (!hadLinks) return m.reply('ℹ️ Ese usuario no tiene vínculos familiares registrados.')

        removeAllFamilyLinks(target)

        return conn.sendMessage(m.chat, {
            text: `🔗💔 ${await mention(target, m)} fue desvinculado de todos sus lazos familiares por un administrador.`,
            mentions: [await resolveJid(target, m)]
        }, { quoted: m })
    }
}

handler.help = ['adoptar @user', 'aceptaradopcion', 'rechazaradopcion', 'desheredar @user', 'emancipar', 'limpiarfamilia', 'desvincularfamilia @user']
handler.tags = ['economy']
handler.command = ['adoptar', 'adopcion', 'aceptaradopcion', 'rechazaradopcion', 'desheredar', 'emancipar', 'limpiarfamilia', 'desvincularfamilia']
handler.group = true

export default handler
