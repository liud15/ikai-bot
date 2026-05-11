let handler = async (m, { conn, args, usedPrefix, command }) => {
    let user = global.db.data.users[m.sender]
    if (!user) return

    user.health = Number.isFinite(user.health) ? user.health : 1000
    user.coin = Number.isFinite(user.coin) ? user.coin : 0
    user.diamond = Number.isFinite(user.diamond) ? user.diamond : 0

    let maxHealth = 1000 // Límite de vida máximo
    if (user.health >= maxHealth) return m.reply(`❤️ Tu salud ya está al máximo (*${user.health}/${maxHealth}*). No necesitas ir al hospital.`)

    let healCostPerPoint = 15 // Cuántas monedas cuesta curar 1 punto de vida
    let pointsNeeded = maxHealth - user.health

    // --- Curación Premium (1 Diamante cura todo) ---
    if (args[0] && (args[0].toLowerCase() === 'max' || args[0].toLowerCase() === 'premium')) {
        let diamantesCost = 1
        if (user.diamond < diamantesCost) {
            return m.reply(`❌ No tienes los *${diamantesCost} 💎* requeridos para la curación premium.\nUsa *${usedPrefix + command}* a secas para pagar con monedas.`)
        }

        user.diamond -= diamantesCost
        user.health = maxHealth
        return m.reply(`✨ *MÉDICO VIP*\nPagaste *${diamantesCost} 💎* y los doctores restauraron toda tu salud al instante.\n> ❤️ Salud actual: *${user.health}*`)
    }

    // --- Curación Estándar (Monedas) ---
    let totalCost = pointsNeeded * healCostPerPoint

    if (user.coin < totalCost) {
        // No tiene dinero para curarse entero, curamos lo que pueda pagar
        let canHealPts = Math.floor(user.coin / healCostPerPoint)

        if (canHealPts < 1) {
            return m.reply(`❌ No tienes suficientes monedas ni para 1 curita (Cuesta *${healCostPerPoint} ${moneda}* por 1 punto de vida).`)
        }

        let partialCost = canHealPts * healCostPerPoint
        user.coin -= partialCost
        user.health += canHealPts

        return m.reply(`💉 *CURACIÓN PARCIAL*\nEl hospital tomó todos tus fondos (*${partialCost} ${moneda}*) y te curó solo *${canHealPts}* puntos de vida.\n> ❤️ Salud actual: *${user.health}/${maxHealth}*\n> 🪙 Monedas restantes: *${user.coin}*`)
    } else {
        // Puede pagar la curación completa
        user.coin -= totalCost
        user.health = maxHealth
        return m.reply(`🏥 *TRATAMIENTO COMPLETO*\nPagaste *${totalCost} ${moneda}* en el hospital.\n> ❤️ Recuperaste *${pointsNeeded}* puntos.\n> Salud actual: *${user.health}/${maxHealth}*`)
    }
}

handler.help = ['heal', 'heal max', 'curar']
handler.tags = ['economy']
handler.command = ['heal', 'hospital', 'curar']
handler.group = true

export default handler
