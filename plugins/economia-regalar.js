// ─────────────────────────────────────────────────────────
//  economia-regalar.js
//  Permite regalar ítems del inventario a otro usuario.
//  También permite regalar coins.
//
//  Comandos:
//    !regalar @usuario pocion [cantidad]
//    !regalar @usuario coins 500
// ─────────────────────────────────────────────────────────

// Ítems que se pueden regalar (deben existir en el inventario)
const GIFTABLE_ITEMS = new Set(['pocion', 'pocion_s'])

const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutos entre regalos

function ensureUser(user) {
  user.coin      = Number.isFinite(user.coin)      ? user.coin      : 0
  user.inventory = user.inventory && typeof user.inventory === 'object' ? user.inventory : {}
  user.lastgift  = Number.isFinite(user.lastgift)  ? user.lastgift  : 0
}

function msToText(ms) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

let handler = async (m, { conn, text, command, usedPrefix }) => {

  // ── Resolución del destinatario ─────────────────────
  const targetJid = m.mentionedJid && m.mentionedJid[0]
    ? m.mentionedJid[0]
    : m.quoted?.sender

  if (!targetJid) {
    return m.reply(
      `🎁 *Regalo entre jugadores*\n\n` +
      `Uso: *${usedPrefix}regalar @usuario <ítem/coins> [cantidad]*\n\n` +
      `📦 Ítems regalables: *${[...GIFTABLE_ITEMS].join(', ')}*\n` +
      `🪙 También puedes regalar coins:\n` +
      `   *${usedPrefix}regalar @user coins 500*`
    )
  }

  if (targetJid === m.sender) {
    return m.reply('❌ No puedes regalarte a ti mismo.')
  }

  const users = global.db.data.users

  if (!users[targetJid]) {
    return m.reply(`❌ Ese usuario no tiene datos registrados aún.`)
  }

  const giver   = users[m.sender]
  const receiver = users[targetJid]
  ensureUser(giver)
  ensureUser(receiver)

  // ── Cooldown ────────────────────────────────────────
  const elapsed   = Date.now() - giver.lastgift
  const remaining = COOLDOWN_MS - elapsed
  if (remaining > 0) {
    return m.reply(`⏳ Puedes volver a regalar en *${msToText(remaining)}*.`)
  }

  // ── Parseo del argumento (ítem y cantidad) ──────────
  // El texto puede venir con mención integrada, la limpiamos
  const args = (text || '').trim()
    .replace(/@\d+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const rawItem = (args[0] || '').toLowerCase()
  const rawQty  = args[1] || '1'

  if (!rawItem) {
    return m.reply(
      `✳️ Especifica qué quieres regalar.\n` +
      `Ejemplo: *${usedPrefix}regalar @user pocion 2*\n` +
      `O coins: *${usedPrefix}regalar @user coins 300*`
    )
  }

  const qty = Math.max(1, Math.floor(Number(rawQty) || 1))

  // ── REGALO DE COINS ─────────────────────────────────
  if (rawItem === 'coins' || rawItem === 'monedas') {
    if (qty < 1) return m.reply('❌ La cantidad mínima es 1 coin.')
    if (giver.coin < qty) {
      return m.reply(`❌ No tienes suficientes coins.\nTienes: *${giver.coin}*\nIntentas regalar: *${qty}*`)
    }

    giver.coin    -= qty
    receiver.coin += qty
    giver.lastgift = Date.now()

    const targetName = conn.getName(targetJid) || ('@' + targetJid.split('@')[0])
    return conn.sendMessage(m.chat, {
      text:     `🎁 *Regalo enviado*\n🪙 *${qty} coins* → @${targetJid.split('@')[0]}\n💰 Tu wallet: *${giver.coin}*`,
      mentions: [targetJid, m.sender]
    }, { quoted: m })
  }

  // ── REGALO DE ÍTEM ──────────────────────────────────
  if (!GIFTABLE_ITEMS.has(rawItem)) {
    return m.reply(
      `❌ *${rawItem}* no es un ítem regalable.\n` +
      `Ítems disponibles: *${[...GIFTABLE_ITEMS].join(', ')}*\n` +
      `O regala coins: *${usedPrefix}regalar @user coins <cantidad>*`
    )
  }

  const enInventario = giver.inventory[rawItem] || 0
  if (enInventario < qty) {
    return m.reply(
      `❌ No tienes suficientes *${rawItem}*.\n` +
      `Tienes: *${enInventario}* | Intentas regalar: *${qty}*\n` +
      `Cómpralos en *${usedPrefix}shop*.`
    )
  }

  // Transferir
  giver.inventory[rawItem]    = enInventario - qty
  if (giver.inventory[rawItem] <= 0) delete giver.inventory[rawItem]
  receiver.inventory[rawItem] = (receiver.inventory[rawItem] || 0) + qty
  giver.lastgift              = Date.now()

  // Ítem emoji
  const EMOJIS = { pocion: '🧪', pocion_s: '💊' }
  const emoji  = EMOJIS[rawItem] || '📦'

  await conn.sendMessage(m.chat, {
    text:     `🎁 *¡Regalo enviado!*\n${emoji} *${rawItem} ×${qty}* → @${targetJid.split('@')[0]}\n\n📦 Tu inventario: *${giver.inventory[rawItem] || 0} ${rawItem}(s)* restante(s)`,
    mentions: [targetJid, m.sender]
  }, { quoted: m })
}

handler.help    = ['regalar @user <item/coins> [cantidad]']
handler.tags    = ['economy']
handler.command = ['regalar', 'gift', 'dar']
handler.group   = false  // grupo y privado

export default handler
