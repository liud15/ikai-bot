import { getRankLabel } from '../../lib/levelRanks.js'
import { proto } from '../../lib/simple.js'

const numberFormatter = new Intl.NumberFormat('es-ES')

const formatNumber = (value) => {
  const num = Number(value) || 0
  const abs = Math.abs(num)
  const compact = (divisor, suffix) =>
    `${(num / divisor).toFixed(1).replace(/\.0$/, '')} ${suffix}`

  if (abs >= 1_000_000_000) return compact(1_000_000_000, 'mil M')
  if (abs >= 1_000_000) return compact(1_000_000, 'M')
  if (abs >= 1_000) return compact(1_000, 'mil')
  return numberFormatter.format(num)
}

const CATEGORIES = {
  xp: {
    label: 'TOP EXPERIENCIA',
    emoji: '✨',
    key: (u) => Number(u.exp || 0),
    fmt: (v) => `${formatNumber(v)} XP`
  },
  level: {
    label: 'TOP NIVELES',
    emoji: '📊',
    key: (u) => Number(u.level || 0),
    fmt: (v) => `Nv. ${formatNumber(v)}`
  },
  coins: {
    label: 'TOP MILLONARIOS',
    emoji: '🪙',
    key: (u) => Number(u.coin || u.money || 0) + Number(u.bank || 0),
    fmt: (v) => `${formatNumber(v)} Coins`
  },
  diamantes: {
    label: 'TOP DIAMANTES',
    emoji: '💎',
    key: (u) => Number(u.diamond || u.limit || 0),
    fmt: (v) => `${formatNumber(v)} Diamantes`
  },
  salud: {
    label: 'TOP SALUD',
    emoji: '❤️',
    key: (u) => Number(u.health || 0),
    fmt: (v) => `${formatNumber(v)}/1000`
  },
  banco: {
    label: 'TOP BANQUEROS',
    emoji: '🏦',
    key: (u) => Number(u.bank || 0),
    fmt: (v) => `${formatNumber(v)} en banco`
  },
  racha: {
    label: 'TOP RACHA DIARIA',
    emoji: '🔥',
    key: (u) => Number(u.dailyStreak || 0),
    fmt: (v) => `${formatNumber(v)} días`
  },
  comandos: {
    label: 'TOP ACTIVOS',
    emoji: '⌨️',
    key: (u) => Number(u.commands || 0),
    fmt: (v) => `${formatNumber(v)} cmds`
  },
  carreras: {
    label: 'TOP PILOTOS',
    emoji: '🏎️',
    key: (u) => Number((u.carrera || {}).victorias || 0),
    fmt: (v) => `${formatNumber(v)} victorias`
  },
  apuestas: {
    label: 'TOP APOSTADORES',
    emoji: '🎰',
    key: (u) => {
      const slots = Number((u.slots || {}).juegos || 0)
      const ruleta = Number((u.ruleta || {}).juegos || 0)
      const dados = Number((u.dados || {}).juegos || 0)
      const carrera = Number((u.carrera || {}).juegos || 0)
      return slots + ruleta + dados + carrera
    },
    fmt: (v) => `${formatNumber(v)} partidas`
  },
  ganancias: {
    label: 'TOP GANANCIAS',
    emoji: '💰',
    key: (u) => {
      const slots = Number((u.slots || {}).gananciasTotal || 0)
      const ruleta = Number((u.ruleta || {}).gananciasTotal || 0)
      const dados = Number((u.dados || {}).gananciasTotal || 0)
      const carrera = Number((u.carrera || {}).gananciasTotal || 0)
      return slots + ruleta + dados + carrera
    },
    fmt: (v) => `${formatNumber(v)} Coins`
  },
  mineros: {
    label: 'TOP MINEROS',
    emoji: '⛏️',
    key: (u) => {
      const inventory = u.inventory || {}
      return Object.values(inventory).reduce(
        (total, amount) => total + Number(amount || 0),
        0
      )
    },
    fmt: (v) => `${formatNumber(v)} minerales`
  },
  ppt: {
    label: 'TOP PPT',
    emoji: '✊',
    key: (u) => Number(u._pptWins || 0),
    fmt: (v) => `${formatNumber(v)} victorias`
  },
  crime: {
    label: 'TOP CRIMINALES',
    emoji: '🔫',
    key: (u) => Number(u.crime || 0),
    fmt: (v) => `${formatNumber(v)} crímenes`
  },
  racha_ppt: {
    label: 'TOP RACHA PPT',
    emoji: '🏅',
    key: (u) => Number(u._pptBestStreak || 0),
    fmt: (v) => `${formatNumber(v)} seguidas`
  },
  banco_lim: {
    label: 'TOP LÍMITE BANCO',
    emoji: '🏧',
    key: (u) => Number(u.bankLimit || 0),
    fmt: (v) => `${formatNumber(v)} límite`
  }
}

const FILTER_NONZERO = [
  'salud',
  'banco',
  'racha',
  'comandos',
  'carreras',
  'apuestas',
  'ganancias',
  'mineros',
  'ppt',
  'crime',
  'racha_ppt',
  'banco_lim'
]

// ══════════════════════════════════════════════════════════════
// 📊 RICH RESPONSE TABLE: Ranking con tabla nativa
// ══════════════════════════════════════════════════════════════

const MEDALS = ['🥇', '🥈', '🥉']

