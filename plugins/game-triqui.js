// ═══════════════════════════════════════════════════
//  TRES EN RAYA (Tic-Tac-Toe) PvP mejorado
//  Con flujo de aceptación, timeouts, y protecciones
// ═══════════════════════════════════════════════════

const tttGames = global.tttGames || (global.tttGames = {})

const EMPTY = '⬜'
const X_MARK = '❌'
const O_MARK = '⭕'

const ACCEPT_TIMEOUT = 2 * 60 * 1000   // 2 min para aceptar
const TURN_TIMEOUT = 3 * 60 * 1000     // 3 min por turno
const MAX_BET = 5000

function renderBoard(board) {
    const cols = '　 1️⃣  2️⃣  3️⃣'
    const rows = ['🇦', '🇧', '🇨']
    let text = `${cols}\n`
    for (let r = 0; r < 3; r++) {
        text += `${rows[r]} ${board[r][0]}${board[r][1]}${board[r][2]}\n`
    }
    return text
}

function checkWin(board, mark) {
    for (let r = 0; r < 3; r++) {
        if (board[r][0] === mark && board[r][1] === mark && board[r][2] === mark) return true
    }
    for (let c = 0; c < 3; c++) {
        if (board[0][c] === mark && board[1][c] === mark && board[2][c] === mark) return true
    }
    if (board[0][0] === mark && board[1][1] === mark && board[2][2] === mark) return true
    if (board[0][2] === mark && board[1][1] === mark && board[2][0] === mark) return true
    return false
}

function isFull(board) {
    return board.every(row => row.every(cell => cell !== EMPTY))
}

function parseCoord(text) {
    const match = text.match(/^([a-c])([1-3])$/i)
    if (!match) return null
    const r = match[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)
    const c = parseInt(match[2]) - 1
    return { r, c }
}

function ensureCoins(user) {
    if (!Number.isFinite(user.coin)) user.coin = 0
}

function clearGameTimers(game) {
    if (game._acceptTimer) { clearTimeout(game._acceptTimer); game._acceptTimer = null }
    if (game._turnTimer) { clearTimeout(game._turnTimer); game._turnTimer = null }
}

