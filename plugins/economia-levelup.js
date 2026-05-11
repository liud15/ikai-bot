// ─────────────────────────────────────────────────────────
//  economia-levelup.js
//  Permite subir de nivel manualmente usando XP acumulado.
//  Solo funciona cuando el autolevelup del grupo está OFF.
//
//  Comandos:
//    !levelup   — sube todos los niveles que el usuario pueda
// ─────────────────────────────────────────────────────────
import { canLevelUp, xpRange } from '../lib/levelling.js'
import { getRankLabel } from '../lib/levelRanks.js'

let handler = async (m, { conn, usedPrefix }) => {
  const chat = global.db.data.chats[m.chat]
  const user = global.db.data.users[m.sender]

  // ── Solo activo cuando autolevelup está DESACTIVADO ──
  if (chat.autolevelup) {
    return m.reply(
      `ℹ️ El subida de nivel automático está *activado* en este grupo.\n` +
      `Los niveles se asignan automáticamente al escribir mensajes.`
    )
  }

  // ── Verificar si puede subir de nivel ───────────────
  if (!canLevelUp(user.level, user.exp, global.multiplier)) {
    const { max } = xpRange(user.level, global.multiplier)
    const falta   = max - (user.exp || 0)
    return m.reply(
      `📊 *Nivel actual:* ${user.level}\n` +
      `✨ *XP actual:* ${(user.exp || 0).toLocaleString()}\n` +
      `🔒 Necesitas *${falta.toLocaleString()} XP* más para subir de nivel.\n\n` +
      `> Sigue participando para ganar XP.`
    )
  }

  // ── Subir todos los niveles posibles ────────────────
  const before = user.level
  while (canLevelUp(user.level, user.exp, global.multiplier)) {
    user.level++
  }

  const rankAnterior = getRankLabel(before)
  const rankNuevo    = getRankLabel(user.level)

  // ── Recompensa cada 5 niveles ────────────────────────
  let recompensaMsg = ''
  if (Math.floor(user.level / 5) > Math.floor(before / 5)) {
    const monedas = Math.floor(Math.random() * 4) + 6   // 6–9
    const xpBonus = Math.floor(Math.random() * 5) + 6   // 6–10
    user.coin += monedas
    user.exp  += xpBonus
    recompensaMsg =
      `\n\n🎁 *¡Recompensa de hito!*\n` +
      `  🪙 +${monedas} coins\n` +
      `  ✨ +${xpBonus} XP`
  }

  await m.reply(
    `*✿ ¡ F E L I C I D A D E S ! ✿*\n\n` +
    `✰ Nivel anterior » *${before}*\n` +
    `   🏷️ ${rankAnterior}\n` +
    `✰ Nivel actual   » *${user.level}*\n` +
    `   🏷️ ${rankNuevo}\n` +
    `✨ XP total » *${(user.exp || 0).toLocaleString()}*` +
    recompensaMsg +
    `\n\n> *\`¡Has alcanzado un Nuevo Nivel!\`*`
  )
}

handler.help    = ['levelup']
handler.tags    = ['economy']
handler.command = ['levelup', 'subirnivel', 'lvlup']

export default handler
