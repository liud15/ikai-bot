import { WAMessageStubType } from '@whiskeysockets/baileys'
import { distributeInheritance, removeAllFamilyLinks, mention, ensureUser, getRealJid, resolveJid } from '../src/lib/family-utils.js'

let handler = m => m

handler.before = async function (m, { conn }) {
    if (!m.isGroup || !m.messageStubType) return false
    if (![WAMessageStubType.GROUP_PARTICIPANT_REMOVE, WAMessageStubType.GROUP_PARTICIPANT_LEAVE].includes(m.messageStubType)) return false

    const whoRaw = m.messageStubParameters?.[0]
    if (!whoRaw) return false

    const who = getRealJid(whoRaw)

    const user = global.db.data.users[who]
    if (!user) return false
    ensureUser(user)

    // Solo procesar si tiene familia
    if (!user.marry && !user.parents.length && !user.children.length) return false

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

    return false
}

export default handler
