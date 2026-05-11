// Juego: DADOS (Craps) con Unicode y apuestas
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function rollDie() {
    return Math.floor(Math.random() * 6) + 1
}

function diceEmoji(val) {
    return DICE_FACES[val - 1]
}

function parseAmount(input, max) {
    if (!input) return 0
    if (/^(all|todo)$/i.test(input)) return max
    const n = Number(input)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
    const userId = m.sender
    const user = global.db.data.users[userId]
    if (!Number.isFinite(user.coin)) user.coin = 0

    const args = (text || '').trim().split(/\s+/)
    const sub = args[0]?.toLowerCase() || ''

    // === MODO ALTO/BAJO ===
    if (sub === 'alto' || sub === 'bajo' || sub === 'high' || sub === 'low') {
        const bet = parseAmount(args[1], user.coin)
        if (bet < 10) return m.reply(`✳️ Apuesta mínima: *10 coins*\nUso: *${usedPrefix}dados alto/bajo <apuesta>*`)
        if (bet > user.coin) return m.reply(`❌ No tienes suficientes coins.\n💰 Wallet: *${user.coin}*`)

        const isHigh = (sub === 'alto' || sub === 'high')
        const loading = await conn.sendMessage(m.chat, { text: '🎲 Lanzando dados...' }, { quoted: m })

        const d1 = rollDie(), d2 = rollDie()
        const total = d1 + d2
        const resultHigh = total >= 8
        const win = (isHigh && resultHigh) || (!isHigh && !resultHigh)

        // Total 7 = pierde siempre (ventaja de la casa)
        const isNeutral = total === 7

        let payout = 0
        let resultText = ''

        if (isNeutral) {
            user.coin -= bet
            resultText = `🔸 *Neutral (7)* — La casa gana\n❌ Perdiste *${bet} coins*`
        } else if (win) {
            payout = Math.floor(bet * 0.9)
            user.coin += payout
            resultText = `✅ *¡Ganaste!* (${isHigh ? 'ALTO' : 'BAJO'} = ${total})\n🪙 Ganancia: *+${payout} coins*`
        } else {
            user.coin -= bet
            resultText = `❌ *Perdiste* (${isHigh ? 'necesitabas 8+' : 'necesitabas 6-'}, salió ${total})\n💸 Perdiste *${bet} coins*`
        }

        await conn.sendMessage(m.chat, {
            text: `🎲 *D A D O S* 🎲
━━━━━━━━━━━━━━━
  ${diceEmoji(d1)}  ${diceEmoji(d2)}

📊 Total: *${total}*
🎯 Apuesta: *${isHigh ? 'ALTO (8-12)' : 'BAJO (2-6)'}*
━━━━━━━━━━━━━━━
${resultText}
💰 Wallet: *${user.coin}*`,
            edit: loading.key
        })
        return
    }

    // === MODO NÚMERO EXACTO ===
    if (/^[2-9]|1[0-2]$/.test(sub)) {
        const targetNum = parseInt(sub)
        if (targetNum < 2 || targetNum > 12) return m.reply('❌ El número debe ser entre 2 y 12.')

        const bet = parseAmount(args[1], user.coin)
        if (bet < 10) return m.reply(`✳️ Apuesta mínima: *10 coins*\nUso: *${usedPrefix}dados <2-12> <apuesta>*`)
        if (bet > user.coin) return m.reply(`❌ No tienes suficientes coins.\n💰 Wallet: *${user.coin}*`)

        const loading = await conn.sendMessage(m.chat, { text: '🎲 Lanzando dados...' }, { quoted: m })

        const d1 = rollDie(), d2 = rollDie()
        const total = d1 + d2

        // Multiplicadores según dificultad
        const multipliers = { 2: 6, 3: 5, 4: 4, 5: 3, 6: 2.5, 7: 2, 8: 2.5, 9: 3, 10: 4, 11: 5, 12: 6 }
        const multi = multipliers[targetNum] || 2

        let resultText = ''
        if (total === targetNum) {
            const payout = Math.floor(bet * multi)
            user.coin += payout
            resultText = `🎉 *¡EXACTO!* Apostaste al *${targetNum}* y salió *${total}*\n🪙 Ganancia: *+${payout} coins* (x${multi})`
        } else {
            user.coin -= bet
            resultText = `❌ Apostaste al *${targetNum}* pero salió *${total}*\n💸 Perdiste *${bet} coins*`
        }

        await conn.sendMessage(m.chat, {
            text: `🎲 *D A D O S* 🎲
━━━━━━━━━━━━━━━
  ${diceEmoji(d1)}  ${diceEmoji(d2)}

📊 Total: *${total}*
🎯 Apuesta: *Número ${targetNum}* (x${multi})
━━━━━━━━━━━━━━━
${resultText}
💰 Wallet: *${user.coin}*`,
            edit: loading.key
        })
        return
    }

    // === MODO DUELO PVP ===
    if (sub === 'duelo' || sub === 'vs') {
        const target = m.mentionedJid?.[0]
        if (!target) return m.reply(`✳️ Uso: *${usedPrefix}dados duelo @usuario <apuesta>*`)
        if (target === userId) return m.reply('❌ No puedes retarte a ti mismo.')

        const betText = args.find(a => /^\d+$/.test(a) || /^(all|todo)$/i.test(a))
        const bet = parseAmount(betText, user.coin)
        if (bet < 10) return m.reply(`✳️ Apuesta mínima: *10 coins*`)
        if (bet > user.coin) return m.reply('❌ No tienes coins suficientes.')

        const opponent = global.db.data.users[target]
        if (!opponent) return m.reply('❌ Ese usuario no existe en la base de datos.')
        if (!Number.isFinite(opponent.coin)) opponent.coin = 0
        if (opponent.coin < bet) return m.reply(`❌ @${global.getJidNum(target)} no tiene *${bet} coins*.`)

        const loading = await conn.sendMessage(m.chat, {
            text: `🎲 @${global.getJidNum(userId)} vs @${global.getJidNum(target)}\n🎲 Lanzando dados...`,
            mentions: [userId, target]
        }, { quoted: m })

        const p1d1 = rollDie(), p1d2 = rollDie()
        const p2d1 = rollDie(), p2d2 = rollDie()
        const p1total = p1d1 + p1d2
        const p2total = p2d1 + p2d2

        let resultText = ''
        if (p1total > p2total) {
            user.coin += bet
            opponent.coin -= bet
            resultText = `🏆 *¡@${global.getJidNum(userId)} gana!* (+${bet} coins)`
        } else if (p2total > p1total) {
            opponent.coin += bet
            user.coin -= bet
            resultText = `🏆 *¡@${global.getJidNum(target)} gana!* (+${bet} coins)`
        } else {
            resultText = `🤝 *¡Empate!* Nadie pierde coins`
        }

        await conn.sendMessage(m.chat, {
            text: `🎲 *DUELO DE DADOS* 🎲
━━━━━━━━━━━━━━━━━━
👤 @${global.getJidNum(userId)}:  ${diceEmoji(p1d1)}  ${diceEmoji(p1d2)}  = *${p1total}*
👤 @${global.getJidNum(target)}:  ${diceEmoji(p2d1)}  ${diceEmoji(p2d2)}  = *${p2total}*
━━━━━━━━━━━━━━━━━━
💰 Apuesta: *${bet} coins*
${resultText}`,
            mentions: [userId, target],
            edit: loading.key
        })
        return
    }

    // === MODO LIBRE (solo tirar) ===
    if (sub === 'tirar' || sub === 'roll' || sub === '') {
        const loading = await conn.sendMessage(m.chat, { text: '🎲 Lanzando...' }, { quoted: m })
        const d1 = rollDie(), d2 = rollDie()

        await conn.sendMessage(m.chat, {
            text: `🎲 *D A D O S* 🎲
━━━━━━━━━━━━━━━
  ${diceEmoji(d1)}  ${diceEmoji(d2)}

📊 Total: *${d1 + d2}*
━━━━━━━━━━━━━━━`,
            edit: loading.key
        })
        return
    }

    // === AYUDA ===
    return m.reply(`🎲 *JUEGO DE DADOS* 🎲

*Modos de juego:*

▸ *${usedPrefix}dados* — Tirar dados sin apostar
▸ *${usedPrefix}dados alto <apuesta>* — Apostar a 8-12
▸ *${usedPrefix}dados bajo <apuesta>* — Apostar a 2-6
▸ *${usedPrefix}dados <2-12> <apuesta>* — Apostar a número exacto
▸ *${usedPrefix}dados duelo @user <apuesta>* — Duelo PvP

*Pagos:*
▸ Alto/Bajo: x0.9 (7 = pierde)
▸ Número exacto: x2 a x6 según dificultad
▸ Duelo: el ganador se lleva la apuesta

*Apuesta mínima:* 10 coins`)
}

handler.help = ['dados', 'dados alto/bajo <apuesta>', 'dados <2-12> <apuesta>', 'dados duelo @user <apuesta>']
handler.tags = ['juegos']
handler.command = ['dados', 'dice']
handler.group = true

export default handler
