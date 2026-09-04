import { xpRange } from '../../lib/levelling.js'
import { getRankLabel, getLevelRank } from '../../lib/levelRanks.js'
import fetch from 'node-fetch'

// ───────────────────────────────────────────────────
//  economia-perfil.js
//  Muestra el perfil completo del usuario:
//  nivel, rango, XP, coins, banco, diamantes, rol,
//  salud, racha diaria, logros y estadísticas RPG.
// ───────────────────────────────────────────────────

const ITEM_NAMES = {
  pocion:            { name: 'Poción de Salud',   symbol: '✦' },
  pocion_s:          { name: 'Poción Superior',   symbol: '⋆' },
  mineral_carbon:    { name: 'Carbón',            symbol: '▪' },
  mineral_cobre:     { name: 'Cobre',             symbol: '◈' },
  mineral_hierro:    { name: 'Hierro',            symbol: '◈' },
  mineral_cuarzo:    { name: 'Cuarzo',            symbol: '◇' },
  mineral_plata:     { name: 'Plata',             symbol: '◈' },
  mineral_zafiro:    { name: 'Zafiro',            symbol: '◆' },
  mineral_rubi:      { name: 'Rubí',              symbol: '◆' },
  mineral_obsidiana: { name: 'Obsidiana Sagrada', symbol: '✦' }
}

function ensureUser(user) {
  user.coin = Number.isFinite(user.coin) ? user.coin : 0
  user.bank = Number.isFinite(user.bank) ? user.bank : 0
  user.bankLimit = Number.isFinite(user.bankLimit) ? user.bankLimit : 5000
  user.diamond = Number.isFinite(user.diamond) ? user.diamond : 0
  user.exp = Number.isFinite(user.exp) ? user.exp : 0
  user.level = Number.isFinite(user.level) ? user.level : 0
  user.health = Number.isFinite(user.health) ? user.health : 1000
  user.dailyStreak = Number.isFinite(user.dailyStreak) ? user.dailyStreak : 0
  user.inventory = user.inventory && typeof user.inventory === 'object' ? user.inventory : {}
  user.achievements = user.achievements && typeof user.achievements === 'object' ? user.achievements : {}
}

function buildXpBar(current, needed, length = 12) {
  const ratio = needed > 0 ? Math.min(1, current / needed) : 1
  const filled = Math.round(ratio * length)
  return '█'.repeat(filled) + '░'.repeat(length - filled)
}

function formatInventory(inv) {
  const items = Object.entries(inv || {}).filter(([, q]) => q > 0)
  if (items.length === 0) return '   _Mochila vacía..._'
  return items.map(([k, q]) => {
    const info = ITEM_NAMES[k] || { name: k, symbol: '▸' }
    return `   ${info.symbol} *${info.name}* · ×${q.toLocaleString()}`
  }).join('\n')
}

