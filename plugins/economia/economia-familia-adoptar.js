import { getFamilyData, getUser, mention, setRequest, getRequest, deleteRequest, validateAdoption, linkParentChild, unlinkParentChild, unlinkCouple, removeAllFamilyLinks, getRealJid, resolveJid, ensureUser } from '../../src/lib/family-utils.js'

let handler = async (m, { conn, command, text, usedPrefix, isAdmin, isROwner }) => {
    const senderJid = getRealJid(m.sender)
    const groupJid  = m.chat

    // ─── ADOPTAR ─────────────────────────────────────────────
    if (/^(adoptar|adopcion)$/i.test(command)) {
        const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!targetRaw) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 📜 *PROPUESTA DE ADOPCIÓN* 📜\n\n` +
            ` ⌲ Menciona o responde al usuario que\n` +
            `    deseas adoptar y sumar a tu linaje.\n\n` +
            `> ✧ Ejemplo : *${usedPrefix + command} @usuario* ✧\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
        const target = getRealJid(targetRaw)

        const error = validateAdoption(senderJid, target, groupJid)
        if (error) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ❌ *ADOPCIÓN RESTRINGIDA* ❌\n\n` +
            ` ⌲ ${error.replace(/^[❌⚠️ℹ️✳️🚫✅]+\s*/, '')}\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )

        setRequest('adoption', target, senderJid)
        return conn.sendMessage(m.chat, {
            text: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                ` 💌 *SOLICITUD DE ADOPCIÓN* 💌\n\n` +
                ` ⌲ ${await mention(target, m)}, ${await mention(senderJid, m)} desea recibirte\n` +
                `    como hijo/a legítimo/a en su familia del grupo.\n\n` +
                `   ▸ Aceptar  : *${usedPrefix}aceptaradopcion*\n` +
                `   ▸ Rechazar : *${usedPrefix}rechazaradopcion*\n\n` +
                `> ✧ _La solicitud expira en 5 minutos._ ✧\n` +
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`,
            mentions: [await resolveJid(target, m), await resolveJid(senderJid, m)]
        }, { quoted: m })
    }

    // ─── ACEPTAR ADOPCIÓN ────────────────────────────────────
    if (/^aceptaradopcion$/i.test(command)) {
        const req = getRequest('adoption', senderJid)
        if (!req) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ⚠️ *SIN SOLICITUDES* ⚠️\n\n` +
            ` ⌲ No tienes solicitudes de adopción\n` +
            `    pendientes o el tiempo de espera ha expirado.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )

        const reqFrom = getRealJid(req.from)

        const error = validateAdoption(reqFrom, senderJid, groupJid)
        if (error) {
            deleteRequest('adoption', senderJid)
            return m.reply(
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                ` ❌ *ADOPCIÓN RESTRINGIDA* ❌\n\n` +
                ` ⌲ ${error.replace(/^[❌⚠️ℹ️✳️🚫✅]+\s*/, '')}\n` +
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
            )
        }

        linkParentChild(reqFrom, senderJid, groupJid)
        deleteRequest('adoption', senderJid)

        // Verificar si el padre adoptante tiene pareja en este grupo
        const adoptingParent = getFamilyData(reqFrom, groupJid)
        const partnerJid = adoptingParent.marry ? getRealJid(adoptingParent.marry) : null

        const allMentions = [await resolveJid(reqFrom, m), await resolveJid(senderJid, m)]
        let msgText = `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 👨‍👩‍👧‍👦 *ADOPCIÓN FORMALIZADA* 👨‍👩‍👧‍👦\n\n` +
            ` ⌲ ¡El linaje familiar crece!\n\n` +
            `   ▸ Progenitor : ${await mention(reqFrom, m)}\n` +
            `   ▸ Hijo / Hija : ${await mention(senderJid, m)}`

        if (partnerJid) {
            allMentions.push(await resolveJid(partnerJid, m))
            msgText += `\n   ▸ Progenitor : ${await mention(partnerJid, m)} (pareja)`
        }
        msgText += `\n\n> ✧ _Un nuevo vínculo ha sido sellado._ ✧\n*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`

        return conn.sendMessage(m.chat, { text: msgText, mentions: allMentions }, { quoted: m })
    }

    // ─── RECHAZAR ADOPCIÓN ───────────────────────────────────
    if (/^rechazaradopcion$/i.test(command)) {
        const req = getRequest('adoption', senderJid)
        if (!req) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ⚠️ *SIN SOLICITUDES* ⚠️\n\n` +
            ` ⌲ No tienes ninguna solicitud pendiente.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
        deleteRequest('adoption', senderJid)
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 💔 *ADOPCIÓN DECLINADA* 💔\n\n` +
            ` ⌲ Has rechazado la propuesta de adopción.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
    }

    // ─── DESHEREDAR (padre quita un hijo) ────────────────────
    if (/^desheredar$/i.test(command)) {
        const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!targetRaw) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 💔 *DESHEREDAR MIEMBRO* 💔\n\n` +
            ` ⌲ Menciona al hijo/a que deseas\n` +
            `    separar de tu linaje y testamento.\n\n` +
            `> ✧ Ejemplo : *${usedPrefix + command} @usuario* ✧\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
        const target = getRealJid(targetRaw)

        const me = getFamilyData(senderJid, groupJid)
        const hasChild = me.children.some(c => getRealJid(c) === target)
        if (!hasChild) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ⚠️ *VÍNCULO INEXISTENTE* ⚠️\n\n` +
            ` ⌲ Esa persona no figura como hijo/a\n` +
            `    en tu registro familiar de este grupo.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )

        unlinkParentChild(senderJid, target, groupJid)
        return conn.sendMessage(m.chat, {
            text: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                ` 💔 *VÍNCULO DISUELTO* 💔\n\n` +
                ` ⌲ Se ha ejecutado el desheredo.\n\n` +
                `   ▸ Progenitor : ${await mention(senderJid, m)}\n` +
                `   ▸ Ex-Hijo/a  : ${await mention(target, m)}\n\n` +
                `> ✧ _El lazo consanguíneo ha sido cortado._ ✧\n` +
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`,
            mentions: [await resolveJid(senderJid, m), await resolveJid(target, m)]
        }, { quoted: m })
    }

    // ─── EMANCIPAR (hijo se desvincula de sus padres) ────────
    if (/^emancipar$/i.test(command)) {
        const me = getFamilyData(senderJid, groupJid)
        if (!me.parents.length) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ⚠️ *INDEPENDENCIA* ⚠️\n\n` +
            ` ⌲ No tienes progenitores registrados en el grupo.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )

        const parentsList = [...me.parents]
        for (const p of parentsList) {
            unlinkParentChild(p, senderJid, groupJid)
        }

        const resolvedParents = await Promise.all(parentsList.map(p => resolveJid(p, m)))
        return conn.sendMessage(m.chat, {
            text: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                ` 🕊️ *EMANCIPACIÓN FAMILIAR* 🕊️\n\n` +
                ` ⌲ Has declarado tu total independencia.\n\n` +
                `   ▸ Emancipado : ${await mention(senderJid, m)}\n` +
                `   ▸ Progenitores : ${(await Promise.all(parentsList.map(p => mention(p, m)))).join(' y ')}\n\n` +
                `> ✧ _Ahora eres libre y tu propio líder._ ✧\n` +
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`,
            mentions: [await resolveJid(senderJid, m), ...resolvedParents]
        }, { quoted: m })
    }

    // ─── LIMPIAR FAMILIA (admin/owner elimina vínculos rotos) ───
    if (/^limpiarfamilia$/i.test(command)) {
        if (!isAdmin && !isROwner) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ❌ *PERMISO DENEGADO* ❌\n\n` +
            ` ⌲ Solo los administradores pueden ejecutar\n` +
            `    la limpieza del registro familiar.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )

        let groupMeta
        try {
            groupMeta = await conn.groupMetadata(m.chat)
        } catch {
            return m.reply(
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                ` ❌ *ERROR DE LECTURA* ❌\n\n` +
                ` ⌲ No se pudo obtener la lista de participantes.\n` +
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
            )
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

        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 🧹 *DEPURACIÓN FAMILIAR* 🧹\n\n` +
            ` ⌲ Limpieza completada con éxito.\n\n` +
            `   ▸ Vínculos rotos eliminados : *${cleaned.toLocaleString()}*\n` +
            `   ▸ Estado : _Árboles genealógicos actualizados_\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
    }

    // ─── DESVINCULAR por número (admin quita a alguien de una familia) ──
    if (/^desvincularfamilia$/i.test(command)) {
        if (!isAdmin && !isROwner) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ❌ *PERMISO DENEGADO* ❌\n\n` +
            ` ⌲ Solo los administradores pueden usar este comando.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
        const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
        if (!targetRaw) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 💔 *DESVINCULAR MIEMBRO* 💔\n\n` +
            ` ⌲ Menciona o escribe el número de la persona.\n\n` +
            `> ✧ Ejemplo : *${usedPrefix + command} @usuario* ✧\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
        const target = getRealJid(targetRaw)

        const targetFd = getFamilyData(target, groupJid)
        const hadLinks = targetFd.marry || targetFd.parents.length > 0 || targetFd.children.length > 0
        if (!hadLinks) return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ⚠️ *SIN LAZOS* ⚠️\n\n` +
            ` ⌲ El usuario no cuenta con vínculos en este grupo.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )

        removeAllFamilyLinks(target, groupJid)

        return conn.sendMessage(m.chat, {
            text: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                ` 🛡️ *DESVINCULACIÓN ADMINISTRATIVA* 🛡️\n\n` +
                ` ⌲ Un administrador ha disuelto todos los\n` +
                `    lazos familiares de ${await mention(target, m)} en el grupo.\n` +
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`,
            mentions: [await resolveJid(target, m)]
        }, { quoted: m })
    }
}

handler.help = ['adoptar @user', 'aceptaradopcion', 'rechazaradopcion', 'desheredar @user', 'emancipar', 'limpiarfamilia', 'desvincularfamilia @user']
handler.tags = ['economy']
handler.command = ['adoptar', 'adopcion', 'aceptaradopcion', 'rechazaradopcion', 'desheredar', 'emancipar', 'limpiarfamilia', 'desvincularfamilia']
handler.group = true

export default handler
