import { getRankLabel } from '../../lib/levelRanks.js'

function getUser(sender) {
  const user = global.db.data.users[sender]
  user.coin = Number.isFinite(user.coin) ? user.coin : 0
  user.bank = Number.isFinite(user.bank) ? user.bank : 0
  user.diamond = Number.isFinite(user.diamond) ? user.diamond : 0
  user.bankLimit = Number.isFinite(user.bankLimit) ? user.bankLimit : 5000
  user.bankInterestTime = Number.isFinite(user.bankInterestTime) ? user.bankInterestTime : Date.now()
  return user
}

const INTEREST_RATE = 0.01      // 1%
const INTERVAL_HOURS = 12       // Cada 12 horas
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000
const MAX_INTERVALS = 14        // Máximo 7 días de acumulación (14 * 12h = 168h)

function applyInterest(user) {
  let earned = 0
  if (user.bank > 0 && user.bankLimit > user.bank) {
    const timePassed = Date.now() - user.bankInterestTime
    if (timePassed >= INTERVAL_MS) {
      let intervalsPassed = Math.floor(timePassed / INTERVAL_MS)
      if (intervalsPassed > MAX_INTERVALS) intervalsPassed = MAX_INTERVALS

      let calculatedInterest = Math.floor(user.bank * (INTEREST_RATE * intervalsPassed))

      const spaceLeft = user.bankLimit - user.bank
      if (calculatedInterest > spaceLeft) calculatedInterest = spaceLeft

      if (calculatedInterest > 0) {
        user.bank += calculatedInterest
        earned = calculatedInterest
      }
      user.bankInterestTime += (intervalsPassed * INTERVAL_MS)
    }
  } else if (user.bank === 0 || user.bank >= user.bankLimit) {
    // Si no hay dinero o el banco ya está lleno, reiniciamos el contador para no acumular tiempo "fantasma"
    user.bankInterestTime = Date.now()
  }
  return earned
}

