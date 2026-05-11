// Juego: BLACKJACK / 21 - Con edición de mensajes y apuestas
const bjGames = global.bjGames || (global.bjGames = {})

// Cartas Unicode por palo
// Orden: A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K
const CARD_UNICODE = {
    spades: ['🂡', '🂢', '🂣', '🂤', '🂥', '🂦', '🂧', '🂨', '🂩', '🂪', '🂫', '🂭', '🂮'],
    hearts: ['🂱', '🂲', '🂳', '🂴', '🂵', '🂶', '🂷', '🂸', '🂹', '🂺', '🂻', '🂽', '🂾'],
    diamonds: ['🃁', '🃂', '🃃', '🃄', '🃅', '🃆', '🃇', '🃈', '🃉', '🃊', '🃋', '🃍', '🃎'],
    clubs: ['🃑', '🃒', '🃓', '🃔', '🃕', '🃖', '🃗', '🃘', '🃙', '🃚', '🃛', '🃝', '🃞']
}
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs']
const RANK_NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const BACK_CARD = '🂠'

function createDeck() {
    const deck = []
    for (const suit of SUIT_NAMES) {
        for (let i = 0; i < 13; i++) {
            deck.push({ rank: RANK_NAMES[i], suit, unicode: CARD_UNICODE[suit][i] })
        }
    }
    // Barajar (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]
    }
    return deck
}

function cardValue(card) {
    if (['J', 'Q', 'K'].includes(card.rank)) return 10
    if (card.rank === 'A') return 11
    return parseInt(card.rank)
}

function handValue(hand) {
    let total = 0
    let aces = 0
    for (const card of hand) {
        total += cardValue(card)
        if (card.rank === 'A') aces++
    }
    while (total > 21 && aces > 0) {
        total -= 10
        aces--
    }
    return total
}

function handStr(hand) {
    return hand.map(c => c.unicode).join(' ')
}

