import { distributeInheritance, removeAllFamilyLinks, getFamilyData, mention, ensureUser, getRealJid, resolveJid } from '../../src/lib/family-utils.js'

let handler = async (m, { conn, command, text, usedPrefix, isAdmin, isROwner }) => {
    if (!isAdmin && !isROwner) return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ❌ *PERMISO DENEGADO* ❌\n\n` +
        ` ⌲ Solo los administradores del grupo\n` +
        `    pueden ejecutar la repartición de herencias.\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )

    const targetRaw = m.mentionedJid?.[0] || m.quoted?.sender || (text && text.replace(/[^0-9]/g, '').length >= 7 ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
    if (!targetRaw) return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` 📜 *EJECUTAR HERENCIA* 📜\n\n` +
        ` ⌲ Menciona o responde al mensaje del\n` +
        `    usuario para ejecutar su herencia.\n\n` +
        `> ✧ Ejemplo : *${usedPrefix}herencia @usuario* ✧\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )

    const target   = getRealJid(targetRaw)
    const groupJid = m.chat

    const deadUser = global.db.data.users[target]
    if (!deadUser) return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ❌ *USUARIO NO ENCONTRADO* ❌\n\n` +
        ` ⌲ El usuario especificado no existe\n` +
        `    en la base de datos de la economía.\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
    ensureUser(deadUser)

    const summary = distributeInheritance(target, groupJid)
    removeAllFamilyLinks(target, groupJid)

    if (!summary.amount) return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ⚠️ *SIN HERENCIA* ⚠️\n\n` +
        ` ⌲ No había fondos disponibles para\n` +
        `    repartir o no existen herederos en el grupo.\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )

    const resolvedMentions = await Promise.all([target, ...summary.distributed].map(j => resolveJid(j, m)))
    return conn.sendMessage(m.chat, {
        text: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 📜 *HERENCIA Y LEGADO* 📜\n\n` +
            ` ⌲ Legado de : ${await mention(target, m)}\n\n` +
            `   ▸ Total repartido : *${summary.amount.toLocaleString()}* coins\n` +
            `   ▸ Beneficiarios   : ${(await Promise.all(summary.distributed.map(d => mention(d, m)))).join(', ')}\n\n` +
            `> ✧ _Los lazos familiares perduran en el recuerdo._ ✧\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`,
        mentions: resolvedMentions
    }, { quoted: m })
}

handler.help = ['herencia @user']
handler.tags = ['economy']
handler.command = ['herencia']
handler.group = true
handler.admin = true

export default handler
