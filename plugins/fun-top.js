let handler = async (m, { conn, text, participants, command }) => {
    if (!text) return m.reply(`❀ Debes ingresar el tema para el top.\nEjemplo: *${command} gays* o *${command} lesbianas*`)
    
    let users = participants.map(u => conn.decodeJid(u.id))
    
    // Excluir al bot de la lista si es posible
    let botJid = conn.user.jid
    users = users.filter(u => u !== botJid)

    // Barajar aleatoriamente la lista de participantes
    let shuffled = users.sort(() => 0.5 - Math.random())
    
    // Seleccionar los primeros 10 o menos si el grupo es pequeño
    let topCount = Math.min(10, shuffled.length)
    let top = shuffled.slice(0, topCount)
    
    let txt = `🏆 *TOP ${topCount} ${text.toUpperCase()}* 🏆\n\n`
    
    for (let i = 0; i < top.length; i++) {
        txt += `*${i + 1}.* @${top[i].split('@')[0]}\n`
    }
    
    await conn.sendMessage(m.chat, { text: txt, mentions: top }, { quoted: m })
}

handler.help = ['top <texto>']
handler.tags = ['fun']
handler.command = ['top', 'top10']
handler.group = true

export default handler