function renderGame(game, reveal = false) {
    const playerVal = handValue(game.playerHand)
    const dealerVal = handValue(game.dealerHand)

    let dealerDisplay, dealerValDisplay
    if (reveal) {
        dealerDisplay = handStr(game.dealerHand)
        dealerValDisplay = dealerVal
    } else {
        dealerDisplay = `${game.dealerHand[0].unicode}  ${BACK_CARD}`
        dealerValDisplay = '??'
    }

    return `🃏 * BLACKJACK * 🃏
━━━━━━━━━━━━━━━
🤖 * Dealer:* ${dealerDisplay}
📊 Valor: * ${dealerValDisplay}*

👤 * Tú:* ${handStr(game.playerHand)}
📊 Valor: * ${playerVal}*
━━━━━━━━━━━━━━━
💰 Apuesta: * ${game.bet} coins * `
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
    const userId = m.sender
    const chatId = m.chat
    const key = `${chatId}_${userId} `
    const user = global.db.data.users[userId]
    if (!Number.isFinite(user.coin)) user.coin = 0

    // Subcomandos
    const sub = (text || '').trim().toLowerCase()

    // Si ya tiene juego activo
    if (bjGames[key]) {
        const game = bjGames[key]

        if (sub === 'hit' || sub === 'pedir') {
            game.playerHand.push(game.deck.pop())
            const val = handValue(game.playerHand)

            if (val > 21) {
                // BUST
                const finalText = renderGame(game, true) + `\n\n💥 *¡TE PASASTE!(${val}) * 💥\n❌ Perdiste * ${game.bet} coins *\n💰 Wallet: * ${user.coin}* `
                delete bjGames[key]
                return conn.sendMessage(m.chat, { text: finalText, edit: game.msgKey })
            }

            if (val === 21) {
                // Auto stand en 21
                return resolveGame(conn, m, game, key, user)
            }

            const updatedText = renderGame(game) + `\n\n👉 * ${usedPrefix}bj hit * — Pedir carta\n👉 * ${usedPrefix}bj stand * — Plantarse`
            return conn.sendMessage(m.chat, { text: updatedText, edit: game.msgKey })
        }

        if (sub === 'stand' || sub === 'plantar' || sub === 'plantarse') {
            return resolveGame(conn, m, game, key, user)
        }

        if (sub === 'double' || sub === 'doblar') {
            if (game.playerHand.length > 2) {
                return m.reply('❌ Solo puedes doblar en tu primera mano (2 cartas).')
            }
            if (user.coin < game.bet) {
                return m.reply('❌ No tienes coins suficientes para doblar.')
            }
            user.coin -= game.bet
            game.bet *= 2
            game.playerHand.push(game.deck.pop())
            return resolveGame(conn, m, game, key, user)
        }

        return m.reply(`🃏 Ya tienes un juego activo.\n👉 * ${usedPrefix}bj hit * — Pedir carta\n👉 * ${usedPrefix}bj stand * — Plantarse\n👉 * ${usedPrefix}bj double * — Doblar apuesta(solo con 2 cartas)`)
    }

    // Crear nuevo juego
    const betInput = sub.replace(/[^0-9all]/gi, '') || sub
    let bet = 0
    if (/^(all|todo)$/i.test(betInput)) {
        bet = user.coin
    } else {
        bet = Math.floor(Number(betInput))
    }

    if (!Number.isFinite(bet) || bet < 10) {
        return m.reply(`🃏 * BLACKJACK *\n\nUso: * ${usedPrefix} bj < apuesta >*\nEjemplo: * ${usedPrefix}bj 100 *\nApuesta mínima: * 10 coins *\n\nDurante el juego: \n▸ * ${usedPrefix}bj hit * — Pedir carta\n▸ * ${usedPrefix}bj stand * — Plantarse\n▸ * ${usedPrefix}bj double * — Doblar(solo con 2 cartas)`)
    }

    if (bet > user.coin) return m.reply(`❌ No tienes suficientes coins.\n💰 Wallet: * ${user.coin}* `)

    user.coin -= bet

    const deck = createDeck()
    const playerHand = [deck.pop(), deck.pop()]
    const dealerHand = [deck.pop(), deck.pop()]

    const game = { deck, playerHand, dealerHand, bet, msgKey: null, createdAt: Date.now() }

    // Blackjack natural
    if (handValue(playerHand) === 21) {
        const payout = Math.floor(bet * 2.5)
        user.coin += payout
        const txt = renderGame(game, true) + `\n\n🎉 *¡BLACKJACK NATURAL! * 🎉\n💰 Ganaste * ${payout} coins * !\n💰 Wallet: * ${user.coin}* `
        const { key: msgKey } = await conn.sendMessage(m.chat, { text: txt }, { quoted: m })
        return
    }

    const initialText = renderGame(game) + `\n\n👉 * ${usedPrefix}bj hit * — Pedir carta\n👉 * ${usedPrefix}bj stand * — Plantarse\n👉 * ${usedPrefix}bj double * — Doblar apuesta`

    const { key: msgKey } = await conn.sendMessage(m.chat, { text: initialText }, { quoted: m })
    game.msgKey = msgKey
    bjGames[key] = game

    // Auto-expirar en 10 minutos
    setTimeout(() => {
        if (bjGames[key]) {
            user.coin += bjGames[key].bet
            delete bjGames[key]
        }
    }, 10 * 60 * 1000)
}

async function resolveGame(conn, m, game, key, user) {
    // Dealer juega
    while (handValue(game.dealerHand) < 17) {
        game.dealerHand.push(game.deck.pop())
    }

    const playerVal = handValue(game.playerHand)
    const dealerVal = handValue(game.dealerHand)

    let result = ''
    let payout = 0

    if (dealerVal > 21) {
        payout = game.bet * 2
        result = `🎉 *¡El dealer se pasó!(${dealerVal}) * 🎉\n✅ Ganaste * ${payout} coins * !`
    } else if (playerVal > dealerVal) {
        payout = game.bet * 2
        result = `🎉 *¡GANASTE!(${playerVal} vs ${dealerVal}) * 🎉\n✅ Ganaste * ${payout} coins * !`
    } else if (playerVal === dealerVal) {
        payout = game.bet
        result = `🤝 * EMPATE(${playerVal} vs ${dealerVal}) * 🤝\n🔄 Se devuelven * ${payout} coins * `
    } else {
        result = `❌ * PERDISTE(${playerVal} vs ${dealerVal}) * ❌\n💸 Perdiste * ${game.bet} coins * `
    }

    user.coin += payout

    const finalText = renderGame(game, true) + `\n\n${result} \n💰 Wallet: * ${user.coin}* `

    try {
        await conn.sendMessage(m.chat, { text: finalText, edit: game.msgKey })
    } catch (e) {
        await conn.sendMessage(m.chat, { text: finalText }, { quoted: m })
    }

    delete bjGames[key]
}

handler.help = ['bj <apuesta>', 'blackjack <apuesta>']
handler.tags = ['juegos']
handler.command = ['bj', 'blackjack', '21']
handler.group = true

export default handler
