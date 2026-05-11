import { distributeInheritance, removeAllFamilyLinks, mention, ensureUser, getRealJid, resolveJid } from '../src/lib/family-utils.js'

let handler = async (m, { conn, command, text, usedPrefix, isAdmin, isROwner }) => {
    // ─── HERENCIA (solo admins/owner) ────────────────────────
    if (!isAdmin && !isROwner) return m.reply('❌ Solo los administradores pueden ejecutar herencias.')

    const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
    if (!targetRaw) return m.reply(`✳️ Usa: *${usedPrefix}herencia @usuario*`)

    const target = getRealJid(targetRaw)

    const deadUser = global.db.data.users[target]
    if (!deadUser) return m.reply('❌ Usuario no encontrado en la base de datos.')
    ensureUser(deadUser)

    const summary = distributeInheritance(target)
    removeAllFamilyLinks(target)

    if (!summary.amount) return m.reply('ℹ️ No había herencia para repartir (sin coins o sin herederos válidos).')

    const resolvedMentions = await Promise.all([target, ...summary.distributed].map(j => resolveJid(j, m)))
    return conn.sendMessage(m.chat, {
        text: `⚰️ Herencia ejecutada para ${await mention(target, m)}\n` +
            `🪙 Monto repartido: *${summary.amount} coins*\n` +
            `👪 Herederos: ${(await Promise.all(summary.distributed.map(d => mention(d, m)))).join(', ')}`,
        mentions: resolvedMentions
    }, { quoted: m })
}

handler.help = ['herencia @user']
handler.tags = ['economy']
handler.command = ['herencia']
handler.group = true
handler.admin = true // Admins only plugin mapping

export default handler