function progressBar(value, max) {
  const pct = Math.min(value / Math.max(max, 1), 1)
  const filled = Math.round(pct * 8)
  return '█'.repeat(filled) + '░'.repeat(8 - filled)
}

function safeRankLabel(user) {
  try {
    return (
      getRankLabel(Number(user.level || 0)) ||
      `Nivel ${formatNumber(user.level || 0)}`
    )
  } catch {
    return `Nivel ${formatNumber(user.level || 0)}`
  }
}

async function sendRichRanking(conn, jid, category, input, rankedEntries, senderJid, quoted) {
  const lidmap = global.db.data.lidmap || {}
  const lidToPhone = {}
  for (const [lid, realJid] of Object.entries(lidmap)) {
    if (lid.endsWith('@lid')) lidToPhone[lid] = String(realJid).split('@')[0]
  }

  const maxVal = Math.max(1, ...rankedEntries.slice(0, 10).map(([, u]) => category.key(u)))

  // Construir filas del ranking
  const rows = rankedEntries.slice(0, 10).map(([entryJid, user], i) => {
    let name = user.name?.trim() || ''
    if (!name) {
      try { name = conn.getName(entryJid) || '' } catch { name = '' }
    }
    if (!name && entryJid.endsWith('@lid') && lidToPhone[entryJid]) {
      name = `+${lidToPhone[entryJid]}`
    }
    if (!name) name = entryJid.split('@')[0]

    // Truncar nombre
    const chars = [...name]
    const shortName = chars.length > 14 ? chars.slice(0, 13).join('') + '…' : name

    const rawVal = Number(category.key(user)) || 0
    const medal = MEDALS[i] || `#${i + 1}`
    const isMe = entryJid === senderJid
    const marker = isMe ? ' ◄ TÚ' : ''
    const rankTag = safeRankLabel(user)

    return {
      items: [medal, shortName + marker, category.fmt(rawVal)],
      isHeading: false
    }
  })

  // Posición del usuario
  const myIdx = rankedEntries.findIndex(([j]) => j === senderJid)
  const myPosText = myIdx !== -1
    ? `📍 Tu posición global: *#${myIdx + 1}*`
    : ''

  // Submensajes
  const submessages = [
    {
      messageType: 2, // TEXT
      messageText: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n ${category.emoji} *${category.label}*\n*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    },
    {
      messageType: 4, // TABLE
      tableMetadata: {
        title: `Top 10 — ${input.toUpperCase()}`,
        rows: [
          { items: ['#', 'Jugador', 'Puntuación'], isHeading: true },
          ...rows
        ]
      }
    }
  ]

  // Si hay posición del usuario, añadir texto
  if (myPosText) {
    submessages.push({
      messageType: 2,
      messageText: myPosText
    })
  }

  submessages.push({
    messageType: 2,
    messageText: `_${global.botname || 'IKAIBOT'} • Ranking Global_`
  })

  // Enviar via Rich Response
  const innerMessage = proto.Message.fromObject({
    richResponseMessage: {
      messageType: 1,
      submessages,
      contextInfo: {
        ...(quoted?.key?.id ? {
          stanzaId: quoted.key.id,
          participant: quoted.key.participant || quoted.key.remoteJid,
          quotedMessage: quoted.message
        } : {}),
        forwardingScore: 1,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
        forwardOrigin: 1
      }
    }
  })

  const fullMessage = proto.Message.fromObject({
    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
    botForwardedMessage: { message: innerMessage }
  })

  await conn.relayMessage(jid, fullMessage, { additionalNodes: [] })
}

// ══════════════════════════════════════════════════════════════
// 🎮 HANDLER
// ══════════════════════════════════════════════════════════════

let handler = async (m, { conn, text, usedPrefix }) => {
  const input = (text || '').trim().toLowerCase()

  if (!input || input === 'help') {
    const list = Object.entries(CATEGORIES)
      .map(
        ([key, category]) =>
          `  • *${usedPrefix}top ${key}* — ${category.emoji} ${category.label}`
      )
      .join('\n')

    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` 🏆 *RANKING GLOBAL* 🏆\n\n` +
      `${list}\n\n` +
      `> ✧ Ejemplo: *${usedPrefix}top coins* ✧\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  const category = CATEGORIES[input]
  if (!category) {
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` ❌ *CATEGORÍA INVÁLIDA* ❌\n\n` +
      ` ⌲ Opciones: ${Object.keys(CATEGORIES).join(', ')}\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  const allUsers = global.db.data.users || {}

  let entries = Object.entries(allUsers).filter(
    ([, user]) => user && typeof user === 'object'
  )

  if (FILTER_NONZERO.includes(input)) {
    entries = entries.filter(([, user]) => category.key(user) > 0)
  }

  entries.sort((a, b) => category.key(b[1]) - category.key(a[1]))

  const topUsers = entries.slice(0, 10)
  if (!topUsers.length) {
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` 𓭲 *RANKING VACÍO* 𓭲\n\n` +
      ` ⌲ No hay usuarios con datos\n` +
      `    en esta categoría todavía.\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  // 📊 Enviar tabla Rich Response
  await sendRichRanking(conn, m.chat, category, input, entries, m.sender, m)
}

handler.help = [
  'top [xp|level|coins|diamantes|salud|banco|racha|comandos|carreras|apuestas|ganancias|mineros|ppt|crime|racha_ppt|banco_lim]'
]
handler.tags = ['economy']
handler.command = ['top', 'ranking', 'rank', 'leaderboard']
handler.group = true

export default handler