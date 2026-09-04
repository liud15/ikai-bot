// ─────────────────────────────────────────────────────────
//  economia-tienda.js
//  Items con field='inventory' van al inventario del usuario.
//  Items con field='stat' se aplican directamente al stat.
// ─────────────────────────────────────────────────────────

const STORE = {
  pocion:   { price: 120,  type: 'inventory', key: 'pocion',   gain: 200,  label: 'Poción de Salud (+200 HP al usar)',   symbol: '✦' },
  pocion_s: { price: 800,  type: 'inventory', key: 'pocion_s', gain: 1000, label: 'Poción Superior (+1,000 HP al usar)', symbol: '⋆' },
  diamante: { price: 200,  type: 'stat',      key: 'diamond',  gain: 1,    label: 'Diamante (instantáneo)',              symbol: '◈' },
  xp:       { price: 60,   type: 'stat',      key: 'exp',      gain: 45,   label: 'Experiencia (+45 XP instantáneo)',    symbol: '✧' },
}

const SELL_PRICES = {
  mineral_carbon:    { price: 15,  label: 'Carbón',            symbol: '▪' },
  mineral_cobre:     { price: 20,  label: 'Cobre',             symbol: '◈' },
  mineral_hierro:    { price: 35,  label: 'Hierro',            symbol: '◈' },
  mineral_cuarzo:    { price: 60,  label: 'Cuarzo',            symbol: '◇' },
  mineral_plata:     { price: 90,  label: 'Plata',             symbol: '◈' },
  mineral_zafiro:    { price: 200, label: 'Zafiro',            symbol: '◆' },
  mineral_rubi:      { price: 250, label: 'Rubí',              symbol: '◆' },
  mineral_obsidiana: { price: 500, label: 'Obsidiana Sagrada', symbol: '✦' },
  pocion:            { price: 60,  label: 'Poción de Salud',   symbol: '✦' },
  pocion_s:          { price: 400, label: 'Poción Superior',   symbol: '⋆' }
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
      const item = Object.values(STORE).find(i => i.key === k) || SELL_PRICES[k]
      const sym = item ? item.symbol : '▸'
      return `   ${sym} *${k}* · ×${qty.toLocaleString()}`
    }).join('\n') || '   _Inventario vacío..._'
}