let handler = async (m, { conn, command, usedPrefix }) => {
  // El usuario puede ver el propio perfil o de alguien mencionado
  const targetJid = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.sender
  const isOther = targetJid !== m.sender

  // Obtener datos
  const users = global.db.data.users
  if (!users[targetJid]) {
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` ❌ *SIN REGISTRO* ❌\n\n` +
      ` ⌲ El usuario no tiene datos\n` +
      `    registrados en el sistema aún.\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  const user = users[targetJid]
  ensureUser(user)

  // Nombre e imagen de perfil
  const nombre = isOther
    ? (conn.getName(targetJid) || '@' + targetJid.split('@')[0])
    : (m.pushName || 'Aventurero')

  // Prioridad: foto personalizada del bot → foto de WhatsApp → fallback
  const customPP = user.customPP || null
  const foto = customPP
    ? customPP
    : await conn.profilePictureUrl(targetJid, 'image').catch(_ => 'https://files.catbox.moe/xr2m6u.jpg')

  // Datos de nivel y XP
  const nivel = user.level
  const rango = getRankLabel(nivel)
  const rankData = getLevelRank(nivel)
  const xpActual = user.exp

  // XP necesario para el siguiente rango (bloque siguiente)
  const nextMin = rankData.max + 1
  const nextRank = getLevelRank(nextMin)

  // XP para el siguiente NIVEL
  const xpInfo = xpRange(nivel, global.multiplier || 2)
  const xpNecesario = xpInfo.xp
  const xpEnNivel = Math.max(0, xpActual - xpInfo.min)
  const xpBar = buildXpBar(xpEnNivel, xpNecesario)

  // Barra de salud
  const healthBar = buildXpBar(user.health, 1000, 10)

  // Logros desbloqueados
  const logrosCount = Object.keys(user.achievements).length

  // Cumpleaños del usuario
  const MESES_PERFIL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  let cumpleStr = ''
  if (user.birthday) {
    const { day, month, year } = user.birthday
    const now   = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let next    = new Date(now.getFullYear(), month - 1, day)
    if (next < today) next.setFullYear(now.getFullYear() + 1)
    const diasFaltan = Math.round((next - today) / (1000 * 60 * 60 * 24))
    const mesNombre  = MESES_PERFIL[month - 1]
    const edadPart   = year ? ` · ${now.getFullYear() - year - (diasFaltan > 0 ? 1 : 0)} años` : ''
    const proximoPart = diasFaltan === 0
      ? ' ¡HOY!'
      : diasFaltan === 1
        ? ' (mañana)'
        : ` (en ${diasFaltan} días)`
    cumpleStr = `\n ⌲ Cumpleaños: *${String(day).padStart(2,'0')} ${mesNombre}*` +
                (year ? `/${year}` : '') + edadPart + proximoPart
  }

  // Moneda global
  const m_coin = typeof moneda !== 'undefined' ? moneda : 'coins'

  // ─── TEXTO DEL PERFIL ────────────────────────────
  const texto = `
*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*
 👤 *PERFIL DE JUGADOR* 👤

 ⌲ *${nombre}*
${isOther ? ` ⌲ Consultado por: @${m.sender.split('@')[0]}\n\n` : '\n'} ◈ *RANGO & NIVEL*\n` +
`   ▸ Rango   : *${rango}*\n` +
`   ▸ Nivel   : *${nivel}*\n` +
`   ▸ XP      : *${xpActual.toLocaleString()}*\n` +
`   ▸ Progreso: [${xpBar}] ${xpEnNivel.toLocaleString()}/${xpNecesario.toLocaleString()}\n` +
`${nivel < nextMin ? `   ▸ Próximo : *${nextRank.title}* (Nv. ${nextMin})\n` : ''}\n` +
` ◈ *ECONOMÍA*\n` +
`   ▸ Cartera   : *${user.coin.toLocaleString()}* ${m_coin}\n` +
`   ▸ Banco     : *${user.bank.toLocaleString()} / ${user.bankLimit.toLocaleString()}*\n` +
`   ▸ Diamantes : *${user.diamond.toLocaleString()}*\n` +
`   ▸ Total     : *${(user.coin + user.bank).toLocaleString()}* ${m_coin}\n\n` +
` ◈ *ESTADO*\n` +
`   ▸ Salud     : [${healthBar}] ${user.health.toLocaleString()}/1,000\n` +
`   ▸ Racha     : *${user.dailyStreak}* día(s)\n` +
`   ▸ Logros    : *${logrosCount}* desbloqueado(s)${cumpleStr}\n\n` +
` ◈ *INVENTARIO*\n` +
`${formatInventory(user.inventory)}\n\n` +
`> ✧ ${customPP ? 'Foto activa · #setperfil borrar' : '#setperfil para personalizar foto'}${user.birthday ? '' : ' · #cumple DD/MM para registrar fecha'} ✧\n` +
`*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`.trim()

  // Enviar con foto de perfil como imagen real
  let fotoBuffer = null
  try {
    const res = await fetch(foto)
    if (res.ok) fotoBuffer = Buffer.from(await res.arrayBuffer())
  } catch { /* si falla la foto, enviamos solo texto */ }

  if (fotoBuffer) {
    await conn.sendMessage(m.chat, {
      image: fotoBuffer,
      caption: texto,
      mentions: isOther ? [targetJid, m.sender] : []
    }, { quoted: m })
  } else {
    await conn.sendMessage(m.chat, {
      text: texto,
      mentions: isOther ? [targetJid, m.sender] : []
    }, { quoted: m })
  }
}

handler.help = ['perfil', 'perfil @usuario', 'profile']
handler.tags = ['economy']
handler.command = ['perfil', 'profile', 'stats', 'estadisticas']
handler.group = false   // funciona en grupos y privado

export default handler
