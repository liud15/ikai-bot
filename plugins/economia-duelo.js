// ╔══════════════════════════════════════════════════════════════╗
// ║  ⚔️  DUELO: PIEDRA PAPEL O TIJERA  — PREMIUM EDITION  ⚔️   ║
// ║  Apuesta hasta 100,000 coins y enfréntate a Ikai            ║
// ║  Sistema de rachas, combos y animaciones épicas              ║
// ╚══════════════════════════════════════════════════════════════╝

const MAX_BET = 100000
const MIN_BET = 10
const COOLDOWN_BASE = 10 * 1000        // 10 segundos base
const COOLDOWN_STREAK = 5 * 1000       // +5s por cada victoria consecutiva
const MAX_COOLDOWN = 60 * 1000         // Máximo 1 minuto
const TAX_THRESHOLD = 50000            // Apuestas mayores a esto pagan impuesto
const TAX_RATE = 0.05                  // 5% de impuesto sobre ganancias altas
const STREAK_BONUS_MULTIPLIER = 0.1    // +10% por cada victoria en racha (hasta +50%)
const MAX_STREAK_BONUS = 0.5           // Máximo +50%

const choices = ['piedra', 'papel', 'tijera']

const emojis = { piedra: '🪨', papel: '📄', tijera: '✂️' }

const bigEmojis = {
  piedra: '🪨💥',
  papel: '📄💨',
  tijera: '✂️⚡'
}

const aliases = {
  piedra: 'piedra', roca: 'piedra', rock: 'piedra', r: 'piedra',
  papel: 'papel', paper: 'papel', p: 'papel',
  tijera: 'tijera', tijeras: 'tijera', scissors: 'tijera', s: 'tijera', t: 'tijera'
}

// Frases dinámicas por resultado
const winPhrases = [
  '¡Movimiento maestro! Ikai no lo vio venir.',
  '¡Aplastante! Ikai se queda sin palabras.',
  '¡Victoria épica! Tu instinto fue superior.',
  '¡Demoledor! Ikai necesita recalcular.',
  '¡Jugada perfecta! La suerte te sonríe hoy.',
  '¡Imparable! Ikai está temblando.',
  '¡Qué poder! Ni Ikai pudo contigo.',
  '¡Genialidad pura! Eres un estratega nato.'
]

const losePhrases = [
  'Ikai leyó tu mente como un libro abierto.',
  'Un error costoso... Ikai no perdona.',
  'La derrota duele, pero el orgullo duele más.',
  'Ikai sonríe con malicia mientras cobras.',
  'Estrategia fallida... Ikai tenía la respuesta.',
  'Ouch. Ikai te destrozó sin piedad.',
  'Ikai te anticipó como si viera el futuro.',
  'Doloroso. Ikai baila sobre tu derrota.'
]