let handler = async (m, { conn, command, text, usedPrefix }) => {
  const user = global.db.data.users[m.sender]
  ensureUser(user)

  // ── MOSTRAR TIENDA ─────────────────────────────────────
  if (/^(shop|tienda)$/i.test(command)) {
    const catalog = Object.entries(STORE)
      .map(([name, item]) =>
        `   ${item.symbol} *${name}* · *${item.price.toLocaleString()}* coins\n    ╰┈➤ ${item.label}`)
      .join('\n\n')
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` 🛒 *TIENDA DE ÍTEMS* 🛒\n\n` +
      `${catalog}\n\n` +
      ` ◈ *Guía rápida:*\n` +
      `   ▸ Comprar      : *${usedPrefix}buy <item> [cant.]*\n` +
      `   ▸ Vender minas : *${usedPrefix}sell* (o *${usedPrefix}vender*)\n` +
      `   ▸ Inventario   : *${usedPrefix}inv*\n` +
      `   ▸ Usar ítem    : *${usedPrefix}usar <item>*\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  // ── VENDER ÍTEMS / MINERALES ───────────────────────────
  if (/^(vender|sell)$/i.test(command)) {
    const [rawName, rawQty] = (text || '').trim().split(/\s+/)
    const curr = typeof moneda !== 'undefined' ? moneda : 'coins'

    if (!rawName) {
      const catalog = Object.entries(SELL_PRICES)
        .map(([key, item]) => `   ${item.symbol} *${key}* · *${item.price.toLocaleString()}* coins (${item.label})`)
        .join('\n')
      return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ⚖️ *MERCADO DE VENTA* ⚖️\n\n` +
        `${catalog}\n\n` +
        ` ◈ *Cómo vender tus ítems:*\n` +
        `   ▸ Vender un ítem : *${usedPrefix}sell <item> [cant.]*\n` +
        `   ▸ Vender TODO    : *${usedPrefix}sell todo* (o *all*)\n` +
        `   ▸ Ver inventario : *${usedPrefix}inv*\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
      )
    }

    if (/^(todo|all)$/i.test(rawName)) {
      let totalGanado = 0
      let vendidos = []
      for (const [key, qty] of Object.entries(user.inventory || {})) {
        if (qty > 0 && SELL_PRICES[key]) {
          const ganancia = SELL_PRICES[key].price * qty
          totalGanado += ganancia
          vendidos.push(`   ${SELL_PRICES[key].symbol} *${SELL_PRICES[key].label}* · ×${qty.toLocaleString()} (+${ganancia.toLocaleString()} ${curr})`)
          delete user.inventory[key]
        }
      }
      if (vendidos.length === 0) {
        return m.reply(
          `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
          ` 🎒 *MOCHILA VACÍA* 🎒\n\n` +
          ` ⌲ No cuentas con ítems o minerales\n` +
          `    comerciables en tu inventario.\n\n` +
          `> ✧ Ir a minar : *${usedPrefix}minar* ✧\n` +
          `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
      }
      user.coin += totalGanado
      return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` 💰 *VENTA MASIVA EXITOSA* 💰\n\n` +
        ` ⌲ Ítems y minerales vendidos:\n` +
        `${vendidos.join('\n')}\n\n` +
        `   ▸ Total ganado  : *+${totalGanado.toLocaleString()}* ${curr}\n` +
        `   ▸ Nueva cartera : *${user.coin.toLocaleString()}* ${curr}\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
      )
    }

    // Vender ítem particular
    let itemKey = rawName.toLowerCase()
    if (!SELL_PRICES[itemKey] && SELL_PRICES[`mineral_${itemKey}`]) {
      itemKey = `mineral_${itemKey}`
    }

    if (!SELL_PRICES[itemKey]) {
      return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ❌ *ÍTEM NO COMERCIABLE* ❌\n\n` +
        ` ⌲ El ítem *${rawName}* no se puede\n` +
        `    vender en el mercado actual.\n\n` +
        `> ✧ Ver mercado : *${usedPrefix}sell* ✧\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
      )
    }

    const item = SELL_PRICES[itemKey]
    const enMochila = user.inventory[itemKey] || 0
    let qty = Math.max(1, Math.floor(Number(rawQty) || 1))
    if (/^(all|todo)$/i.test(rawQty)) qty = enMochila

    if (enMochila < qty || enMochila === 0) {
      return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ❌ *CANTIDAD INSUFICIENTE* ❌\n\n` +
        ` ⌲ No tienes suficientes unidades\n` +
        `    de este ítem para vender.\n\n` +
        `   ▸ Tienes   : *${enMochila.toLocaleString()}*\n` +
        `   ▸ Intentas : *${qty.toLocaleString()}*\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
      )
    }

    const ganancia = item.price * qty
    user.inventory[itemKey] -= qty
    if (user.inventory[itemKey] <= 0) delete user.inventory[itemKey]
    user.coin += ganancia

    const quedan = user.inventory[itemKey] || 0
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` 💰 *VENTA EXITOSA* 💰\n\n` +
      ` ⌲ Vendido  : *${item.symbol} ${item.label}*\n` +
      ` ⌲ Cantidad : *×${qty.toLocaleString()}*\n` +
      ` ⌲ Ganancia : *+${ganancia.toLocaleString()}* ${curr}\n\n` +
      `   ▸ En mochila : *×${quedan.toLocaleString()}*\n` +
      `   ▸ Cartera    : *${user.coin.toLocaleString()}* ${curr}\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  // ── COMPRAR ────────────────────────────────────────────
  const [rawName, rawQty] = (text || '').trim().split(/\s+/)
  if (!rawName || !STORE[rawName.toLowerCase()]) {
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` ❌ *ÍTEM NO ENCONTRADO* ❌\n\n` +
      ` ⌲ El ítem que intentas comprar no\n` +
      `    existe en el catálogo.\n\n` +
      `> ✧ Ver catálogo : *${usedPrefix}shop* ✧\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  const item = STORE[rawName.toLowerCase()]
  const qty  = Math.max(1, Math.floor(Number(rawQty) || 1))
  const cost = item.price * qty

  if (user.coin < cost) {
    const faltan = cost - user.coin
    const curr = typeof moneda !== 'undefined' ? moneda : 'coins'
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` ❌ *FONDOS INSUFICIENTES* ❌\n\n` +
      ` ⌲ No cuentas con saldo suficiente\n` +
      `    para completar esta transacción.\n\n` +
      `   ▸ Costo total : *${cost.toLocaleString()}* ${curr}\n` +
      `   ▸ Tu cartera  : *${user.coin.toLocaleString()}* ${curr}\n` +
      `   ▸ Te faltan   : *${faltan.toLocaleString()}* ${curr}\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  const loading = await conn.sendMessage(m.chat, { text: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n 🛒 *PROCESANDO COMPRA...*\n*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*` }, { quoted: m })

  user.coin -= cost
  const curr = typeof moneda !== 'undefined' ? moneda : 'coins'

  if (item.type === 'inventory') {
    // Guardar en inventario
    user.inventory[item.key] = (user.inventory[item.key] || 0) + qty
    const totalItem = user.inventory[item.key]
    await conn.sendMessage(m.chat, {
      text: 
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ✨ *COMPRA EXITOSA* ✨\n\n` +
        ` ⌲ Ítem      : *${item.symbol} ${rawName.toLowerCase()}*\n` +
        ` ⌲ Comprados : *×${qty.toLocaleString()}*\n` +
        ` ⌲ En mochila: *×${totalItem.toLocaleString()}*\n\n` +
        `   ▸ Gastado : *-${cost.toLocaleString()}* ${curr}\n` +
        `   ▸ Cartera : *${user.coin.toLocaleString()}* ${curr}\n\n` +
        `> ✧ Consúmelo usando *${usedPrefix}usar ${rawName.toLowerCase()}* ✧\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`,
      edit: loading.key
    })
  } else {
    // Aplicar stat directamente
    user[item.key] = (user[item.key] || 0) + item.gain * qty
    const totalGain = item.gain * qty
    await conn.sendMessage(m.chat, {
      text: 
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ✨ *COMPRA EXITOSA* ✨\n\n` +
        ` ⌲ Ítem      : *${item.symbol} ${rawName.toLowerCase()}*\n` +
        ` ⌲ Comprados : *×${qty.toLocaleString()}*\n` +
        ` ⌲ Beneficio : *+${totalGain.toLocaleString()}* (${item.key})\n\n` +
        `   ▸ Gastado : *-${cost.toLocaleString()}* ${curr}\n` +
        `   ▸ Cartera : *${user.coin.toLocaleString()}* ${curr}\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`,
      edit: loading.key
    })
  }
}

handler.help    = ['shop', 'buy <item> [cant.]', 'sell [item] [cant.]', 'sell todo']
handler.tags    = ['economy']
handler.command = ['shop', 'tienda', 'buy', 'comprar', 'sell', 'vender']
handler.group   = true

export default handler