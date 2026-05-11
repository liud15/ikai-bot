// Juego: CARA O CRUZ con animación de moneda girando + estadísticas
const COIN_FRAMES = ['🪙', '💿', '🔘', '💿', '🪙']

function parseAmount(input, max) {
    if (!input) return 0
    if (/^(all|todo)$/i.test(input)) return max
    const n = Number(input)
    return Number.isFinite(n) ? Math.floor(n) : 0
}

// Inicializar o reparar el objeto de estadísticas del usuario
function initVolados(user) {
    if (!user.volados || typeof user.volados !== 'object') {
        user.volados = {}
    }
    const v = user.volados
    if (!Number.isFinite(v.juegos))         v.juegos         = 0
    if (!Number.isFinite(v.victorias))      v.victorias      = 0
    if (!Number.isFinite(v.perdidas))       v.perdidas       = 0
    if (!Number.isFinite(v.gananciasTotal)) v.gananciasTotal = 0
    if (!Number.isFinite(v.perdidasTotal))  v.perdidasTotal  = 0
    if (!Number.isFinite(v.racha))          v.racha          = 0
    return v
}

let handler = async (m, { conn, command, text, usedPrefix }) => {
    const user = global.db.data.users[m.sender]
    if (!Number.isFinite(user.coin)) user.coin = 0

    const parts = (text || '').trim().split(/\s+/).filter(Boolean)
    const arg0 = (parts[0] || '').toLowerCase()

    // ── Subcomando: ver estadísticas ──────────────────────────────────────────
    if (['stats', 'estadisticas', 'stat', 'historial'].includes(arg0)) {
        const v = initVolados(user)
        const winrate = v.juegos > 0 ? ((v.victorias / v.juegos) * 100).toFixed(1) : '0.0'
        const net = v.gananciasTotal - v.perdidasTotal
        const netStr = net >= 0 ? `+${net}` : `${net}`
        const rachaEmoji = v.racha > 0 ? `🔥 Racha ganadora: *${v.racha}*` : v.racha < 0 ? `❄️ Racha perdedora: *${Math.abs(v.racha)}*` : `➖ Sin racha activa`

        return m.reply(
            `🪙 *CARA O CRUZ — TUS STATS*\n━━━━━━━━━━━━━\n\n` +
            `🎮 Partidas: *${v.juegos}*\n` +
            `✅ Victorias: *${v.victorias}* (${winrate}%)\n` +
            `❌ Derrotas: *${v.perdidas}*\n` +
            `━━━━━━━━━━━━━\n` +
            `💰 Ganancias: *+${v.gananciasTotal} coins*\n` +
            `💸 Pérdidas: *-${v.perdidasTotal} coins*\n` +
            `📊 Neto: *${netStr} coins*\n` +
            `━━━━━━━━━━━━━\n` +
            `${rachaEmoji}`
        )
    }

    // ── Lógica principal del juego ────────────────────────────────────────────
    const side = arg0
    const amount = parseAmount(parts[1], user.coin)

    if (!['cara', 'cruz', 'heads', 'tails', 'c', 't'].includes(side)) {
        return m.reply(
            `🪙 *CARA O CRUZ*\n\n` +
            `Uso: *${usedPrefix}coinflip <cara|cruz> <apuesta>*\n` +
            `Ejemplo: *${usedPrefix}coinflip cara 100*\n` +
            `Apuesta mínima: *10 coins*\n\n` +
            `💰 Tu wallet: *${user.coin} coins*\n` +
            `📊 Tus stats: *${usedPrefix}coinflip stats*`
        )
    }

    if (amount < 10) return m.reply('✳️ Apuesta mínima: *10 coins*')
    if (amount > user.coin) return m.reply(`❌ No tienes suficientes coins.\n💰 Wallet: *${user.coin}*`)

    const normalizedSide = ['heads', 'cara', 'c'].includes(side) ? 'cara' : 'cruz'
    const v = initVolados(user)

    // Animación de moneda girando
    const loading = await conn.sendMessage(m.chat, {
        text: `🪙 *CARA O CRUZ* 🪙\n━━━━━━━━━━━━━\n\n${COIN_FRAMES[0]} Lanzando moneda...\n\n🎯 Apuesta: *${normalizedSide.toUpperCase()}*\n💰 Monto: *${amount} coins*\n━━━━━━━━━━━━━`
    }, { quoted: m })

    // Animar la moneda con ediciones
    for (let i = 1; i < COIN_FRAMES.length; i++) {
        await new Promise(r => setTimeout(r, 400))
        try {
            await conn.sendMessage(m.chat, {
                text: `🪙 *CARA O CRUZ* 🪙\n━━━━━━━━━━━━━\n\n${COIN_FRAMES[i]} Girando${'.'.repeat(i)}\n\n🎯 Apuesta: *${normalizedSide.toUpperCase()}*\n💰 Monto: *${amount} coins*\n━━━━━━━━━━━━━`,
                edit: loading.key
            })
        } catch (e) { }
    }

    await new Promise(r => setTimeout(r, 500))

    // ── Resultado ─────────────────────────────────────────────────────────────
    const result = Math.random() < 0.5 ? 'cara' : 'cruz'
    const win = normalizedSide === result
    const resultEmoji = result === 'cara' ? '👑' : '✝️'

    // Actualizar estadísticas
    v.juegos++

    if (win) {
        const profit = Math.floor(amount * 0.95)
        user.coin += profit

        v.victorias++
        v.gananciasTotal += profit
        v.racha = (v.racha > 0) ? v.racha + 1 : 1 // positivo = racha ganadora

        const rachaMsg = v.racha >= 3 ? `\n🔥 *Racha ganadora: ${v.racha}!*` : ''

        await conn.sendMessage(m.chat, {
            text: `🪙 *CARA O CRUZ* 🪙\n━━━━━━━━━━━━━\n\n${resultEmoji} Resultado: *${result.toUpperCase()}*\n\n✅ *¡GANASTE!*\n🪙 Ganancia: *+${profit} coins*\n💰 Wallet: *${user.coin} coins*${rachaMsg}\n━━━━━━━━━━━━━\n📊 Stats: ${v.victorias}W / ${v.perdidas}L`,
            edit: loading.key
        })
    } else {
        user.coin -= amount

        v.perdidas++
        v.perdidasTotal += amount
        v.racha = (v.racha < 0) ? v.racha - 1 : -1 // negativo = racha perdedora

        const rachaMsg = Math.abs(v.racha) >= 3 ? `\n❄️ *Mala racha: ${Math.abs(v.racha)} derrotas seguidas...*` : ''

        await conn.sendMessage(m.chat, {
            text: `🪙 *CARA O CRUZ* 🪙\n━━━━━━━━━━━━━\n\n${resultEmoji} Resultado: *${result.toUpperCase()}*\n\n❌ *PERDISTE*\n💸 Pérdida: *-${amount} coins*\n💰 Wallet: *${user.coin} coins*${rachaMsg}\n━━━━━━━━━━━━━\n📊 Stats: ${v.victorias}W / ${v.perdidas}L`,
            edit: loading.key
        })
    }
}

handler.help = ['coinflip <cara|cruz> <apuesta>', 'coinflip stats']
handler.tags = ['juegos']
handler.command = ['coinflip', 'flipbet', 'cfbet', 'caracruz', 'cc']
handler.group = true

export default handler
