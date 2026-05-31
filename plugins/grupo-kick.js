var handler = async (m, { conn, participants, usedPrefix, command }) => {
    if (!m.mentionedJid[0] && !m.quoted) {
        return conn.reply(m.chat, `${emoji} Debes mencionar a un usuario para poder expulsarlo del grupo.`, m);
    }

    let user = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted.sender;

    const groupInfo = await conn.groupMetadata(m.chat).catch(_ => null);
    const ownerGroup = groupInfo?.owner || m.chat.split`-`[0] + '@s.whatsapp.net';
    const ownerBotJids = global.owner
        .map(v => Array.isArray(v) ? v[0] : v)
        .map(v => String(v || '').trim())
        .filter(Boolean)
        .map(v => v.endsWith('@lid') || v.endsWith('@s.whatsapp.net') ? v : v.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
    //const nn = conn.getName(m.sender);

    if (user === conn.user.jid) {
        return conn.reply(m.chat, `${emoji2} No puedo eliminar el bot del grupo.`, m);
    }

    if (user === ownerGroup) {
        return conn.reply(m.chat, `${emoji2} No puedo eliminar al propietario del grupo.`, m);
    }

    if (ownerBotJids.includes(user)) {
        return conn.reply(m.chat, `${emoji2} No puedo eliminar al propietario del bot.`, m);
    }

    await conn.groupParticipantsUpdate(m.chat, [user], 'remove');

//conn.reply(`${suitag}@s.whatsapp.net`, `${emoji} Un Admin Acabo De Eliminar Un Usuario En El Grupo:\n> ${groupMetadata.subject}.`, m, rcanal, );
};

handler.help = ['kick'];
handler.tags = ['grupo'];
handler.command = ['kick','echar','hechar','sacar','ban'];
handler.admin = true;
handler.group = true;
handler.botAdmin = true;

export default handler;
