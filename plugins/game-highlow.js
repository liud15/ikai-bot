// Juego: MAYOR O MENOR — Racha de aciertos multiplica la ganancia
const holGames = global.holGames || (global.holGames = {})

const SUITS = ['♠️', '♥️', '♦️', '♣️']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 }

function randomCard() {
    const rank = RANKS[Math.floor(Math.random() * RANKS.length)]
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)]
    return { rank, suit, value: VALUES[rank] }
}

function cardStr(card) {
    return `${card.rank}${card.suit}`
}

function parseAmount(input, max) {
    if (!input) return 0
    if (/^(all|todo)$/i.test(input)) return max
    const n = Number(input)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
    const userId = m.sender
    const chatId = m.chat
    const user = global.db.data.users[userId]
    if (!Number.isFinite(user.coin)) user.coin = 0
    const sub = (text || '').trim().toLowerCase()

    // === MAYOR / MENOR (durante juego activo) ===
    if (holGames[userId] && (sub === 'mayor' || sub === 'menor' || sub === 'high' || sub === 'low' || sub === 'cobrar' || sub === 'cash')) {
        const game = holGames[userId]

        // Cobrar
        if (sub === 'cobrar' || sub === 'cash') {
            const profit = Math.floor(game.bet * game.multiplier) - game.bet
            user.coin += Math.floor(game.bet * game.multiplier)

            await conn.sendMessage(chatId, {
                text: `🃏 *MAYOR O MENOR* 🃏\n━━━━━━━━━━━━━━━\n\n💰 *¡Te retiras con ganancias!*\n\n🔥 Racha: *${game.streak}* acierto(s)\n📊 Multiplicador: *x${game.multiplier.toFixed(1)}*\n🪙 Ganancia: *+${profit} coins*\n💰 Wallet: *${user.coin} coins*\n━━━━━━━━━━━━━━━`,
                edit: game.msgKey
            })
            delete holGames[userId]
            return
        }

        const guess = (sub === 'mayor' || sub === 'high') ? 'mayor' : 'menor'
        const newCard = randomCard()

        // Animación
        try {
            await conn.sendMessage(chatId, {
                text: `🃏 *MAYOR O MENOR* 🃏\n━━━━━━━━━━━━━━━\n\n📍 Carta actual: *${cardStr(game.currentCard)}*\n\n🔄 Revelando carta...\n━━━━━━━━━━━━━━━`,
                edit: game.msgKey
            })
        } catch (e) { }

        await new Promise(r => setTimeout(r, 800))

        const isHigher = newCard.value > game.currentCard.value
        const isLower = newCard.value < game.currentCard.value
        const isTie = newCard.value === game.currentCard.value

        let win = false
        if (isTie) win = true // Empate = ganas
        else if (guess === 'mayor' && isHigher) win = true
        else if (guess === 'menor' && isLower) win = true

        if (win) {
            game.streak++
            game.multiplier = 1 + (game.streak * 0.5)
            game.currentCard = newCard
            const potential = Math.floor(game.bet * game.multiplier)

            await conn.sendMessage(chatId, {
                text: `🃏 *MAYOR O MENOR* 🃏\n━━━━━━━━━━━━━━━\n\n📍 Carta anterior: *${cardStr(game.currentCard)}*\n🆕 Nueva carta: *${cardStr(newCard)}* ${isTie ? '(empate = ganas)' : ''}\n\n✅ *¡ACERTASTE!*\n🔥 Racha: *${game.streak}*\n📊 Multiplicador: *x${game.multiplier.toFixed(1)}*\n💰 Ganancia potencial: *${potential} coins*\n\n¿La siguiente será *mayor* o *menor*?\n▸ *${usedPrefix}hol mayor*\n▸ *${usedPrefix}hol menor*\n▸ *${usedPrefix}hol cobrar* — Retirarte con ${potential} coins\n━━━━━━━━━━━━━━━`,
                edit: game.msgKey
            })
        } else {
            user.coin -= game.bet
            await conn.sendMessage(chatId, {
                text: `🃏 *MAYOR O MENOR* 🃏\n━━━━━━━━━━━━━━━\n\n📍 Carta anterior: *${cardStr(game.currentCard)}*\n🆕 Nueva carta: *${cardStr(newCard)}*\n\n❌ *¡PERDISTE!* La carta era ${newCard.value > game.currentCard.value ? 'MAYOR' : 'MENOR'}\n\n🔥 Racha alcanzada: *${game.streak}*\n💸 Pérdida: *-${game.bet} coins*\n💰 Wallet: *${user.coin} coins*\n━━━━━━━━━━━━━━━`,
                edit: game.msgKey
            })
            delete holGames[userId]
        }
        return
    }

    // === CREAR JUEGO NUEVO ===
    if (holGames[userId]) {
        return m.reply(`⚠️ Ya tienes un juego activo.\nUsa *${usedPrefix}hol mayor/menor/cobrar*`)
    }

    const amount = parseAmount(sub, user.coin)
    if (amount < 10) {
        return m.reply(`🃏 *MAYOR O MENOR*\n\nApuesta y adivina si la siguiente carta es mayor o menor.\n¡Cada acierto multiplica tu ganancia!\n\nUso: *${usedPrefix}hol <apuesta>*\nMínimo: *10 coins*\n\n📊 Multiplicadores:\n▸ 1 acierto = x1.5\n▸ 2 aciertos = x2.0\n▸ 3 aciertos = x2.5\n▸ 5 aciertos = x3.5\n▸ ¡Sin límite!\n\n💰 Wallet: *${user.coin} coins*`)
    }
    if (amount > user.coin) return m.reply(`❌ No tienes suficientes coins.\n💰 Wallet: *${user.coin}*`)

    const firstCard = randomCard()

    const { key: msgKey } = await conn.sendMessage(chatId, {
        text: `🃏 *MAYOR O MENOR* 🃏\n━━━━━━━━━━━━━━━\n\n📍 Tu carta: *${cardStr(firstCard)}*\n💰 Apuesta: *${amount} coins*\n\n¿La siguiente carta será *mayor* o *menor*?\n▸ *${usedPrefix}hol mayor*\n▸ *${usedPrefix}hol menor*\n━━━━━━━━━━━━━━━`
    }, { quoted: m })

    holGames[userId] = {
        currentCard: firstCard,
        bet: amount,
        streak: 0,
        multiplier: 1,
        msgKey,
        chatId,
        timeout: setTimeout(() => {
            if (holGames[userId]) {
                delete holGames[userId]
            }
        }, 10 * 60 * 1000)
    }
}

handler.help = ['hol <apuesta>', 'hol mayor/menor/cobrar']
handler.tags = ['juegos']
handler.command = ['hol', 'highlow', 'mayormenor', 'mayoromenor']
handler.group = true

export default handler
