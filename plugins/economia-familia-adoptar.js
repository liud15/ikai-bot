import { getFamilyData, getUser, mention, setRequest, getRequest, deleteRequest, validateAdoption, linkParentChild, unlinkParentChild, unlinkCouple, removeAllFamilyLinks, getRealJid, resolveJid, ensureUser } from '../src/lib/family-utils.js'

let handler = async (m, { conn, command, text, usedPrefix, isAdmin, isROwner }) => {
    const senderJid = getRealJid(m.sender)
    const groupJid  = m.chat

    // ─── ADOPTAR ─────────────────────────────────────────────
    if (/^(adoptar|adopcion)$/i.test(command)) {
        const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!targetRaw) return m.reply(`✳️ Usa: *${usedPrefix + command} @usuario*`)
        const target = getRealJid(targetRaw)

        const error = validateAdoption(senderJid, target, groupJid)
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

        const error = validateAdoption(reqFrom, senderJid, groupJid)
        if (error) {
            deleteRequest('adoption', senderJid)
            return m.reply(error)
        }

        linkParentChild(reqFrom, senderJid, groupJid)
        deleteRequest('adoption', senderJid)

        // Verificar si el padre adoptante tiene pareja en este grupo
        const adoptingParent = getFamilyData(reqFrom, groupJid)
        const partnerJid = adoptingParent.marry ? getRealJid(adoptingParent.marry) : null

        const allMentions = [await resolveJid(reqFrom, m), await resolveJid(senderJid, m)]
        let msgText = `✅ *Adopción confirmada*\n${await mention(reqFrom, m)} ahora es padre/madre de ${await mention(senderJid, m)}.`

        if (partnerJid) {
            allMentions.push(await resolveJid(partnerJid, m))
            msgText += `\n👨‍👩‍👧 ${await mention(partnerJid, m)} también es su padre/madre como parte de la pareja.`
        }

        return conn.sendMessage(m.chat, { text: msgText, mentions: allMentions }, { quoted: m })
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

        const me = getFamilyData(senderJid, groupJid)
        const hasChild = me.children.some(c => getRealJid(c) === target)
        if (!hasChild) return m.reply('❌ Esa persona no es tu hijo/a en este grupo.')

        unlinkParentChild(senderJid, target, groupJid)
        return conn.sendMessage(m.chat, {
            text: `💢 ${await mention(senderJid, m)} ha desheredado a ${await mention(target, m)}.`,
            mentions: [await resolveJid(senderJid, m), await resolveJid(target, m)]
        }, { quoted: m })
    }

    // ─── EMANCIPAR (hijo se desvincula de sus padres) ────────
    if (/^emancipar$/i.test(command)) {
        const me = getFamilyData(senderJid, groupJid)
        if (!me.parents.length) return m.reply('❌ No tienes padres registrados en este grupo.')

        const parentsList = [...me.parents]
        for (const p of parentsList) {
            unlinkParentChild(p, senderJid, groupJid)
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

        let groupMeta
        try {
            groupMeta = await conn.groupMetadata(m.chat)
        } catch {
            return m.reply('❌ No se pudo obtener la lista de participantes del grupo.')
        }

        const memberSet = new Set()
        for (const p of (groupMeta.participants || [])) {
            if (p.id)  memberSet.add(getRealJid(p.id))
            if (p.lid) memberSet.add(getRealJid(p.lid))
        }

        let cleaned = 0
        const allUsers = global.db.data.users

        for (const [jid, userData] of Object.entries(allUsers)) {
            if (!userData) continue
            ensureUser(userData)
            if (!userData.family?.[groupJid]) continue

            const fd = userData.family[groupJid]

            // Limpiar padres que ya no están en el grupo
            for (const p of [...(fd.parents || [])]) {
                if (!memberSet.has(getRealJid(p))) {
                    unlinkParentChild(getRealJid(p), jid, groupJid)
                    cleaned++
                }
            }

            // Limpiar hijos que ya no están en el grupo
            for (const c of [...(fd.children || [])]) {
                if (!memberSet.has(getRealJid(c))) {
                    unlinkParentChild(jid, getRealJid(c), groupJid)
                    cleaned++
                }
            }

            // Limpiar pareja que ya no está en el grupo
            if (fd.marry && !memberSet.has(getRealJid(fd.marry))) {
                unlinkCouple(jid, groupJid)
                cleaned++
            }
        }

        return m.reply(`✅ Limpieza completada. Se eliminaron *${cleaned}* vínculos familiares rotos de usuarios que ya no están en el grupo.`)
    }

    // ─── DESVINCULAR por número (admin quita a alguien de una familia) ──
    if (/^desvincularfamilia$/i.test(command)) {
        if (!isAdmin && !isROwner) return m.reply('❌ Solo los administradores pueden usar este comando.')
        const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!targetRaw) return m.reply(`✳️ Usa: *${usedPrefix + command} @usuario* (menciona o escribe el número)`)
        const target = getRealJid(targetRaw)

        const targetFd = getFamilyData(target, groupJid)
        const hadLinks = targetFd.marry || targetFd.parents.length > 0 || targetFd.children.length > 0
        if (!hadLinks) return m.reply('ℹ️ Ese usuario no tiene vínculos familiares en este grupo.')

        removeAllFamilyLinks(target, groupJid)

        return conn.sendMessage(m.chat, {
            text: `🔗💔 ${await mention(target, m)} fue desvinculado de todos sus lazos familiares en este grupo por un administrador.`,
            mentions: [await resolveJid(target, m)]
        }, { quoted: m })
    }
}

handler.help = ['adoptar @user', 'aceptaradopcion', 'rechazaradopcion', 'desheredar @user', 'emancipar', 'limpiarfamilia', 'desvincularfamilia @user']
handler.tags = ['economy']
handler.command = ['adoptar', 'adopcion', 'aceptaradopcion', 'rechazaradopcion', 'desheredar', 'emancipar', 'limpiarfamilia', 'desvincularfamilia']
handler.group = true

export default handler
