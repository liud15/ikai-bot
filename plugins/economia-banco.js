import { getRankLabel } from '../lib/levelRanks.js'

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
  let interestMsg = earnedInterest > 0 ? `\n\n> 📈 *¡Tus ahorros crecieron!*\n> Se han sumado *+${earnedInterest} ${moneda}* de interés pasivo.` : ''

  if (/^(bal|balance|wallet|cartera)$/i.test(command)) {
    const total = user.coin + user.bank
    const nivel = Number.isFinite(user.level) ? user.level : 0
    const rango = getRankLabel(nivel)
    return m.reply(`💳 *Tu economía*\n🪙 Wallet: *${user.coin}*\n🏦 Banco: *${user.bank} / ${user.bankLimit}*\n💎 Diamantes: *${user.diamond}*\n📊 Total en Coins: *${total}* ${moneda}\n\n🎖️ *Rango:* ${rango}\n✨ *XP:* ${Number.isFinite(user.exp) ? user.exp : 0}${interestMsg}`)
  }

  // --- Sistema de Mejoras (Upgrades) ---
  if (/^(upgrade|mejorar)$/i.test(command)) {
    const COST_PER_BLOCK = 8    // Diamantes por cada bloque
    const BLOCK_SIZE = 5000     // Coins por bloque

    // Si no hay texto, mostrar panel informativo
    if (!text || !text.trim()) {
      const maxAffordable = Math.floor(user.diamond / COST_PER_BLOCK)
      return m.reply(
        `🏦 *Mejora de Bóveda*\n\n` +
        `> 💎 Cada *${BLOCK_SIZE.toLocaleString()}* de capacidad cuesta *${COST_PER_BLOCK} 💎*\n` +
        `> 💳 Límite actual: *${user.bankLimit.toLocaleString()}* ${moneda}\n` +
        `> 💎 Tus diamantes: *${user.diamond}*\n` +
        `> 📦 Puedes ampliar hasta *+${(maxAffordable * BLOCK_SIZE).toLocaleString()}* de una sola vez\n\n` +
        `Usa: *${usedPrefix}upgrade <cantidad>*\n` +
        `Ejemplo: *${usedPrefix}upgrade 40000* ampliará *+40,000* por *${8 * 8} 💎*`
      )
    }

    // Parsear la cantidad solicitada
    const requested = Math.floor(Number(text.trim()))
    if (!Number.isFinite(requested) || requested <= 0) {
      return m.reply(`❌ Cantidad inválida. Escribe cuánto espacio quieres añadir.\nEjemplo: *${usedPrefix}upgrade 40000*`)
    }

    // La cantidad debe ser múltiplo de BLOCK_SIZE, redondeamos al múltiplo superior
    const blocks = Math.ceil(requested / BLOCK_SIZE)
    const totalIncrease = blocks * BLOCK_SIZE
    const totalCost = blocks * COST_PER_BLOCK

    if (totalCost > user.diamond) {
      const maxAffordable = Math.floor(user.diamond / COST_PER_BLOCK)
      return m.reply(
        `❌ *No tienes suficientes diamantes*\n\n` +
        `> Quieres: *+${totalIncrease.toLocaleString()}* → cuesta *${totalCost} 💎*\n` +
        `> Tienes: *${user.diamond} 💎*\n` +
        `> Máximo que puedes comprar ahora: *+${(maxAffordable * BLOCK_SIZE).toLocaleString()}* por *${maxAffordable * COST_PER_BLOCK} 💎*`
      )
    }

    user.diamond -= totalCost
    user.bankLimit += totalIncrease

    return m.reply(
      `✅ *¡Bóveda Mejorada!*\n\n` +
      `> 📦 Bloques comprados: *${blocks}* (x${BLOCK_SIZE.toLocaleString()} c/u)\n` +
      `> 📈 Capacidad añadida: *+${totalIncrease.toLocaleString()}* ${moneda}\n` +
      `> 💎 Diamantes gastados: *${totalCost}*\n` +
      `> 🏦 Nueva capacidad: *${user.bankLimit.toLocaleString()}* ${moneda}\n` +
      `> 💎 Diamantes restantes: *${user.diamond}*${interestMsg}`
    )
  }

  const isDeposit = /^(deposit|dep|d)$/i.test(command)
  let maxPossible = isDeposit ? user.coin : user.bank

  // Si quiere depositar, su máximo permitido no puede superar el límite del banco
  if (isDeposit) {
    const spaceLeft = user.bankLimit - user.bank
    if (spaceLeft <= 0) return m.reply(`❌ Tu banco está lleno (*${user.bank} / ${user.bankLimit}*). Usa *${usedPrefix}upgrade* para aumentar el límite.`)
    if (maxPossible > spaceLeft) {
      maxPossible = spaceLeft // Limitar el depósito al espacio restante
    }
  }

  const amount = parseAmount(text, maxPossible)

  if (!amount || amount < 1) {
    return m.reply(`✳️ Usa: *${usedPrefix + command} <cantidad>*\nEjemplo: *${usedPrefix + command} 100* o *${usedPrefix + command} all*`)
  }

  if (isDeposit && amount > user.coin) return m.reply(`❌ No tienes suficientes coins en wallet. Recuerda que tu espacio disponible en el banco es de *${maxPossible}*.`)
  if (!isDeposit && amount > user.bank) return m.reply('❌ No tienes esos coins en banco.')

  const loading = await conn.sendMessage(m.chat, { text: '🏦 Actualizando saldo...' }, { quoted: m })

  if (isDeposit) {
    user.coin -= amount
    user.bank += amount
    const action = 'depositados al banco'
    await conn.sendMessage(m.chat, {
      text: `✅ *${amount} ${moneda}* ${action}.\n> 🪙 Wallet: *${user.coin}*\n> 🏦 Banco: *${user.bank} / ${user.bankLimit}*${interestMsg}`,
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
      text: `✅ *${finalAmount} ${moneda}* retirados del banco.\n⚠️ El banco cobró un impuesto del *3%* (*${taxAmount} ${moneda}*).\n> 🪙 Wallet: *${user.coin}*\n> 🏦 Banco: *${user.bank} / ${user.bankLimit}*${interestMsg}`,
      edit: loading.key
    })
  }
}

handler.help = ['balance', 'deposit <cantidad|all>', 'withdraw <cantidad|all>', 'upgrade (banco)']
handler.tags = ['economy']
handler.command = ['bal', 'balance', 'wallet', 'cartera', 'deposit', 'dep', 'd', 'withdraw', 'wd', 'upgrade']
handler.group = true

export default handler