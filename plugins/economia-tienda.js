// ─────────────────────────────────────────────────────────
//  economia-tienda.js
//  Items con field='inventory' van al inventario del usuario.
//  Items con field='stat' se aplican directamente al stat.
// ─────────────────────────────────────────────────────────

const STORE = {
  pocion:   { price: 120,  type: 'inventory', key: 'pocion',   gain: 200,  label: '❤️ Poción de Salud (+200 HP al usar)',  emoji: '🧪' },
  pocion_s: { price: 800,  type: 'inventory', key: 'pocion_s', gain: 1000, label: '💊 Poción Superior (+1000 HP al usar)', emoji: '💊' },
  diamante: { price: 200,  type: 'stat',      key: 'diamond',  gain: 1,    label: '💎 Diamante (instantáneo)',             emoji: '💎' },
  xp:       { price: 60,   type: 'stat',      key: 'exp',      gain: 45,   label: '✨ XP (instantáneo, +45 XP)',          emoji: '✨' },
}

function ensureUser(user) {
  user.coin      = Number.isFinite(user.coin)      ? user.coin      : 0
  user.exp       = Number.isFinite(user.exp)        ? user.exp       : 0
  user.health    = Number.isFinite(user.health)     ? user.health    : 1000
  user.diamond   = Number.isFinite(user.diamond)    ? user.diamond   : 0
  user.inventory = user.inventory && typeof user.inventory === 'object' ? user.inventory : {}
}

function invLine(user) {
  const inv = user.inventory || {}
  return Object.entries(inv)
    .filter(([, qty]) => qty > 0)
    .map(([k, qty]) => {
      const item = Object.values(STORE).find(i => i.key === k)
      return item ? `${item.emoji} *${k}* ×${qty}` : `📦 *${k}* ×${qty}`
    }).join('\n') || '_Inventario vacío_'
}

let handler = async (m, { conn, command, text, usedPrefix }) => {
  const user = global.db.data.users[m.sender]
  ensureUser(user)

  // ── MOSTRAR TIENDA ─────────────────────────────────────
  if (/^(shop|tienda)$/i.test(command)) {
    const catalog = Object.entries(STORE)
      .map(([name, item]) =>
        `${item.emoji} *${name}* — ${item.price} coins\n   └ ${item.label}`)
      .join('\n')
    return m.reply(
      `🛒 *Tienda de economía*\n\n${catalog}\n\n` +
      `Uso: *${usedPrefix}buy <item> [cantidad]*\n` +
      `Ver inventario: *${usedPrefix}inventario*\n` +
      `Usar ítem: *${usedPrefix}usar <item> [cantidad]*`
    )
  }

  // ── COMPRAR ────────────────────────────────────────────
  const [rawName, rawQty] = (text || '').trim().split(/\s+/)
  if (!rawName || !STORE[rawName.toLowerCase()]) {
    return m.reply(`✳️ Item inválido.\nUsa *${usedPrefix}shop* para ver la lista.`)
  }

  const item = STORE[rawName.toLowerCase()]
  const qty  = Math.max(1, Math.floor(Number(rawQty) || 1))
  const cost = item.price * qty

  if (user.coin < cost) {
    return m.reply(`❌ Te faltan *${cost - user.coin} coins*.\nCosto total: *${cost}*.`)
  }

  const loading = await conn.sendMessage(m.chat, { text: '🧾 Confirmando compra...' }, { quoted: m })

  user.coin -= cost

  if (item.type === 'inventory') {
    // Guardar en inventario
    user.inventory[item.key] = (user.inventory[item.key] || 0) + qty
    await conn.sendMessage(m.chat, {
      text: `✅ *Compra realizada*\n${item.emoji} *${rawName.toLowerCase()} ×${qty}* → guardado en inventario\n🪙 Gastado: *${cost}*\n💰 Wallet: *${user.coin}*\n\n📦 Usa *${usedPrefix}usar ${rawName.toLowerCase()}* para consumirlo.`,
      edit: loading.key
    })
  } else {
    // Aplicar stat directamente
    user[item.key] = (user[item.key] || 0) + item.gain * qty
    await conn.sendMessage(m.chat, {
      text: `✅ *Compra realizada*\n${item.emoji} *${rawName.toLowerCase()} ×${qty}* → aplicado al instante\n🪙 Gastado: *${cost}*\n💰 Wallet: *${user.coin}*`,
      edit: loading.key
    })
  }
}

handler.help    = ['shop', 'buy <item> [cantidad]']
handler.tags    = ['economy']
handler.command = ['shop', 'tienda', 'buy', 'comprar']
handler.group   = true

export default handler