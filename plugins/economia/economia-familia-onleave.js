import { WAMessageStubType } from '@whiskeysockets/baileys'
import { distributeInheritance, removeAllFamilyLinks, getFamilyData, mention, ensureUser, getRealJid, resolveJid } from '../../src/lib/family-utils.js'

let handler = m => m

handler.before = async function (m, { conn }) {
    try {
        if (!m.isGroup || !m.messageStubType) return false
        if (![WAMessageStubType.GROUP_PARTICIPANT_REMOVE, WAMessageStubType.GROUP_PARTICIPANT_LEAVE].includes(m.messageStubType)) return false

        const params = m.messageStubParameters || []
        if (!params.length) return false

        const groupJid = m.chat

        for (const whoRaw of params) {
            if (!whoRaw) continue

            const who = getRealJid(whoRaw)
            if (!who) continue

            // Buscar en DB
            let user = global.db.data.users[who]

            if (!user) {
                const allJids = Object.keys(global.db.data.users)
                const matchedJid = allJids.find(j => {
                    const jClean = j.split(':')[0] + (j.includes('@') ? '@' + j.split('@')[1] : '')
                    const wClean = who.split(':')[0] + (who.includes('@') ? '@' + who.split('@')[1] : '')
                    return jClean === wClean
                })
                if (matchedJid) user = global.db.data.users[matchedJid]
            }

            if (!user) {
                // Revisar si algún otro usuario tiene referencia a este JID en este grupo
                const affectedUsers = Object.entries(global.db.data.users).filter(([jid, u]) => {
                    if (!u) return false
                    ensureUser(u)
                    const fd = u.family?.[groupJid]
                    if (!fd) return false
                    return (
                        (fd.marry && getRealJid(fd.marry) === who) ||
                        (fd.parents || []).some(p => getRealJid(p) === who) ||
                        (fd.children || []).some(c => getRealJid(c) === who)
                    )
                })

                if (affectedUsers.length === 0) continue

                global.db.data.users[who] = {}
                user = global.db.data.users[who]
            }

            ensureUser(user)

            const fd = getFamilyData(who, groupJid)
            const hasFamilyLinks = fd.marry || fd.parents.length > 0 || fd.children.length > 0
            if (!hasFamilyLinks) continue

            const summary = distributeInheritance(who, groupJid)
            removeAllFamilyLinks(who, groupJid)

            if (summary.amount > 0) {
                const resolvedMentions = await Promise.all([who, ...summary.distributed].map(j => resolveJid(j, m)))
                await conn.sendMessage(m.chat, {
                    text: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                        ` 💔 *PARTIDA FAMILIAR* 💔\n\n` +
                        ` ⌲ ${await mention(who, m)} salió del grupo y\n` +
                        `    sus lazos familiares se han disuelto.\n\n` +
                        `   ▸ Herencia repartida : *${summary.amount.toLocaleString()}* coins\n` +
                        `   ▸ Herederos legales  : ${(await Promise.all(summary.distributed.map(d => mention(d, m)))).join(', ')}\n` +
                        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`,
                    mentions: resolvedMentions
                })
            } else {
                await conn.sendMessage(m.chat, {
                    text: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                        ` 💔 *PARTIDA FAMILIAR* 💔\n\n` +
                        ` ⌲ ${await mention(who, m)} salió del grupo y\n` +
                        `    sus lazos familiares se han disuelto.\n` +
                        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`,
                    mentions: [await resolveJid(who, m)]
                })
            }
        }
    } catch (e) {
        console.error('[familia-onleave] Error al procesar salida de grupo:', e)
    }

    return false
}

export default handler
