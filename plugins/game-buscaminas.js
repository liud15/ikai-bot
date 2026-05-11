// Juego: BUSCAMINAS (Minesweeper) con edición de mensajes
const msGames = global.msGames || (global.msGames = {})

const ROWS = 6
const COLS = 6
const MINES = 6

// Emojis para números
const NUM_EMOJIS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣']
const HIDDEN = '⬜'
const MINE = '💣'
const FLAG = '🚩'
const EMPTY = '⬛'

function createBoard() {
    const board = Array(ROWS).fill(null).map(() =>
        Array(COLS).fill(null).map(() => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
    )

    // Colocar minas
    let placed = 0
    while (placed < MINES) {
        const r = Math.floor(Math.random() * ROWS)
        const c = Math.floor(Math.random() * COLS)
        if (!board[r][c].mine) {
            board[r][c].mine = true
            placed++
        }
    }

    // Calcular adyacentes
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c].mine) continue
            let count = 0
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc
                    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].mine) count++
                }
            }
            board[r][c].adjacent = count
        }
    }

    return board
}

function revealCell(board, r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return
    if (board[r][c].revealed || board[r][c].flagged) return

    board[r][c].revealed = true

    if (board[r][c].adjacent === 0 && !board[r][c].mine) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue
                revealCell(board, r + dr, c + dc)
            }
        }
    }
}

function countRevealed(board) {
    let count = 0
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c].revealed) count++
        }
    }
    return count
}

