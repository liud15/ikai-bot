const DAILY_COOLDOWN = 24 * 60 * 60 * 1000
const STREAK_GRACE = 48 * 60 * 60 * 1000

import { getRankLabel } from '../lib/levelRanks.js'

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

function msToText(ms) {
  if (ms <= 0) return 'ahora'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

let handler = async (m, { conn }) => {
  const user = global.db.data.users[m.sender]
  const now = Date.now()

  if (!Number.isFinite(user.coin)) user.coin = 0
  if (!Number.isFinite(user.exp)) user.exp = 0
  if (!Number.isFinite(user.lastclaim)) user.lastclaim = 0
  if (!Number.isFinite(user.dailyStreak)) user.dailyStreak = 0

  const elapsed = now - user.lastclaim
  const remaining = DAILY_COOLDOWN - elapsed

  if (remaining > 0) {
    return m.reply(`Ya reclamaste tu recompensa diaria.\nVuelve en *${msToText(remaining)}*.`)
  }

  const loading = await conn.sendMessage(m.chat, {
    text: 'Procesando recompensa diaria...'
  }, { quoted: m })

  if (user.lastclaim === 0 || elapsed > STREAK_GRACE) {
    user.dailyStreak = 1
  } else {
    user.dailyStreak += 1
  }

  const base = rand(280, 420)
  const streakBonus = Math.min(1200, user.dailyStreak * 60)
  const reward = base + streakBonus

  // XP del daily: 80-150 base + 10 por día de racha (máx bonus 200 XP)
  const xpBase = rand(80, 150)
  const xpStreakBonus = Math.min(200, user.dailyStreak * 10)
  const xpGained = xpBase + xpStreakBonus
  const rango = getRankLabel(Number.isFinite(user.level) ? user.level : 1)

  user.coin += reward
  user.exp += xpGained
  user.lastclaim = now

  const text = `*Recompensa Diaria Reclamada*\n\n` +
    `Racha actual: ${user.dailyStreak} día(s)\n` +
    `Recompensa: +${reward} coins\n` +
    `> _*Wallet:* ${user.coin} coins_\n` +
    `> _*Rango:* ${rango}_`

  await conn.sendMessage(m.chat, { text, edit: loading.key })
}

handler.help = ['daily', 'diario']
handler.tags = ['economy']
handler.command = ['daily', 'diario']
handler.group = true

export default handler