// Juego: SLOT MACHINE con rodillos animados
const REELS = ['🍒', '🍋', '🍇', '7️⃣', '⭐', '🔔', '💎', '🍀']

function parseAmount(input, max) {
    if (!input) return 0
    if (/^(all|todo)$/i.test(input)) return max
    const n = Number(input)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

function randomReel() {
    return REELS[Math.floor(Math.random() * REELS.length)]
}

function renderSlot(r1, r2, r3, spinning = [false, false, false]) {
    const s1 = spinning[0] ? randomReel() : r1
    const s2 = spinning[1] ? randomReel() : r2
    const s3 = spinning[2] ? randomReel() : r3

    return `╔══════════╗
║  ${s1}  ${s2}  ${s3}  ║
╚══════════╝`
}

let handler = async (m, { conn, command, text, usedPrefix }) => {
    const user = global.db.data.users[m.sender]
    if (!Number.isFinite(user.coin)) user.coin = 0

    const amount = parseAmount((text || '').trim(), user.coin)

    if (amount < 10) {
        return m.reply(`🎰 *SLOT MACHINE*\n\nUso: *${usedPrefix}slot <apuesta>*\nEjemplo: *${usedPrefix}slot 100*\nApuesta mínima: *10 coins*\n\n*Pagos:*\n▸ 3 iguales = x3\n▸ 3x 7️⃣ = x7 (JACKPOT)\n▸ 3x 💎 = x5\n▸ 2 iguales = x0.5\n\n💰 Tu wallet: *${user.coin} coins*`)
    }
    if (amount > user.coin) return m.reply(`❌ No tienes suficientes coins.\n💰 Wallet: *${user.coin}*`)

    // Resultado final (pre-calculado)
    const r1 = randomReel(), r2 = randomReel(), r3 = randomReel()

    // Animación: todos girando
    const loading = await conn.sendMessage(m.chat, {
        text: `🎰 *S L O T* 🎰\n━━━━━━━━━━━━━\n${renderSlot(r1, r2, r3, [true, true, true])}\n\n⏳ Girando...\n💰 Apuesta: *${amount} coins*\n━━━━━━━━━━━━━`
    }, { quoted: m })

    // Frame 2: primer rodillo se detiene
    await new Promise(r => setTimeout(r, 600))
    try {
        await conn.sendMessage(m.chat, {
            text: `🎰 *S L O T* 🎰\n━━━━━━━━━━━━━\n${renderSlot(r1, r2, r3, [false, true, true])}\n\n⏳ Girando...\n💰 Apuesta: *${amount} coins*\n━━━━━━━━━━━━━`,
            edit: loading.key
        })
    } catch (e) { }

    // Frame 3: segundo rodillo se detiene
    await new Promise(r => setTimeout(r, 600))
    try {
        await conn.sendMessage(m.chat, {
            text: `🎰 *S L O T* 🎰\n━━━━━━━━━━━━━\n${renderSlot(r1, r2, r3, [false, false, true])}\n\n⏳ Último rodillo...\n💰 Apuesta: *${amount} coins*\n━━━━━━━━━━━━━`,
            edit: loading.key
        })
    } catch (e) { }

    // Frame final: todos detenidos
    await new Promise(r => setTimeout(r, 700))

    // Calcular resultado
    let multiplier = 0
    let resultMsg = ''

    if (r1 === r2 && r2 === r3) {
        if (r1 === '7️⃣') {
            multiplier = 7
            resultMsg = '🔥 *¡¡¡JACKPOT!!!* 🔥\n🎉 ¡TRIPLE SIETE!'
        } else if (r1 === '💎') {
            multiplier = 5
            resultMsg = '💎 *¡TRIPLE DIAMANTE!* 💎'
        } else {
            multiplier = 3
            resultMsg = '🎉 *¡TRIPLE!* 🎉'
        }
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
        multiplier = 0.5
        resultMsg = '🔸 *Par* — Premio menor'
    } else {
        multiplier = 0
        resultMsg = '❌ *Sin suerte*'
    }

    let profit
    if (multiplier > 0) {
        profit = Math.floor(amount * multiplier)
        user.coin += profit
        resultMsg += `\n🪙 Ganancia: *+${profit} coins*`
    } else {
        profit = -amount
        user.coin -= amount
        resultMsg += `\n💸 Pérdida: *-${amount} coins*`
    }

    await conn.sendMessage(m.chat, {
        text: `🎰 *S L O T* 🎰\n━━━━━━━━━━━━━\n${renderSlot(r1, r2, r3)}\n\n${resultMsg}\n💰 Wallet: *${user.coin} coins*\n━━━━━━━━━━━━━`,
        edit: loading.key
    })
}

handler.help = ['slot <apuesta>']
handler.tags = ['juegos']
handler.command = ['slot', 'slots', 'tragamonedas']
handler.group = true

export default handler