function parseAmount(input, max) {
  if (!input) return 0
  if (/^(all|todo)$/i.test(input)) return max
  const n = Number(input)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

let handler = async (m, { conn, command, text, usedPrefix }) => {
  const user = getUser(m.sender)

  // Aplicar interés pasivo antes de cualquier transacción
  const earnedInterest = applyInterest(user)
  let interestMsg = earnedInterest > 0 
    ? `\n\n*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n 💰 *INTERÉS ACUMULADO*\n\n ⌲ Se sumaron *+${earnedInterest.toLocaleString()}* ${moneda}\n    por el rendimiento de tus ahorros.\n*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*` 
    : ''

  if (/^(bal|balance|wallet|cartera)$/i.test(command)) {
    const total = user.coin + user.bank
    const nivel = Number.isFinite(user.level) ? user.level : 0
    const rango = getRankLabel(nivel)
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` 🏦 *ESTADO FINANCIERO* 🏦\n\n` +
      ` ⌲ *RECURSOS DISPONIBLES*\n` +
      `   ▸ Cartera : *${user.coin.toLocaleString()}* ${moneda}\n` +
      `   ▸ Banco   : *${user.bank.toLocaleString()} / ${user.bankLimit.toLocaleString()}* ${moneda}\n` +
      `   ▸ Diamantes: *${user.diamond.toLocaleString()}* ◆\n` +
      `   ▸ Total   : *${total.toLocaleString()}* ${moneda}\n\n` +
      ` ⌲ *PROGRESO & RANGO*\n` +
      `   ▸ Rango   : *${rango}*\n` +
      `   ▸ Experiencia: *${(Number.isFinite(user.exp) ? user.exp : 0).toLocaleString()} XP*\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*${interestMsg}`
    )
  }

  // --- Sistema de Mejoras (Upgrades) ---
  if (/^(upgrade|mejorar)$/i.test(command)) {
    const COST_PER_BLOCK = 8    // Diamantes por cada bloque
    const BLOCK_SIZE = 5000     // Coins por bloque

    // Si no hay texto, mostrar panel informativo
    if (!text || !text.trim()) {
      const maxAffordable = Math.floor(user.diamond / COST_PER_BLOCK)
      return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` 🏗️ *MEJORA DE BÓVEDA* 🏗️\n\n` +
        ` ⌲ *INFORMACIÓN*\n` +
        `   ▸ Bloque: *+${BLOCK_SIZE.toLocaleString()}* ${moneda}\n` +
        `   ▸ Costo : *${COST_PER_BLOCK}* ◆ por bloque\n` +
        `   ▸ Capacidad actual: *${user.bankLimit.toLocaleString()}* ${moneda}\n` +
        `   ▸ Tus diamantes: *${user.diamond.toLocaleString()}* ◆\n\n` +
        ` ⌲ *AMPLIACIÓN MÁXIMA*\n` +
        `   ▸ Puedes sumar hasta *+${(maxAffordable * BLOCK_SIZE).toLocaleString()}* ${moneda}\n\n` +
        `> ✧ Ejemplo: *${usedPrefix}upgrade 40000* ✧\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
      )
    }

    // Parsear la cantidad solicitada
    const requested = Math.floor(Number(text.trim()))
    if (!Number.isFinite(requested) || requested <= 0) {
      return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ⚠️ *CANTIDAD INVÁLIDA* ⚠️\n\n` +
        ` ⌲ Ingresa una cantidad válida\n` +
        `    de espacio para añadir.\n\n` +
        `> ✧ Ejemplo: *${usedPrefix}upgrade 40000* ✧\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
      )
    }

    // La cantidad debe ser múltiplo de BLOCK_SIZE, redondeamos al múltiplo superior
    const blocks = Math.ceil(requested / BLOCK_SIZE)
    const totalIncrease = blocks * BLOCK_SIZE
    const totalCost = blocks * COST_PER_BLOCK

    if (totalCost > user.diamond) {
      const maxAffordable = Math.floor(user.diamond / COST_PER_BLOCK)
      return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ❌ *FONDOS INSUFICIENTES* ❌\n\n` +
        ` ⌲ No tienes los diamantes necesarios.\n\n` +
        `   ▸ Solicitado: *+${totalIncrease.toLocaleString()}* ${moneda}\n` +
        `   ▸ Costo total: *${totalCost.toLocaleString()}* ◆\n` +
        `   ▸ Tus diamantes: *${user.diamond.toLocaleString()}* ◆\n\n` +
        `> ✧ Puedes ampliar hasta *+${(maxAffordable * BLOCK_SIZE).toLocaleString()}* ${moneda} ✧\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
      )
    }

    user.diamond -= totalCost
    user.bankLimit += totalIncrease

    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` 🏗️ *BÓVEDA MEJORADA* 🏗️\n\n` +
      ` ⌲ *DETALLES*\n` +
      `   ▸ Bloques: *${blocks.toLocaleString()}* (×${BLOCK_SIZE.toLocaleString()} c/u)\n` +
      `   ▸ Expansión: *+${totalIncrease.toLocaleString()}* ${moneda}\n` +
      `   ▸ Inversión: *-${totalCost.toLocaleString()}* ◆\n\n` +
      ` ⌲ *NUEVO ESTADO*\n` +
      `   ▸ Capacidad: *${user.bankLimit.toLocaleString()}* ${moneda}\n` +
      `   ▸ Diamantes: *${user.diamond.toLocaleString()}* ◆\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*${interestMsg}`
    )
  }

  const isDeposit = /^(deposit|dep|d)$/i.test(command)
  let maxPossible = isDeposit ? user.coin : user.bank

  // Si quiere depositar, su máximo permitido no puede superar el límite del banco
  if (isDeposit) {
    const spaceLeft = user.bankLimit - user.bank
    if (spaceLeft <= 0) {
      return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` 🛑 *BÓVEDA LLENA* 🛑\n\n` +
        ` ⌲ Has alcanzado el límite máximo\n` +
        `    de almacenamiento.\n\n` +
        `   ▸ Estado: *${user.bank.toLocaleString()} / ${user.bankLimit.toLocaleString()}* ${moneda}\n` +
        `> ✧ Usa *${usedPrefix}upgrade* para ampliar ✧\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
      )
    }
    if (maxPossible > spaceLeft) {
      maxPossible = spaceLeft // Limitar el depósito al espacio restante
    }
  }

  const amount = parseAmount(text, maxPossible)

  if (!amount || amount < 1) {
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` ⚠️ *CANTIDAD INVÁLIDA* ⚠️\n\n` +
      ` ⌲ Especifica la cantidad que\n` +
      `    deseas transaccionar.\n\n` +
      `> ✧ Ejemplo: *${usedPrefix + command} 1000* o *all* ✧\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  if (isDeposit && amount > user.coin) {
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` ❌ *FONDOS INSUFICIENTES* ❌\n\n` +
      ` ⌲ No cuentas con esa cantidad\n` +
      `    en tu cartera para depositar.\n\n` +
      `   ▸ En cartera: *${user.coin.toLocaleString()}* ${moneda}\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }
  if (!isDeposit && amount > user.bank) {
    return m.reply(
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
      ` ❌ *FONDOS INSUFICIENTES* ❌\n\n` +
      ` ⌲ No cuentas con esa cantidad\n` +
      `    guardada en el banco.\n\n` +
      `   ▸ En banco: *${user.bank.toLocaleString()}* ${moneda}\n` +
      `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
  }

  const loading = await conn.sendMessage(m.chat, { text: ' ˚₊‧ ✦ *PROCESANDO TRANSACCIÓN...* ✦ ‧₊˚' }, { quoted: m })

  if (isDeposit) {
    user.coin -= amount
    user.bank += amount
    await conn.sendMessage(m.chat, {
      text: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 🏦 *DEPÓSITO EXITOSO* 🏦\n\n` +
            ` ⌲ Has resguardado tus monedas\n` +
            `    de forma segura en la bóveda.\n\n` +
            ` ⌲ *MOVIMIENTO*\n` +
            `   ▸ Ingreso: *+${amount.toLocaleString()}* ${moneda}\n\n` +
            ` ⌲ *ESTADO ACTUAL*\n` +
            `   ▸ Cartera: *${user.coin.toLocaleString()}* ${moneda}\n` +
            `   ▸ Banco  : *${user.bank.toLocaleString()} / ${user.bankLimit.toLocaleString()}* ${moneda}\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*${interestMsg}`,
      edit: loading.key
    })
  } else {
    // Sistema de impuestos en el retiro (3%)
    const taxRate = 0.03
    const taxAmount = Math.floor(amount * taxRate)
    const finalAmount = amount - taxAmount

    user.bank -= amount
    user.coin += finalAmount

    await conn.sendMessage(m.chat, {
      text: `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 🏦 *RETIRO EXITOSO* 🏦\n\n` +
            ` ⌲ Has retirado fondos de tu\n` +
            `    cuenta bancaria a tu cartera.\n\n` +
            ` ⌲ *MOVIMIENTO*\n` +
            `   ▸ Retiro  : *+${finalAmount.toLocaleString()}* ${moneda}\n` +
            `   ▸ Impuesto: *-${taxAmount.toLocaleString()}* ${moneda} (3%)\n\n` +
            ` ⌲ *ESTADO ACTUAL*\n` +
            `   ▸ Cartera: *${user.coin.toLocaleString()}* ${moneda}\n` +
            `   ▸ Banco  : *${user.bank.toLocaleString()} / ${user.bankLimit.toLocaleString()}* ${moneda}\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*${interestMsg}`,
      edit: loading.key
    })
  }
}

handler.help = ['balance', 'deposit <cantidad|all>', 'withdraw <cantidad|all>', 'upgrade (banco)']
handler.tags = ['economy']
handler.command = ['bal', 'balance', 'wallet', 'cartera', 'deposit', 'dep', 'd', 'withdraw', 'wd', "retirar", 'upgrade']
handler.group = true

export default handler