// Juego: RULETA — Casino clásico con múltiples tipos de apuesta
const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
const BLACKS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]

function parseAmount(input, max) {
    if (!input) return 0
    if (/^(all|todo)$/i.test(input)) return max
    const n = Number(input)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

function getColor(num) {
    if (num === 0) return '🟢'
    if (REDS.includes(num)) return '🔴'
    return '⚫'
}

function getColorName(num) {
    if (num === 0) return 'verde'
    if (REDS.includes(num)) return 'rojo'
    return 'negro'
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
    const user = global.db.data.users[m.sender]
    if (!Number.isFinite(user.coin)) user.coin = 0

    const args = (text || '').trim().split(/\s+/).filter(Boolean)

    if (args.length < 2) {
        return m.reply(`🎰 *R U L E T A* 🎰\n━━━━━━━━━━━━━━━\n\n*Tipos de apuesta:*\n\n🔴⚫ *Color:*\n▸ *${usedPrefix}ruleta rojo <apuesta>* (x2)\n▸ *${usedPrefix}ruleta negro <apuesta>* (x2)\n\n🔢 *Par/Impar:*\n▸ *${usedPrefix}ruleta par <apuesta>* (x2)\n▸ *${usedPrefix}ruleta impar <apuesta>* (x2)\n\n🎯 *Número exacto (0-36):*\n▸ *${usedPrefix}ruleta 17 <apuesta>* (x36)\n\n📊 *Mitades:*\n▸ *${usedPrefix}ruleta 1-18 <apuesta>* (x2)\n▸ *${usedPrefix}ruleta 19-36 <apuesta>* (x2)\n\nMínimo: *10 coins*\n💰 Wallet: *${user.coin} coins*\n━━━━━━━━━━━━━━━`)
    }

    const betType = args[0].toLowerCase()
    const amount = parseAmount(args[1], user.coin)

    if (amount < 10) return m.reply('✳️ Apuesta mínima: *10 coins*')
    if (amount > user.coin) return m.reply(`❌ No tienes suficientes coins.\n💰 Wallet: *${user.coin}*`)

    // Validar tipo de apuesta
    let betLabel = ''
    let multiplier = 0

    const numBet = parseInt(betType)

    if (['rojo', 'red', 'r'].includes(betType)) { betLabel = '🔴 Rojo'; multiplier = 2 }
    else if (['negro', 'black', 'n'].includes(betType)) { betLabel = '⚫ Negro'; multiplier = 2 }
    else if (['par', 'even'].includes(betType)) { betLabel = '🔢 Par'; multiplier = 2 }
    else if (['impar', 'odd'].includes(betType)) { betLabel = '🔢 Impar'; multiplier = 2 }
    else if (betType === '1-18') { betLabel = '⬇️ 1-18'; multiplier = 2 }
    else if (betType === '19-36') { betLabel = '⬆️ 19-36'; multiplier = 2 }
    else if (Number.isFinite(numBet) && numBet >= 0 && numBet <= 36) { betLabel = `🎯 Número ${numBet}`; multiplier = 36 }
    else {
        return m.reply(`❌ Tipo de apuesta inválido.\nUsa *${usedPrefix}ruleta* para ver opciones.`)
    }

    // Animación de la ruleta
    const spinFrames = ['⬛🔴⬛🔴⬛', '🔴⬛🔴⬛🔴', '⬛🟢⬛🔴⬛', '🔴⬛🔴🟢🔴']

    const loading = await conn.sendMessage(m.chat, {
        text: `🎰 *R U L E T A* 🎰\n━━━━━━━━━━━━━━━\n\n${spinFrames[0]}\n\n⏳ La ruleta está girando...\n\n🎯 Apuesta: *${betLabel}*\n💰 Monto: *${amount} coins*\n━━━━━━━━━━━━━━━`
    }, { quoted: m })

    for (let i = 1; i < spinFrames.length; i++) {
        await new Promise(r => setTimeout(r, 500))
        try {
            await conn.sendMessage(m.chat, {
                text: `🎰 *R U L E T A* 🎰\n━━━━━━━━━━━━━━━\n\n${spinFrames[i]}\n\n⏳ Girando${'.'.repeat(i + 1)}\n\n🎯 Apuesta: *${betLabel}*\n💰 Monto: *${amount} coins*\n━━━━━━━━━━━━━━━`,
                edit: loading.key
            })
        } catch (e) { }
    }

    await new Promise(r => setTimeout(r, 700))

    // Resultado
    const result = Math.floor(Math.random() * 37) // 0-36
    const resultColor = getColor(result)
    const resultColorName = getColorName(result)

    // Verificar si ganó
    let win = false

    if (['rojo', 'red', 'r'].includes(betType) && REDS.includes(result)) win = true
    else if (['negro', 'black', 'n'].includes(betType) && BLACKS.includes(result)) win = true
    else if (['par', 'even'].includes(betType) && result > 0 && result % 2 === 0) win = true
    else if (['impar', 'odd'].includes(betType) && result > 0 && result % 2 !== 0) win = true
    else if (betType === '1-18' && result >= 1 && result <= 18) win = true
    else if (betType === '19-36' && result >= 19 && result <= 36) win = true
    else if (Number.isFinite(numBet) && numBet === result) win = true

    let resultText
    if (win) {
        const profit = Math.floor(amount * (multiplier - 1))
        user.coin += profit
        resultText = `🎰 *R U L E T A* 🎰\n━━━━━━━━━━━━━━━\n\n${resultColor} *${result}* (${resultColorName})\n\n✅ *¡GANASTE!*\n🎯 Apuesta: ${betLabel}\n📊 Multiplicador: *x${multiplier}*\n🪙 Ganancia: *+${profit} coins*\n💰 Wallet: *${user.coin} coins*\n━━━━━━━━━━━━━━━`
    } else {
        user.coin -= amount
        resultText = `🎰 *R U L E T A* 🎰\n━━━━━━━━━━━━━━━\n\n${resultColor} *${result}* (${resultColorName})\n\n❌ *PERDISTE*\n🎯 Apuesta: ${betLabel}\n💸 Pérdida: *-${amount} coins*\n💰 Wallet: *${user.coin} coins*\n━━━━━━━━━━━━━━━`
    }

    await conn.sendMessage(m.chat, { text: resultText, edit: loading.key })
}

handler.help = ['ruleta <tipo> <apuesta>']
handler.tags = ['juegos']
handler.command = ['ruleta', 'roulette', 'rlt']
handler.group = true

export default handler
