// ─────────────────────────────────────────────────────────
//  economia-levelup.js
//  Permite subir de nivel manualmente usando XP acumulada.
//  Solo funciona cuando el autolevelup del grupo está OFF.
//
//  Comandos:
//    !levelup   — sube todos los niveles que el usuario pueda
// ─────────────────────────────────────────────────────────
import { canLevelUp, xpRange } from '../../lib/levelling.js'
import { getLevelRank } from '../../lib/levelRanks.js'

let handler = async (m, { conn, usedPrefix }) => {
  const chat = global.db.data.chats[m.chat]
  const user = global.db.data.users[m.sender]

  // ── Solo activo cuando autolevelup está DESACTIVADO ──
  if (chat.autolevelup) {
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` ⚠️ *SUBIDA AUTOMÁTICA* ⚠️\n\n` +
      ` ⌲ El ascenso de nivel automático\n` +
      `    está activado en este grupo.\n\n` +
      `   ▸ Los niveles se otorgan de forma\n` +
      `    automática al participar en el chat.\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  // ── Verificar si puede subir de nivel ───────────────
  if (!canLevelUp(user.level, user.exp, global.multiplier)) {
    const { max } = xpRange(user.level, global.multiplier)
    const falta   = max - (user.exp || 0)
    const rankData = getLevelRank(user.level)
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` 🔒 *EXPERIENCIA INSUFICIENTE* 🔒\n\n` +
      ` ⌲ No cuentas con suficiente XP\n` +
      `    para ascender al siguiente nivel.\n\n` +
      `   ▸ Rango actual : *${rankData.title}*\n` +
      `   ▸ Nivel actual : *${user.level.toLocaleString()}*\n` +
      `   ▸ XP acumulada : *${(user.exp || 0).toLocaleString()}*\n` +
      `   ▸ Te faltan    : *${falta.toLocaleString()}* XP\n\n` +
      `> ✧ Sigue conversando y participando para ganar la experiencia necesaria ✧\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  // ── Subir todos los niveles posibles ────────────────
  const before = user.level
  while (canLevelUp(user.level, user.exp, global.multiplier)) {
    user.level++
  }

  const rankAnterior = getLevelRank(before)
  const rankNuevo    = getLevelRank(user.level)

  // ── Recompensa cada 5 niveles ────────────────────────
  let recompensaMsg = ''
  if (Math.floor(user.level / 5) > Math.floor(before / 5)) {
    const monedas = Math.floor(Math.random() * 4) + 6   // 6–9
    const xpBonus = Math.floor(Math.random() * 5) + 6   // 6–10
    const curr = typeof moneda !== 'undefined' ? moneda : 'coins'
    user.coin += monedas
    user.exp  += xpBonus
    recompensaMsg =
      `\n\n ◈ *Bono de Hito (Cada 5 Niveles):*\n` +
      `   ▸ Monedas : *+${monedas.toLocaleString()}* ${curr}\n` +
      `   ▸ XP Extra  : *+${xpBonus.toLocaleString()}* XP`
  }

  await m.reply(
    `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
    ` ✨ *¡ASCENSO DE NIVEL!* ✨\n\n` +
    ` ⌲ Nivel anterior : *${before.toLocaleString()}* (${rankAnterior.title})\n` +
    ` ⌲ Nivel actual   : *${user.level.toLocaleString()}* (${rankNuevo.title})\n` +
    `   ▸ XP total     : *${(user.exp || 0).toLocaleString()}*` +
    recompensaMsg +
    `\n\n> ✧ _¡Has alcanzado un nuevo rango de poder!_ ✧\n` +
    `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
  )
}

handler.help    = ['levelup']
handler.tags    = ['economy']
handler.command = ['levelup', 'subirnivel', 'lvlup']

export default handler
