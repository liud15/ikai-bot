import { xpRange } from '../lib/levelling.js'
import { getRankLabel, getLevelRank } from '../lib/levelRanks.js'

// ───────────────────────────────────────────────────
//  economia-perfil.js
//  Muestra el perfil completo del usuario:
//  nivel, rango, XP, coins, banco, diamantes, rol,
//  salud, racha diaria, logros y estadísticas RPG.
// ───────────────────────────────────────────────────

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

let handler = async (m, { conn, command, usedPrefix }) => {
  // El usuario puede ver el propio perfil o de alguien mencionado
  const targetJid = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.sender
  const isOther = targetJid !== m.sender

  // Obtener datos
  const users = global.db.data.users
  if (!users[targetJid]) {
    return m.reply(`❌ Ese usuario no tiene datos registrados aún.`)
  }

  const user = users[targetJid]
  ensureUser(user)

  // Nombre e imagen de perfil
  const nombre = isOther
    ? (conn.getName(targetJid) || '@' + targetJid.split('@')[0])
    : (m.pushName || 'Aventurero')
  const foto = await conn.profilePictureUrl(targetJid, 'image').catch(_ => 'https://files.catbox.moe/xr2m6u.jpg')

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

  // Moneda global
  const m_coin = typeof moneda !== 'undefined' ? moneda : 'coins'

  // ─── TEXTO DEL PERFIL ────────────────────────────
  const texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃   👤 *PERFIL DE JUGADOR*
╰━━━━━━━━━━━━━━━━━━━━╯
🎴 *${nombre}*
${isOther ? `> Perfil consultado por @${m.sender.split('@')[0]}\n` : ''}
━━━━ 🏆 RANGO & NIVEL ━━━━
🎖️ *Rango:* ${rango}
📊 *Nivel:* ${nivel}
✨ *XP Total:* ${xpActual.toLocaleString()}
📈 *Progreso de nivel:*
   [${xpBar}] ${xpEnNivel}/${xpNecesario}
${nivel < nextMin ? `🔭 *Próximo rango:* ${nextRank.emoji} ${nextRank.title} (Nv. ${nextMin})` : ''}

━━━━ 💰 ECONOMÍA ━━━━
🪙 *Wallet:* ${user.coin.toLocaleString()} ${m_coin}
🏦 *Banco:* ${user.bank.toLocaleString()} / ${user.bankLimit.toLocaleString()}
💎 *Diamantes:* ${user.diamond}
📊 *Total:* ${(user.coin + user.bank).toLocaleString()} ${m_coin}

━━━━ ❤️ ESTADO ━━━━
❤️ *Salud:* [${healthBar}] ${user.health}/1000
🔥 *Racha diaria:* ${user.dailyStreak} día(s)
🏅 *Logros:* ${logrosCount} desbloqueado(s)

━━━━ 🎒 INVENTARIO ━━━━
${Object.keys(user.inventory).filter(k => user.inventory[k] > 0).length > 0
      ? Object.entries(user.inventory).filter(([, q]) => q > 0).map(([k, q]) => `📦 *${k}* ×${q}`).join('\n')
      : '_Inventario vacío_'}
`.trim()

  // Enviar con foto de perfil como thumbnail
  await conn.sendMessage(m.chat, {
    text: texto,
    contextInfo: {
      externalAdReply: {
        title: `🎖️ ${rankData.emoji} ${rankData.title}`,
        body: `Nivel ${nivel} • ${xpActual.toLocaleString()} XP`,
        thumbnailUrl: foto,
        sourceUrl: '',
        mediaType: 1,
        renderLargerThumbnail: true
      }
    },
    mentions: isOther ? [targetJid, m.sender] : []
  }, { quoted: m })
}

handler.help = ['perfil', 'perfil @usuario', 'profile']
handler.tags = ['economy']
handler.command = ['perfil', 'profile', 'stats', 'estadisticas']
handler.group = false   // funciona en grupos y privado

export default handler
