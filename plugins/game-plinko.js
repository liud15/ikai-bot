// Juego: PLINKO — Bola cae por un tablero con multiplicadores
function parseAmount(input, max) {
    if (!input) return 0
    if (/^(all|todo)$/i.test(input)) return max
    const n = Number(input)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

// Tablero Plinko de 8 niveles, la bola cae izquierda o derecha
// Posición final (0-8) determina el multiplicador
const MULTIPLIERS = [5.0, 2.0, 1.0, 0.5, 0.3, 0.5, 1.0, 2.0, 5.0]
const MULTI_EMOJI = ['🔥', '💎', '💙', '⬇️', '💀', '⬇️', '💙', '💎', '🔥']

function simulatePlinko() {
    let position = 4 // Centro (0-8)
    const path = []

    for (let level = 0; level < 8; level++) {
        const goRight = Math.random() < 0.5
        if (goRight && position < 8) position++
        else if (!goRight && position > 0) position--
        path.push({ level, position, direction: goRight ? '➡️' : '⬅️' })
    }

    return { finalPosition: position, path }
}

function renderBoard(ballLevel, ballPosition) {
    const WIDTH = 9
    let board = ''

    // Fila de multiplicadores arriba
    board += `${MULTI_EMOJI.join('')}\n`

    for (let level = 0; level < 8; level++) {
        let row = ''
        for (let col = 0; col < WIDTH; col++) {
            if (level === ballLevel && col === ballPosition) {
                row += '🔴' // Bola
            } else if ((level + col) % 2 === 0) {
                row += '⚪' // Pin
            } else {
                row += '⬛' // Espacio
            }
        }
        board += row + '\n'
    }

    // Multiplicadores abajo
    board += MULTIPLIERS.map(m => m >= 1 ? `${m}x` : `${m}`).join(' ')

    return board
}

function renderFinalBoard(finalPos) {
    const WIDTH = 9
    let board = ''

    board += `${MULTI_EMOJI.join('')}\n`

    for (let level = 0; level < 8; level++) {
        let row = ''
        for (let col = 0; col < WIDTH; col++) {
            if ((level + col) % 2 === 0) {
                row += '⚪'
            } else {
                row += '⬛'
            }
        }
        board += row + '\n'
    }

    // Mostrar donde cayó la bola
    let landing = ''
    for (let i = 0; i < WIDTH; i++) {
        landing += i === finalPos ? '🔴' : '▫️'
    }
    board += landing + '\n'
    board += MULTIPLIERS.map((m, i) => i === finalPos ? `*${m}x*` : `${m}x`).join(' ')

    return board
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
    const user = global.db.data.users[m.sender]
    if (!Number.isFinite(user.coin)) user.coin = 0

    const amount = parseAmount((text || '').trim(), user.coin)

    if (amount < 10) {
        return m.reply(`📍 *P L I N K O* 📍\n━━━━━━━━━━━━━━━\n\nUna bola cae por un tablero de pins.\n¡Donde caiga determina tu premio!\n\nUso: *${usedPrefix}plinko <apuesta>*\nMínimo: *10 coins*\n\n*Multiplicadores:*\n🔥 Extremos: *x5.0*\n💎 Cercanos: *x2.0*\n💙 Medios: *x1.0*\n⬇️ Centro: *x0.5*\n💀 Centro exacto: *x0.3*\n\n💰 Wallet: *${user.coin} coins*\n━━━━━━━━━━━━━━━`)
    }
    if (amount > user.coin) return m.reply(`❌ No tienes suficientes coins.\n💰 Wallet: *${user.coin}*`)

    // Simular caída
    const { finalPosition, path } = simulatePlinko()
    const multi = MULTIPLIERS[finalPosition]
    const multiEmoji = MULTI_EMOJI[finalPosition]

    // Frame inicial
    const loading = await conn.sendMessage(m.chat, {
        text: `📍 *P L I N K O* 📍\n━━━━━━━━━━━━━━━\n\n${renderBoard(0, 4)}\n\n🔴 Soltando bola...\n💰 Apuesta: *${amount} coins*\n━━━━━━━━━━━━━━━`
    }, { quoted: m })

    // Animar la caída (mostrar solo algunos frames para no saturar)
    const framesToShow = [1, 3, 5, 7]
    for (const level of framesToShow) {
        await new Promise(r => setTimeout(r, 400))
        try {
            await conn.sendMessage(m.chat, {
                text: `📍 *P L I N K O* 📍\n━━━━━━━━━━━━━━━\n\n${renderBoard(level, path[level].position)}\n\n🔴 Cayendo... ${path[level].direction}\n💰 Apuesta: *${amount} coins*\n━━━━━━━━━━━━━━━`,
                edit: loading.key
            })
        } catch (e) { }
    }

    await new Promise(r => setTimeout(r, 600))

    // Resultado final
    const profit = Math.floor(amount * multi) - amount
    user.coin += Math.floor(amount * multi)

    let resultMsg
    if (profit > 0) {
        resultMsg = `✅ *¡GANASTE!*\n${multiEmoji} Multiplicador: *x${multi}*\n🪙 Ganancia: *+${profit} coins*`
    } else if (profit === 0) {
        resultMsg = `🔸 *Recuperaste tu apuesta*\n${multiEmoji} Multiplicador: *x${multi}*`
    } else {
        resultMsg = `❌ *Mala suerte*\n${multiEmoji} Multiplicador: *x${multi}*\n💸 Pérdida: *${profit} coins*`
    }

    await conn.sendMessage(m.chat, {
        text: `📍 *P L I N K O* 📍\n━━━━━━━━━━━━━━━\n\n${renderFinalBoard(finalPosition)}\n\n${resultMsg}\n💰 Wallet: *${user.coin} coins*\n━━━━━━━━━━━━━━━`,
        edit: loading.key
    })
}

handler.help = ['plinko <apuesta>']
handler.tags = ['juegos']
handler.command = ['plinko', 'plk']
handler.group = true

export default handler
