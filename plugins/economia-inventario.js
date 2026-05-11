// ─────────────────────────────────────────────────────────
//  economia-inventario.js
//  Muestra el inventario del usuario y permite usar ítems.
//
//  Comandos:
//    !inventario  /  !inv       — ver inventario
//    !usar <item> [cantidad]    — usar un ítem del inventario
// ─────────────────────────────────────────────────────────

const MAX_HEALTH = 1000

// Definición de lo que hace cada ítem al usarse
const USABLES = {
  pocion: {
    label:   '🧪 Poción de Salud',
    emoji:   '🧪',
    use(user, qty) {
      const antes    = user.health
      const curado   = Math.min(qty * 200, MAX_HEALTH - user.health)
      user.health    = Math.min(MAX_HEALTH, user.health + qty * 200)
      return {
        ok: curado > 0,
        msg: curado > 0
          ? `> ❤️ Salud: *${antes}* → *${user.health}/${MAX_HEALTH}* (+${curado} HP)`
          : `> ❤️ Ya tienes la salud al máximo (*${user.health}/${MAX_HEALTH}*). No se consumió la poción.`
      }
    }
  },
  pocion_s: {
    label:   '💊 Poción Superior',
    emoji:   '💊',
    use(user, qty) {
      const antes    = user.health
      const curado   = Math.min(qty * 1000, MAX_HEALTH - user.health)
      user.health    = Math.min(MAX_HEALTH, user.health + qty * 1000)
      return {
        ok: curado > 0,
        msg: curado > 0
          ? `> ❤️ Salud: *${antes}* → *${user.health}/${MAX_HEALTH}* (+${curado} HP)`
          : `> ❤️ Ya tienes la salud al máximo (*${user.health}/${MAX_HEALTH}*). No se consumió la poción.`
      }
    }
  },
}

function ensureUser(user) {
  user.health    = Number.isFinite(user.health)  ? user.health    : MAX_HEALTH
  user.inventory = user.inventory && typeof user.inventory === 'object' ? user.inventory : {}
}

function buildInvText(user) {
  const inv = user.inventory || {}
  const lines = Object.entries(inv).filter(([, qty]) => qty > 0)
  if (lines.length === 0) return '_Tu inventario está vacío._'
  return lines.map(([key, qty]) => {
    const item = USABLES[key]
    const label = item ? item.label : `📦 ${key}`
    return `${item?.emoji || '📦'} *${key}* ×${qty} — ${label}`
  }).join('\n')
}

let handler = async (m, { conn, command, text, usedPrefix }) => {
  const user = global.db.data.users[m.sender]
  if (!user) return m.reply('❌ No tienes datos registrados.')
  ensureUser(user)

  // ── VER INVENTARIO ─────────────────────────────────────
  if (/^(inventario|inv|mochila|bag)$/i.test(command)) {
    const invText = buildInvText(user)
    return m.reply(
      `🎒 *Tu Inventario*\n\n${invText}\n\n` +
      `Usa *${usedPrefix}usar <item> [cantidad]* para consumir un ítem.\n` +
      `Ej: *${usedPrefix}usar pocion 2*`
    )
  }

  // ── USAR ÍTEM ──────────────────────────────────────────
  const parts    = (text || '').trim().split(/\s+/)
  const itemKey  = (parts[0] || '').toLowerCase()
  const qty      = Math.max(1, Math.floor(Number(parts[1]) || 1))

  if (!itemKey) {
    return m.reply(
      `✳️ Especifica un ítem.\nEjemplo: *${usedPrefix}usar pocion*\n\n` +
      `Ver inventario: *${usedPrefix}inventario*`
    )
  }

  // Verificar que el ítem es usable
  const usable = USABLES[itemKey]
  if (!usable) {
    return m.reply(`❌ El ítem *${itemKey}* no existe o no se puede usar.\nVer inventario: *${usedPrefix}inventario*`)
  }

  // Verificar que tiene el ítem en inventario
  const enInventario = user.inventory[itemKey] || 0
  if (enInventario < qty) {
    return m.reply(
      `❌ No tienes suficientes *${itemKey}*.\n` +
      `Tienes: *${enInventario}*\nNecesitas: *${qty}*\n\n` +
      `Cómpralos en *${usedPrefix}shop*.`
    )
  }

  // Aplicar el efecto
  const result = usable.use(user, qty)

  if (result.ok) {
    // Solo consumir si realmente tuvo efecto
    user.inventory[itemKey] = enInventario - qty
    if (user.inventory[itemKey] <= 0) delete user.inventory[itemKey]
  }

  const quedan = user.inventory[itemKey] || 0

  await m.reply(
    `${usable.emoji} *${usable.label} usada ×${result.ok ? qty : 0}*\n` +
    `${result.msg}\n` +
    `📦 Te quedan: *${quedan} ${itemKey}(s)*`
  )
}

handler.help    = ['inventario', 'usar <item> [cantidad]']
handler.tags    = ['economy']
handler.command = ['inventario', 'inv', 'mochila', 'bag', 'usar', 'use']
handler.group   = false  // funciona en grupo y privado

export default handler
