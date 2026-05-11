let handler = async (m, { conn, text, usedPrefix, command }) => {
  // mentionedJid es una Promise en simple.js, hay que esperar el resultado
  const mentionedJids = await m.mentionedJid
  const target = (mentionedJids && mentionedJids[0]) || m.quoted?.sender
  if (!target) return m.reply(`✳️ Menciona a quién enviar.\nEjemplo: *${usedPrefix + command} @usuario 50*`)
  if (target === m.sender) return m.reply('❌ No puedes transferirte a ti mismo.')

  // Extraer el último token numérico del texto (robusto ante menciones con LID)
  const tokens = text.trim().split(/\s+/)
  const amountText = [...tokens].reverse().find(t => /^\d+$/.test(t)) || ''
  const amount = Math.floor(Number(amountText))
  if (!Number.isFinite(amount) || amount < 1) return m.reply('✳️ Ingresa una cantidad válida mayor a 0.')

  const sender = global.db.data.users[m.sender]
  const receiver = global.db.data.users[target] || (global.db.data.users[target] = {})

  sender.coin = Number.isFinite(sender.coin) ? sender.coin : 0
  receiver.coin = Number.isFinite(receiver.coin) ? receiver.coin : 0

  if (sender.coin < amount) return m.reply('❌ No tienes coins suficientes en wallet.')

  const loading = await conn.sendMessage(m.chat, { text: '🔄 Realizando transferencia...' }, { quoted: m })

  sender.coin -= amount
  receiver.coin += amount

  const targetName = await conn.getName(target)
  let resolvedTarget = target
  if (target.includes('@lid') && typeof String.prototype.resolveLidToRealJid === 'function') {
      try { resolvedTarget = await String.prototype.resolveLidToRealJid.call(target, m.chat, conn); } catch(e) {}
  }
  
  await conn.sendMessage(m.chat, {
    text: `✅ Transferencia completada\n🪙 Enviado: *${amount} coins*\n👤 Destino: *@${targetName}*\n> 💰 Cartera: *${sender.coin}*`,
    mentions: [resolvedTarget],
    edit: loading.key
  })
}

handler.help = ['transfer @usuario <cantidad>']
handler.tags = ['economy']
handler.command = ['transfer', 'pay']
handler.group = true

export default handler