function startTurnTimer(chatId, game, conn) {
    if (game._turnTimer) clearTimeout(game._turnTimer)
    game._turnTimer = setTimeout(async () => {
        const g = tttGames[chatId]
        if (!g || !g.accepted) return

        // El jugador actual pierde por inactividad
        const loser = g.currentPlayer
        const winner = loser === g.player1 ? g.player2 : g.player1

        let resultText = `❌⭕ *TRES EN RAYA* ❌⭕\n` +
            `━━━━━━━━━━━━━━━\n` +
            `${renderBoard(g.board)}\n` +
            `⏰ *@${global.getJidNum(loser)} no jugó a tiempo*\n` +
            `🏆 *Gana @${global.getJidNum(winner)} por abandono*`

        if (g.bet > 0) {
            const winnerUser = global.db.data.users[winner]
            const loserUser = global.db.data.users[loser]
            if (winnerUser && loserUser) {
                ensureCoins(winnerUser)
                ensureCoins(loserUser)
                const actual = Math.min(g.bet, loserUser.coin)
                winnerUser.coin += actual
                loserUser.coin = Math.max(0, loserUser.coin - actual)
                resultText += `\n💰 Premio: *${actual} coins*`
            }
        }

        resultText += `\n━━━━━━━━━━━━━━━`
        clearGameTimers(g)
        delete tttGames[chatId]

        try {
            await conn.sendMessage(chatId, { text: resultText, mentions: [winner, loser] })
        } catch (e) { console.error(e) }
    }, TURN_TIMEOUT)
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
    const chatId = m.chat
    const userId = m.sender
    const sub = (text || '').trim().toLowerCase()

    // ═══ STOP / CANCELAR ═══
    if (/^(stop|cancelar)$/i.test(sub) && tttGames[chatId]) {
        const game = tttGames[chatId]
        if (userId !== game.player1 && userId !== game.player2) {
            return m.reply('❌ Solo los jugadores pueden cancelar.')
        }
        clearGameTimers(game)
        delete tttGames[chatId]
        return m.reply('🚫 Juego de tres en raya cancelado.')
    }

    // ═══ ACEPTAR ═══
    if (/^(aceptar|accept|si|sí)$/i.test(sub) && tttGames[chatId]) {
        const game = tttGames[chatId]

        if (game.accepted) return m.reply('❌ El juego ya fue aceptado.')
        if (userId !== game.player2) return m.reply('❌ Solo la persona retada puede aceptar.')

        // Verificar coins del oponente al aceptar
        if (game.bet > 0) {
            let u2 = global.db.data.users[userId]
            if (!u2) u2 = global.db.data.users[userId] = { coin: 0 }
            ensureCoins(u2)
            if (u2.coin < game.bet) {
                clearGameTimers(game)
                delete tttGames[chatId]
                return m.reply(`❌ No tienes *${game.bet} coins* para aceptar.`)
            }
            // Re-verificar al creador
            let u1 = global.db.data.users[game.player1]
            if (!u1) u1 = global.db.data.users[game.player1] = { coin: 0 }
            ensureCoins(u1)
            if (u1.coin < game.bet) {
                clearGameTimers(game)
                delete tttGames[chatId]
                return m.reply('❌ El retador ya no tiene coins suficientes.')
            }
        }

        game.accepted = true
        if (game._acceptTimer) { clearTimeout(game._acceptTimer); game._acceptTimer = null }

        // Iniciar timer de turno
        startTurnTimer(chatId, game, conn)

        const boardText = `❌⭕ *TRES EN RAYA* ❌⭕\n` +
            `━━━━━━━━━━━━━━━\n` +
            `${renderBoard(game.board)}\n\n` +
            `${X_MARK} @${global.getJidNum(game.player1)} vs ${O_MARK} @${global.getJidNum(game.player2)}\n` +
            `${game.bet > 0 ? `💰 Apuesta: *${game.bet} coins*\n` : ''}` +
            `🎯 Turno de @${global.getJidNum(game.player1)} (${X_MARK})\n` +
            `📝 *${usedPrefix}ttt <coordenada>* (ej: a1, b2)\n` +
            `━━━━━━━━━━━━━━━`

        try {
            const { key } = await conn.sendMessage(chatId, {
                text: boardText, mentions: [game.player1, game.player2]
            }, { quoted: m })
            game.msgKey = key
        } catch (e) {
            console.error(e)
        }

        return
    }

    // ═══ RECHAZAR ═══
    if (/^(rechazar|reject|no)$/i.test(sub) && tttGames[chatId]) {
        const game = tttGames[chatId]
        if (game.accepted) return m.reply('❌ El juego ya está en curso. Usa *#ttt stop* para cancelar.')
        if (userId !== game.player2) return m.reply('❌ Solo la persona retada puede rechazar.')
        clearGameTimers(game)
        delete tttGames[chatId]
        return m.reply('🚫 Reto de tres en raya rechazado.')
    }

    // ═══ JUEGO ACTIVO (mover ficha) ═══
    if (tttGames[chatId] && tttGames[chatId].accepted) {
        const game = tttGames[chatId]

        // Verificar que es un jugador
        if (userId !== game.player1 && userId !== game.player2) return

        // Verificar turno
        if (userId !== game.currentPlayer) {
            if (userId === game.player1 || userId === game.player2) {
                return m.reply('⏳ No es tu turno.')
            }
            return
        }

        const coord = parseCoord(sub)
        if (!coord) {
            return m.reply(`❌ Coordenada inválida.\nUsa: *${usedPrefix}ttt a1* (fila a-c, columna 1-3)`)
        }

        if (game.board[coord.r][coord.c] !== EMPTY) {
            return m.reply('❌ Esa casilla ya está ocupada.')
        }

        const mark = userId === game.player1 ? X_MARK : O_MARK
        game.board[coord.r][coord.c] = mark

        // ─── Victoria ───
        if (checkWin(game.board, mark)) {
            const winner = userId
            const loser = userId === game.player1 ? game.player2 : game.player1

            let resultText = `❌⭕ *TRES EN RAYA* ❌⭕\n` +
                `━━━━━━━━━━━━━━━\n` +
                `${renderBoard(game.board)}\n` +
                `🏆 *¡@${global.getJidNum(winner)} GANA!* 🏆`

            if (game.bet > 0) {
                const winnerUser = global.db.data.users[winner]
                const loserUser = global.db.data.users[loser]
                if (winnerUser && loserUser) {
                    ensureCoins(winnerUser)
                    ensureCoins(loserUser)
                    const actual = Math.min(game.bet, loserUser.coin)
                    winnerUser.coin += actual
                    loserUser.coin = Math.max(0, loserUser.coin - actual)
                    resultText += `\n💰 Premio: *${actual} coins*`
                }
            }

            resultText += `\n━━━━━━━━━━━━━━━`
            clearGameTimers(game)
            delete tttGames[chatId]

            try {
                await conn.sendMessage(chatId, { text: resultText, mentions: [winner, loser], edit: game.msgKey })
            } catch {
                await conn.sendMessage(chatId, { text: resultText, mentions: [winner, loser] }, { quoted: m })
            }
            return
        }

        // ─── Empate ───
        if (isFull(game.board)) {
            const resultText = `❌⭕ *TRES EN RAYA* ❌⭕\n` +
                `━━━━━━━━━━━━━━━\n` +
                `${renderBoard(game.board)}\n` +
                `🤝 *¡EMPATE!*` +
                `${game.bet > 0 ? '\n💰 Nadie pierde coins' : ''}\n` +
                `━━━━━━━━━━━━━━━`

            clearGameTimers(game)
            delete tttGames[chatId]

            try {
                await conn.sendMessage(chatId, { text: resultText, mentions: [game.player1, game.player2], edit: game.msgKey })
            } catch {
                await conn.sendMessage(chatId, { text: resultText, mentions: [game.player1, game.player2] }, { quoted: m })
            }
            return
        }

        // ─── Siguiente turno ───
        game.currentPlayer = userId === game.player1 ? game.player2 : game.player1
        const nextMark = game.currentPlayer === game.player1 ? X_MARK : O_MARK

        // Reiniciar timer de turno
        startTurnTimer(chatId, game, conn)

        const updatedText = `❌⭕ *TRES EN RAYA* ❌⭕\n` +
            `━━━━━━━━━━━━━━━\n` +
            `${renderBoard(game.board)}\n\n` +
            `🎯 Turno de @${global.getJidNum(game.currentPlayer)} (${nextMark})\n` +
            `📝 *${usedPrefix}ttt <coordenada>* (ej: a1, b2)\n` +
            `⏳ 3 min para jugar\n` +
            `━━━━━━━━━━━━━━━`

        try {
            await conn.sendMessage(chatId, { text: updatedText, mentions: [game.player1, game.player2], edit: game.msgKey })
        } catch {
            const { key } = await conn.sendMessage(chatId, { text: updatedText, mentions: [game.player1, game.player2] }, { quoted: m })
            game.msgKey = key
        }
        return
    }

    // ═══ CREAR JUEGO NUEVO ═══
    if (tttGames[chatId]) {
        return m.reply('⏳ Ya hay un juego pendiente en este chat. Espera a que termine o usa *#ttt stop*.')
    }

    const target = m.mentionedJid?.[0] || m.quoted?.sender
    if (!target) {
        return m.reply(
            `❌⭕ *TRES EN RAYA*\n\n` +
            `Reta a un amigo a jugar tres en raya.\n\n` +
            `📝 *Uso:*\n` +
            `▸ *${usedPrefix}ttt @usuario* — Sin apuesta\n` +
            `▸ *${usedPrefix}ttt @usuario 100* — Apostar 100 coins\n\n` +
            `🎮 *Durante el juego:*\n` +
            `▸ *${usedPrefix}ttt a1* — Colocar ficha (fila a-c, col 1-3)\n` +
            `▸ *${usedPrefix}ttt stop* — Cancelar partida\n\n` +
            `⏱️ Tiempos:\n` +
            `▸ 2 min para aceptar el reto\n` +
            `▸ 3 min por turno`
        )
    }

    if (target === userId) return m.reply('❌ No puedes jugar contra ti mismo.')

    const betText = (text || '').replace(/@[\d]+/g, '').trim()
    let bet = 0
    if (betText) {
        if (/^(all|todo)$/i.test(betText)) {
            const u = global.db.data.users[userId]
            bet = u ? u.coin || 0 : 0
        } else {
            const match = betText.match(/\b\d+\b/)
            bet = match ? Math.floor(Number(match[0])) : 0
        }
    }

    if (bet > MAX_BET) return m.reply(`⚠️ Apuesta máxima: *${MAX_BET} coins*.`)

    if (bet > 0) {
        let u1 = global.db.data.users[userId]
        let u2 = global.db.data.users[target]
        if (!u1) u1 = global.db.data.users[userId] = { coin: 0 }
        if (!u2) u2 = global.db.data.users[target] = { coin: 0 }
        ensureCoins(u1)
        ensureCoins(u2)
        if (u1.coin < bet) return m.reply(`❌ No tienes *${bet} coins*.`)
        if (u2.coin < bet) return m.reply(`❌ @${global.getJidNum(target)} no tiene *${bet} coins*.`, null, { mentions: [target] })
    }

    const board = Array(3).fill(null).map(() => Array(3).fill(EMPTY))

    const inviteText = `❌⭕ *TRES EN RAYA — RETO* ❌⭕\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `⚔️ @${global.getJidNum(userId)} reta a @${global.getJidNum(target)}\n` +
        `${bet > 0 ? `💰 Apuesta: *${bet} coins*\n` : ''}` +
        `\n📋 *Responde:*\n` +
        `▸ *${usedPrefix}ttt aceptar* — Jugar\n` +
        `▸ *${usedPrefix}ttt rechazar* — Declinar\n\n` +
        `⏱️ Tienes *2 minutos* para responder.\n` +
        `━━━━━━━━━━━━━━━`

    const { key: msgKey } = await conn.sendMessage(chatId, {
        text: inviteText,
        mentions: [userId, target]
    }, { quoted: m })

    const game = {
        board,
        player1: userId,
        player2: target,
        currentPlayer: userId,
        bet,
        msgKey,
        accepted: false,
        createdAt: Date.now(),
        _acceptTimer: null,
        _turnTimer: null
    }

    tttGames[chatId] = game

    // Timer de aceptación
    game._acceptTimer = setTimeout(async () => {
        const g = tttGames[chatId]
        if (g && !g.accepted) {
            clearGameTimers(g)
            delete tttGames[chatId]
            try {
                await conn.sendMessage(chatId, {
                    text: `⏰ El reto de tres en raya expiró. @${global.getJidNum(target)} no respondió a tiempo.`,
                    mentions: [target]
                })
            } catch (e) { console.error(e) }
        }
    }, ACCEPT_TIMEOUT)
}

handler.help = ['ttt @usuario [apuesta]', 'ttt <coordenada>', 'ttt aceptar', 'ttt rechazar', 'ttt stop']
handler.tags = ['juegos']
handler.command = ['ttt', 'triqui', 'tresenraya', 'tictactoe', 'gato']
handler.group = true

export default handler