const tiePhrases = [
  '¡Mentes sincronizadas! Nadie gana esta ronda.',
  'Pensaron lo mismo... ¡Empate psíquico!',
  '¡Conexión cósmica! Mismo movimiento, mismo instante.',
  'Ni tú ni Ikai ceden... ¡Tablas!',
  '¡Impresionante! Los dos eligieron lo mismo.',
  'Telepatía en estado puro. ¡Empate!'
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function decide(player, bot) {
  if (player === bot) return 'tie'
  if (
    (player === 'piedra' && bot === 'tijera') ||
    (player === 'papel' && bot === 'piedra') ||
    (player === 'tijera' && bot === 'papel')
  ) return 'win'
  return 'lose'
}

function formatCoins(n) {
  return n.toLocaleString('es-ES')
}

function getStreakEmoji(streak) {
  if (streak >= 10) return '🌟👑'
  if (streak >= 7) return '💎🔥'
  if (streak >= 5) return '🔥🔥'
  if (streak >= 3) return '🔥'
  return ''
}

function getStreakTitle(streak) {
  if (streak >= 10) return '☄️ LEYENDA IMPARABLE'
  if (streak >= 7) return '⚡ DOMINADOR ABSOLUTO'
  if (streak >= 5) return '🔥 EN LLAMAS'
  if (streak >= 3) return '💪 RACHA CALIENTE'
  return ''
}

function buildLoadingScreen(playerChoice, playerName, bet) {
  const pEmoji = bigEmojis[playerChoice]
  const betLine = bet > 0
    ? `💰 Apuesta: *${formatCoins(bet)} coins*`
    : '🎮 Modo libre (sin apuesta)'

  return `╔════════════════════╗\n` +
    `║  ⚔️ *DUELO PPT — CARGANDO...*   ║\n` +
    `╚════════════════════╝\n\n` +
    `👤 *${playerName}*  ➜  ${pEmoji}\n` +
    `🤖 *Ikai*  ➜  🎲 _Calculando..._\n\n` +
    `${betLine}\n` +
    `▓▓▓▓▓▓▓░░░░░░░ _analizando..._`
}

function buildResult(playerChoice, botChoice, result, playerName, bet, user, streakInfo) {
  const pEmoji = bigEmojis[playerChoice]
  const bEmoji = bigEmojis[botChoice]

  let header = ''
  let resultIcon = ''
  let resultText = ''
  let phrase = ''
  let coinSection = ''
  let streakSection = ''
  let footer = ''

  if (result === 'win') {
    header = `╔════════════════════╗\n` +
      `║   🏆 *DUELO PPT — ¡VICTORIA!*  ║\n` +
      `╚════════════════════╝`
    resultIcon = '🏆✨'
    resultText = '*¡GANASTE EL DUELO!*'
    phrase = pick(winPhrases)

    if (bet > 0) {
      let netGain = streakInfo.totalGain
      let taxPaid = streakInfo.taxPaid
      coinSection = `\n💰 *Ganancia:* +${formatCoins(netGain)} coins`
      if (taxPaid > 0) {
        coinSection += `\n🏛️ _Impuesto arena (${(TAX_RATE * 100).toFixed(0)}%):_ -${formatCoins(taxPaid)} coins`
      }
      coinSection += `\n🪙 *Balance:* ${formatCoins(user.coin)} coins`
    }
  } else if (result === 'lose') {
    header = `╔════════════════════╗\n` +
      `║   💀 *DUELO PPT — DERROTA*     ║\n` +
      `╚════════════════════╝`
    resultIcon = '💀💔'
    resultText = '*PERDISTE EL DUELO*'
    phrase = pick(losePhrases)

    if (bet > 0) {
      coinSection = `\n💸 *Pérdida:* -${formatCoins(bet)} coins`
      coinSection += `\n🪙 *Balance:* ${formatCoins(user.coin)} coins`
    }
  } else {
    header = `╔════════════════════╗\n` +
      `║   🤝 *DUELO PPT — EMPATE*      ║\n` +
      `╚════════════════════╝`
    resultIcon = '🤝⚖️'
    resultText = '*¡EMPATE!*'
    phrase = pick(tiePhrases)
    if (bet > 0) {
      coinSection = `\n💰 _Nadie pierde coins_`
      coinSection += `\n🪙 *Balance:* ${formatCoins(user.coin)} coins`
    }
  }

  // Racha info
  const streak = user._pptStreak || 0
  if (streak >= 3) {
    const sEmoji = getStreakEmoji(streak)
    const sTitle = getStreakTitle(streak)
    const bonusPct = Math.min(streak * STREAK_BONUS_MULTIPLIER, MAX_STREAK_BONUS) * 100
    streakSection = `\n\n${sEmoji} *${sTitle}* — Racha: *${streak}* victorias`
    if (bet > 0 && result === 'win') {
      streakSection += `\n📈 _Bonus racha: +${bonusPct.toFixed(0)}% aplicado_`
    }
  }

  // Stats globales
  const totalGames = (user._pptWins || 0) + (user._pptLosses || 0) + (user._pptTies || 0)
  const winRate = totalGames > 0 ? (((user._pptWins || 0) / totalGames) * 100).toFixed(1) : '0.0'
  const bestStreak = user._pptBestStreak || 0

  footer = `\n\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
    `📊 *Estadísticas:*\n` +
    `▸ 🏅 Victorias: *${user._pptWins || 0}* | ❌ Derrotas: *${user._pptLosses || 0}* | 🤝 Empates: *${user._pptTies || 0}*\n` +
    `▸ 📈 Winrate: *${winRate}%* | 🔥 Mejor racha: *${bestStreak}*`

  return `${header}\n\n` +
    `👤 *${playerName}*  ➜  ${pEmoji}  *${playerChoice.toUpperCase()}*\n` +
    `🤖 *Ikai*  ➜  ${bEmoji}  *${botChoice.toUpperCase()}*\n\n` +
    `${resultIcon} ${resultText}\n` +
    `_"${phrase}"_` +
    `${coinSection}` +
    `${streakSection}` +
    `${footer}`
}

function buildHelpMenu(usedPrefix) {
  return `╔══════════════════════╗\n` +
    `║    ⚔️ *DUELO PPT — MENÚ*    ║\n` +
    `╚══════════════════════╝\n\n` +
    `Desafía a *Ikai* en un duelo de\n` +
    `Piedra, Papel o Tijera y apuesta\n` +
    `tus coins para ganar el doble.\n\n` +
    `🎮 *Cómo jugar:*\n` +
    `▸ *${usedPrefix}ppt piedra* — Sin apuesta\n` +
    `▸ *${usedPrefix}ppt papel 500* — Apostar 500\n` +
    `▸ *${usedPrefix}ppt tijera 50k* — Apostar 50,000\n` +
    `▸ *${usedPrefix}ppt piedra all* — Apostar todo\n` +
    `▸ *${usedPrefix}ppt stats* — Ver estadísticas\n\n` +
    `⚡ *Opciones:* piedra, papel, tijera\n` +
    `   _(alias: r, p, t, s, rock, paper...)_\n\n` +
    `💰 *Apuestas:*\n` +
    `▸ Mínima: *${formatCoins(MIN_BET)} coins*\n` +
    `▸ Máxima: *${formatCoins(MAX_BET)} coins*\n` +
    `▸ Usa *k* para miles (10k = 10,000)\n\n` +
    `🔥 *Rachas:* Gana varias seguidas\n` +
    `   para obtener bonus de hasta *+50%*\n\n` +
    `🏛️ *Impuesto:* Ganancias mayores a\n` +
    `   *${formatCoins(TAX_THRESHOLD)}* pagan *${(TAX_RATE * 100).toFixed(0)}%* de impuesto\n\n` +
    `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
    `_⚔️ ¿Te atreves a desafiar a Ikai?_`
}

function buildStatsScreen(user, playerName) {
  const wins = user._pptWins || 0
  const losses = user._pptLosses || 0
  const ties = user._pptTies || 0
  const total = wins + losses + ties
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0'
  const bestStreak = user._pptBestStreak || 0
  const currentStreak = user._pptStreak || 0
  const totalEarned = user._pptTotalEarned || 0
  const totalLost = user._pptTotalLost || 0
  const net = totalEarned - totalLost

  const streakEmoji = getStreakEmoji(currentStreak)
  const streakTitle = currentStreak >= 3 ? ` — ${getStreakTitle(currentStreak)}` : ''

  return `╔═══════════════════╗\n` +
    `║  📊 *ESTADÍSTICAS PPT*  ║\n` +
    `╚═══════════════════╝\n\n` +
    `👤 *${playerName}*\n\n` +
    `🎮 *Partidas:* ${total}\n` +
    `▸ 🏅 Victorias: *${wins}*\n` +
    `▸ ❌ Derrotas: *${losses}*\n` +
    `▸ 🤝 Empates: *${ties}*\n` +
    `▸ 📈 Winrate: *${winRate}%*\n\n` +
    `🔥 *Rachas:*\n` +
    `▸ Racha actual: *${currentStreak}* ${streakEmoji}${streakTitle}\n` +
    `▸ Mejor racha: *${bestStreak}* 👑\n\n` +
    `💰 *Economía PPT:*\n` +
    `▸ 📥 Total ganado: *${formatCoins(totalEarned)}* coins\n` +
    `▸ 📤 Total perdido: *${formatCoins(totalLost)}* coins\n` +
    `▸ ${net >= 0 ? '📈' : '📉'} Neto: *${net >= 0 ? '+' : ''}${formatCoins(net)}* coins\n\n` +
    `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
    `> _⚔️ ¡Sigue luchando para mejorar!_`
}

function parseBetAmount(betText, userCoins) {
  if (!betText || betText === '0') return 0

  if (/^(all|todo|max)$/i.test(betText)) {
    return Math.min(userCoins, MAX_BET)
  }

  // Soportar notación abreviada: 10k = 10000, 1.5k = 1500, 100k = 100000
  let cleaned = betText.toLowerCase().replace(/,/g, '')
  if (/^[\d.]+k$/i.test(cleaned)) {
    cleaned = String(Math.floor(parseFloat(cleaned) * 1000))
  }
  if (/^[\d.]+m$/i.test(cleaned)) {
    cleaned = String(Math.floor(parseFloat(cleaned) * 1000000))
  }

  const amount = Math.floor(Number(cleaned))
  if (!Number.isFinite(amount) || amount < 0) return -1
  return amount
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
  const userId = m.sender
  const user = global.db.data.users[userId]
  if (!user) return m.reply('❌ Error con tu cuenta. Intenta de nuevo más tarde.')
  if (!Number.isFinite(user.coin)) user.coin = 0

  // Inicializar stats si no existen
  if (!Number.isFinite(user._pptWins)) user._pptWins = 0
  if (!Number.isFinite(user._pptLosses)) user._pptLosses = 0
  if (!Number.isFinite(user._pptTies)) user._pptTies = 0
  if (!Number.isFinite(user._pptStreak)) user._pptStreak = 0
  if (!Number.isFinite(user._pptBestStreak)) user._pptBestStreak = 0
  if (!Number.isFinite(user._pptTotalEarned)) user._pptTotalEarned = 0
  if (!Number.isFinite(user._pptTotalLost)) user._pptTotalLost = 0
  if (!user._lastPpt) user._lastPpt = 0

  const input = (text || '').trim().toLowerCase()
  const playerName = m.pushName || 'Jugador'

  // ═══ SIN ARGUMENTOS / HELP ═══
  if (!input || input === 'help' || input === 'ayuda' || input === 'menu') {
    return m.reply(buildHelpMenu(usedPrefix))
  }

  // ═══ ESTADÍSTICAS ═══
  if (/^(stats?|estadisticas?|record|historial)$/i.test(input)) {
    return m.reply(buildStatsScreen(user, playerName))
  }

  // ═══ PARSEAR JUGADA Y APUESTA ═══
  const parts = input.split(/\s+/)
  const choiceRaw = parts[0]
  const betText = parts[1] || '0'

  const playerChoice = aliases[choiceRaw]
  if (!playerChoice) {
    return m.reply(
      `❌ *Opción inválida:* _${choiceRaw}_\n\n` +
      `Usa: *piedra*, *papel* o *tijera*\n` +
      `_(alias: r, p, t, rock, paper, scissors)_\n\n` +
      `Ejemplo: *${usedPrefix}ppt piedra 1000*`
    )
  }

  // ═══ COOLDOWN DINÁMICO ═══
  const now = Date.now()
  const streak = user._pptStreak || 0
  const dynamicCooldown = Math.min(COOLDOWN_BASE + (streak * COOLDOWN_STREAK), MAX_COOLDOWN)
  const elapsed = now - user._lastPpt

  if (elapsed < dynamicCooldown) {
    const remaining = Math.ceil((dynamicCooldown - elapsed) / 1000)
    const bar = buildCooldownBar(elapsed, dynamicCooldown)
    return m.reply(
      `⏳ *Cooldown activo*\n\n` +
      `${bar}\n` +
      `⏱️ Espera *${remaining}s* para jugar otra vez.\n` +
      (streak >= 3 ? `_🔥 Racha de ${streak}: cooldown incrementado_` : '')
    )
  }

  // ═══ CALCULAR APUESTA ═══
  let bet = parseBetAmount(betText, user.coin)

  if (bet === -1) {
    return m.reply(`❌ Cantidad inválida: *${betText}*\nUsa un número, "all", o notación como *10k*.`)
  }

  if (bet > 0) {
    if (bet < MIN_BET) {
      return m.reply(`⚠️ Apuesta mínima: *${formatCoins(MIN_BET)} coins*.\nTu apuesta: *${formatCoins(bet)}*`)
    }
    if (bet > MAX_BET) {
      return m.reply(
        `⚠️ *Apuesta máxima excedida*\n\n` +
        `▸ Tu apuesta: *${formatCoins(bet)}* coins\n` +
        `▸ Límite: *${formatCoins(MAX_BET)}* coins\n\n` +
        `_Reduce tu apuesta e intenta de nuevo._`
      )
    }
    if (bet > user.coin) {
      return m.reply(
        `❌ *Fondos insuficientes*\n\n` +
        `▸ Tu apuesta: *${formatCoins(bet)}* coins\n` +
        `▸ Tu balance: *${formatCoins(user.coin)}* coins\n` +
        `▸ Te faltan: *${formatCoins(bet - user.coin)}* coins`
      )
    }
  }

  // ═══ JUGADA DEL BOT ═══
  const botChoice = choices[Math.floor(Math.random() * 3)]
  const result = decide(playerChoice, botChoice)

  // ═══ PROCESAR RESULTADO ═══
  let streakInfo = { totalGain: 0, taxPaid: 0 }

  if (result === 'win') {
    user._pptWins++
    user._pptStreak++
    if (user._pptStreak > user._pptBestStreak) {
      user._pptBestStreak = user._pptStreak
    }

    if (bet > 0) {
      // Calcular bonus por racha
      const streakBonus = Math.min((user._pptStreak - 1) * STREAK_BONUS_MULTIPLIER, MAX_STREAK_BONUS)
      let grossGain = Math.floor(bet * (1 + streakBonus))

      // Aplicar impuesto si la ganancia supera el umbral
      let tax = 0
      if (grossGain > TAX_THRESHOLD) {
        tax = Math.floor(grossGain * TAX_RATE)
        grossGain -= tax
      }

      user.coin += grossGain
      user._pptTotalEarned += grossGain
      streakInfo.totalGain = grossGain
      streakInfo.taxPaid = tax
    }
  } else if (result === 'lose') {
    user._pptLosses++
    user._pptStreak = 0

    if (bet > 0) {
      user.coin = Math.max(0, user.coin - bet)
      user._pptTotalLost += bet
    }
  } else {
    user._pptTies++
    // Los empates no rompen la racha
  }

  user._lastPpt = now

  // ═══ ANIMACIÓN ═══
  const loadingText = buildLoadingScreen(playerChoice, playerName, bet)

  const { key } = await conn.sendMessage(m.chat, {
    text: loadingText
  }, { quoted: m })

  // Esperar 2 segundos para la tensión
  await new Promise(r => setTimeout(r, 2000))

  // ═══ RESULTADO FINAL ═══
  const finalText = buildResult(playerChoice, botChoice, result, playerName, bet, user, streakInfo)

  try {
    await conn.sendMessage(m.chat, { text: finalText, edit: key })
  } catch {
    await conn.sendMessage(m.chat, { text: finalText }, { quoted: m })
  }

  // ═══ REACCIONES ESPECIALES ═══
  try {
    if (result === 'win' && bet >= 10000) {
      await m.react('🏆')
    } else if (result === 'win' && user._pptStreak >= 5) {
      await m.react('🔥')
    } else if (result === 'lose' && bet >= 10000) {
      await m.react('💀')
    } else if (result === 'win') {
      await m.react('✅')
    } else if (result === 'lose') {
      await m.react('❌')
    } else {
      await m.react('🤝')
    }
  } catch {
    // Reacciones opcionales, no romper si fallan
  }
}

function buildCooldownBar(elapsed, total) {
  const progress = Math.floor((elapsed / total) * 10)
  const filled = '▓'.repeat(progress)
  const empty = '░'.repeat(10 - progress)
  return `${filled}${empty} ${Math.floor((elapsed / total) * 100)}%`
}

handler.help = ['ppt <piedra|papel|tijera> [apuesta]', 'ppt stats']
handler.tags = ['economy', 'juegos']
handler.command = ['ppt', 'rps', 'piedrapapeltijera', 'duelo']
handler.group = false

export default handler