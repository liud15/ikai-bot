const ACHIEVEMENTS = [
  // COINS (Monedas)
  { id: 'coins_300', label: 'Inicio fuerte', check: u => u.coin >= 300, reward: 220 },
  { id: 'coins_1000', label: 'Ahorrador I', check: u => u.coin >= 1000, reward: 500 },
  { id: 'coins_3000', label: 'Ahorrador II', check: u => u.coin >= 3000, reward: 900 },
  { id: 'coins_10000', label: 'Ahorrador III', check: u => u.coin >= 10000, reward: 2000 },
  { id: 'coins_50000', label: 'Millonario', check: u => u.coin >= 50000, reward: 10000 },
  
  // BANK (Banco)
  { id: 'bank_5000', label: 'Inversor I', check: u => (u.bank || 0) >= 5000, reward: 1000 },
  { id: 'bank_20000', label: 'Inversor II', check: u => (u.bank || 0) >= 20000, reward: 4000 },

  // LEVEL (Nivel)
  { id: 'level_5', label: 'Novato', check: u => u.level >= 5, reward: 200 },
  { id: 'level_10', label: 'Subiendo de nivel', check: u => u.level >= 10, reward: 320 },
  { id: 'level_25', label: 'Aventurero Experto', check: u => u.level >= 25, reward: 1000 },
  { id: 'level_50', label: 'Maestro', check: u => u.level >= 50, reward: 3000 },
  { id: 'level_100', label: 'Leyenda Viva', check: u => u.level >= 100, reward: 10000 },

  // STREAK (Racha diaria)
  { id: 'streak_5', label: 'Constancia diaria I', check: u => (u.dailyStreak || 0) >= 5, reward: 350 },
  { id: 'streak_15', label: 'Constancia diaria II', check: u => (u.dailyStreak || 0) >= 15, reward: 1500 },
  { id: 'streak_30', label: 'Adicto al bot', check: u => (u.dailyStreak || 0) >= 30, reward: 5000 },

  // DIAMONDS (Diamantes)
  { id: 'diamond_10', label: 'Coleccionista I', check: u => (u.diamond || 0) >= 10, reward: 700 },
  { id: 'diamond_50', label: 'Coleccionista II', check: u => (u.diamond || 0) >= 50, reward: 3000 },
  { id: 'diamond_100', label: 'Rey de los diamantes', check: u => (u.diamond || 0) >= 100, reward: 8000 },

  // HEALTH (Salud)
  { id: 'salud_1000', label: 'Salud de Hierro', check: u => (u.health || 0) >= 1000, reward: 500 }
]

function ensureUser(user) {
  user.coin = Number.isFinite(user.coin) ? user.coin : 0
  user.level = Number.isFinite(user.level) ? user.level : 0
  user.diamond = Number.isFinite(user.diamond) ? user.diamond : 0
  user.dailyStreak = Number.isFinite(user.dailyStreak) ? user.dailyStreak : 0
  user.achievements = user.achievements && typeof user.achievements === 'object' ? user.achievements : {}
}

let handler = async (m, { conn, command, text, usedPrefix }) => {
  const user = global.db.data.users[m.sender]
  ensureUser(user)

  if (/^logros$/i.test(command)) {
    const lines = ACHIEVEMENTS.map((a, i) => {
      const unlocked = a.check(user)
      const claimed = !!user.achievements[a.id]
      const status = claimed ? '✅ Cobrado' : unlocked ? '🟡 Disponible' : '🔒 Bloqueado'
      return `${i + 1}. *${a.label}*\n   Premio: ${a.reward} coins\n   Estado: ${status}`
    }).join('\n\n')

    return m.reply(`🏅 *Logros de economía*\n\n${lines}\n\nPara cobrar: *${usedPrefix}claimlogro <número>*`)
  }

  const idx = Math.floor(Number(text)) - 1
  if (!Number.isInteger(idx) || !ACHIEVEMENTS[idx]) {
    return m.reply(`✳️ Uso: *${usedPrefix}claimlogro <número>*\nEjemplo: *${usedPrefix}claimlogro 1*`)
  }

  const a = ACHIEVEMENTS[idx]
  if (user.achievements[a.id]) return m.reply('✅ Ese logro ya fue cobrado.')
  if (!a.check(user)) return m.reply('❌ Aún no cumples ese logro.')

  const loading = await conn.sendMessage(m.chat, { text: '🏅 Reclamando logro...' }, { quoted: m })

  user.achievements[a.id] = true
  user.coin += a.reward

  await conn.sendMessage(m.chat, {
    text: `🏆 *Logro reclamado*\n${a.label}\n🪙 Premio: *+${a.reward} coins*\n💰 Wallet: *${user.coin}*`,
    edit: loading.key
  })
}

handler.help = ['logros', 'claimlogro <número>']
handler.tags = ['economy']
handler.command = ['logros', 'achievements', 'claimlogro']
handler.group = true

export default handler