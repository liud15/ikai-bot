import { WAMessageStubType } from '@whiskeysockets/baileys'
import { distributeInheritance, removeAllFamilyLinks, mention, ensureUser, getRealJid, resolveJid } from '../src/lib/family-utils.js'

let handler = m => m

handler.before = async function (m, { conn }) {
    try {
        if (!m.isGroup || !m.messageStubType) return false
        if (![WAMessageStubType.GROUP_PARTICIPANT_REMOVE, WAMessageStubType.GROUP_PARTICIPANT_LEAVE].includes(m.messageStubType)) return false

        // messageStubParameters puede estar vacío o contener múltiples JIDs (en remociones masivas)
        const params = m.messageStubParameters || []
        if (!params.length) return false

        // Procesar todos los participantes que salieron (puede ser más de uno en kick masivo)
        for (const whoRaw of params) {
            if (!whoRaw) continue

            const who = getRealJid(whoRaw)
            if (!who) continue

            // Buscar en DB: intentar el JID tal cual y también buscar alias LID→PN
            let user = global.db.data.users[who]

            // Si no se encontró directamente, buscar en toda la DB por si tiene otro formato
            if (!user) {
                // Buscar si el who coincide con un JID mapeado (LID vs PN)
                const allJids = Object.keys(global.db.data.users)
                const matchedJid = allJids.find(j => {
                    const jClean = j.split(':')[0] + (j.includes('@') ? '@' + j.split('@')[1] : '')
                    const wClean = who.split(':')[0] + (who.includes('@') ? '@' + who.split('@')[1] : '')
                    return jClean === wClean
                })
                if (matchedJid) user = global.db.data.users[matchedJid]
            }

            // Si el usuario no tiene datos en DB, inicializar y revisar por vínculos rotos
            if (!user) {
                // Revisar si algún otro usuario tiene referencia a este JID como hijo/padre/pareja
                const affectedUsers = Object.entries(global.db.data.users).filter(([jid, u]) => {
                    if (!u) return false
                    ensureUser(u)
                    return (
                        (u.marry && getRealJid(u.marry) === who) ||
                        (u.parents || []).some(p => getRealJid(p) === who) ||
                        (u.children || []).some(c => getRealJid(c) === who)
                    )
                })

                if (affectedUsers.length === 0) continue // No tiene familia, saltar

                // Crear entrada temporal para poder usar removeAllFamilyLinks
                global.db.data.users[who] = {}
                user = global.db.data.users[who]
            }

            ensureUser(user)

            // Solo procesar si tiene familia
            const hasFamilyLinks = user.marry || user.parents.length > 0 || user.children.length > 0
            if (!hasFamilyLinks) continue

            const summary = distributeInheritance(who)
            removeAllFamilyLinks(who)

            if (summary.amount > 0) {
                const resolvedMentions = await Promise.all([who, ...summary.distributed].map(j => resolveJid(j, m)))
                await conn.sendMessage(m.chat, {
                    text: `⚰️ ${await mention(who, m)} salió del grupo y fue removido de la familia.\n` +
                        `🪙 Herencia repartida: *${summary.amount} coins*\n` +
                        `👪 Herederos: ${(await Promise.all(summary.distributed.map(d => mention(d, m)))).join(', ')}`,
                    mentions: resolvedMentions
                })
            } else {
                await conn.sendMessage(m.chat, {
                    text: `☠️ ${await mention(who, m)} salió del grupo y fue removido de la familia.`,
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