function renderBoard(board, gameOver = false) {
    // Encabezado de columnas
    const colHeaders = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣']
    const rowHeaders = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫']

    let text = '💣 *B U S C A M I N A S* 💣\n━━━━━━━━━━━━━━━━━\n'
    text += '⬛' + colHeaders.slice(0, COLS).join('') + '\n'

    for (let r = 0; r < ROWS; r++) {
        text += rowHeaders[r]
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c]
            if (gameOver && cell.mine) {
                text += MINE
            } else if (cell.flagged && !cell.revealed) {
                text += FLAG
            } else if (!cell.revealed) {
                text += HIDDEN
            } else if (cell.mine) {
                text += MINE
            } else if (cell.adjacent === 0) {
                text += EMPTY
            } else {
                text += NUM_EMOJIS[cell.adjacent]
            }
        }
        text += '\n'
    }

    text += '━━━━━━━━━━━━━━━━━'
    return text
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
    const userId = m.sender
    const chatId = m.chat
    const key = `${chatId}_${userId}`
    const user = global.db.data.users[userId]
    if (!Number.isFinite(user.coin)) user.coin = 0

    const sub = (text || '').trim().toLowerCase()

    // Subcomando stop
    if (sub === 'stop' && msGames[key]) {
        delete msGames[key]
        return m.reply('🚫 Juego de buscaminas cancelado.')
    }

    // Sin juego activo => crear
    if (!msGames[key]) {
        const board = createBoard()
        const game = {
            board,
            msgKey: null,
            createdAt: Date.now(),
            moves: 0
        }

        const info = `\n\n📋 *Cómo jugar:*
▸ *${usedPrefix}minas a1* — Revelar casilla (fila letra, columna número)
▸ *${usedPrefix}minas f a1* — Poner/quitar bandera 🚩
▸ *${usedPrefix}minas stop* — Cancelar juego

🎯 Revela todas las casillas sin pisar una mina
🪙 Premio: *200 coins* si ganas
💣 Minas: *${MINES}* en un tablero *${ROWS}x${COLS}*`

        const initialText = renderBoard(board) + info
        const { key: msgKey } = await conn.sendMessage(m.chat, { text: initialText }, { quoted: m })
        game.msgKey = msgKey
        msGames[key] = game

        // Auto-expirar en 14 minutos
        setTimeout(() => {
            if (msGames[key]) {
                delete msGames[key]
            }
        }, 14 * 60 * 1000)

        return
    }

    // Juego activo
    const game = msGames[key]
    const board = game.board

    // Parsear comando: "a1", "f a1", "flag b3"
    let flagMode = false
    let coordStr = sub

    if (sub.startsWith('f ') || sub.startsWith('flag ')) {
        flagMode = true
        coordStr = sub.replace(/^(f|flag)\s+/, '')
    }

    // Parsear coordenada: letra + número (e.g. a1, b3, c5)
    const match = coordStr.match(/^([a-f])([1-6])$/)
    if (!match) {
        return m.reply(`❌ Coordenada inválida.\nUsa: *${usedPrefix}minas a1* (fila a-f, columna 1-6)\nBandera: *${usedPrefix}minas f a1*`)
    }

    const r = match[1].charCodeAt(0) - 'a'.charCodeAt(0)
    const c = parseInt(match[2]) - 1

    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
        return m.reply('❌ Coordenada fuera del tablero.')
    }

    const cell = board[r][c]

    // Modo bandera
    if (flagMode) {
        if (cell.revealed) return m.reply('❌ No puedes poner bandera en una casilla revelada.')
        cell.flagged = !cell.flagged
        game.moves++

        const updatedText = renderBoard(board) + `\n\n${cell.flagged ? '🚩 Bandera colocada' : '⬜ Bandera removida'} en *${match[1].toUpperCase()}${match[2]}*\n🎮 Movimientos: *${game.moves}*`

        try {
            await conn.sendMessage(m.chat, { text: updatedText, edit: game.msgKey })
        } catch (e) {
            const { key: newKey } = await conn.sendMessage(m.chat, { text: updatedText }, { quoted: m })
            game.msgKey = newKey
        }
        return
    }

    // Modo revelar
    if (cell.revealed) return m.reply('❌ Esa casilla ya está revelada.')
    if (cell.flagged) return m.reply('❌ Quita la bandera primero (*' + usedPrefix + 'minas f ' + coordStr + '*).')

    game.moves++

    // Pisar mina
    if (cell.mine) {
        cell.revealed = true
        const finalText = renderBoard(board, true) + `\n\n💥 *¡BOOM! Pisaste una mina en ${match[1].toUpperCase()}${match[2]}!* 💥\n❌ Juego terminado\n🎮 Movimientos: *${game.moves}*`

        try {
            await conn.sendMessage(m.chat, { text: finalText, edit: game.msgKey })
        } catch (e) {
            await conn.sendMessage(m.chat, { text: finalText }, { quoted: m })
        }

        delete msGames[key]
        return
    }

    // Revelar casilla (con cascada si es 0)
    revealCell(board, r, c)

    // Verificar victoria
    const revealed = countRevealed(board)
    const safeCells = ROWS * COLS - MINES

    if (revealed >= safeCells) {
        const reward = 200
        user.coin += reward

        const finalText = renderBoard(board, true) + `\n\n🎉 *¡GANASTE EL BUSCAMINAS!* 🎉\n✅ Revelaste todas las casillas seguras\n🪙 Premio: *+${reward} coins*\n🎮 Movimientos: *${game.moves}*\n💰 Wallet: *${user.coin}*`

        try {
            await conn.sendMessage(m.chat, { text: finalText, edit: game.msgKey })
        } catch (e) {
            await conn.sendMessage(m.chat, { text: finalText }, { quoted: m })
        }

        delete msGames[key]
        return
    }

    // Continuar juego
    const updatedText = renderBoard(board) + `\n\n✅ Casilla *${match[1].toUpperCase()}${match[2]}* revelada\n🎮 Movimientos: *${game.moves}* | Restantes: *${safeCells - revealed}*`

    try {
        await conn.sendMessage(m.chat, { text: updatedText, edit: game.msgKey })
    } catch (e) {
        const { key: newKey } = await conn.sendMessage(m.chat, { text: updatedText }, { quoted: m })
        game.msgKey = newKey
    }
}

handler.help = ['minas <coordenada>', 'buscaminas']
handler.tags = ['juegos']
handler.command = ['minas', 'buscaminas', 'minesweeper']
handler.group = true

export default handler
