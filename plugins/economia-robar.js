import { getRankLabel } from '../lib/levelRanks.js'

let robarCooldown = 3600000 // 1 hora en milisegundos

let handler = async (m, { conn, text, usedPrefix, command }) => {
    let who
    const _mentioned = await m.mentionedJid
    if (m.isGroup) who = _mentioned[0] ? _mentioned[0] : m.quoted ? m.quoted.sender : false
    else who = m.chat

    if (!who) return m.reply(`✳️ Etiqueta a alguien para intentar robarle.\nEjemplo: *${usedPrefix + command} @usuario*`)
    if (who === m.sender) return m.reply(`❌ No puedes robarte a ti mismo.`)

    let users = global.db.data.users

    // Inicializar valores si no existen
    if (!(m.sender in users)) users[m.sender] = {}
    if (!(who in users)) users[who] = {}

    let user = users[m.sender]
    let target = users[who]

    user.coin = Number.isFinite(user.coin) ? user.coin : 0
    user.health = Number.isFinite(user.health) ? user.health : 1000
    user.exp = Number.isFinite(user.exp) ? user.exp : 0
    user.lastrob = user.lastrob || 0

    target.coin = Number.isFinite(target.coin) ? target.coin : 0
    target.lastrobbed = target.lastrobbed || 0

    // Verificar Cooldowns
    let timeSinceLastRob = new Date() - user.lastrob
    if (timeSinceLastRob < robarCooldown) {
        let timeRemaining = msToTime(robarCooldown - timeSinceLastRob)
        return m.reply(`⏱️ Aún te está buscando la policía. Espera *${timeRemaining}* antes de volver a robar.`)
    }

    let timeSinceTargetRobbed = new Date() - target.lastrobbed
    let targetCooldown = 3600000 // La víctima también tiene 1h de inmunidad después de ser robada/intentada
    if (timeSinceTargetRobbed < targetCooldown) {
        let timeRemainingTarget = msToTime(targetCooldown - timeSinceTargetRobbed)
        return m.reply(`🛡️ Esta persona ya sufrió un intento de robo reciente. Estará alerta por *${timeRemainingTarget}*. Intenta con alguien más.`)
    }

    if (user.health < 200) {
        return m.reply(`❤️ Tu salud está muy baja (*${user.health}*). No tienes fuerzas para asaltar a nadie. Usa pociones o ve al hospital.`)
    }

    if (target.coin < 100) {
        return m.reply(`⚠️ No seas abusivo, *@${global.getJidNum(who)}* tiene menos de 100 ${moneda}s en su wallet. No vale la pena el riesgo.`, null, { mentions: [`${global.getJidNum(who)}@s.whatsapp.net`] })
    }

    // Actualizar tiempos
    user.lastrob = new Date() * 1
    target.lastrobbed = new Date() * 1

    let chance = Math.random() // Probabilidad de 0 a 1

    // 50% de probabilidad de éxito
    if (chance > 0.5) {
        // ÉXITO: Robar entre el 5% y el 10% de lo que tenga
        let stealPercentage = Math.floor(Math.random() * (10 - 5 + 1) + 5) / 100;
        let stolenAmount = Math.floor(target.coin * stealPercentage)

        // Prevención de robos de 0 base
        if (stolenAmount < 1) stolenAmount = 1

        user.coin += stolenAmount
        target.coin -= stolenAmount

        // XP por robo exitoso
        const xpRob = Math.floor(Math.random() * (50 - 30 + 1)) + 30
        user.exp += xpRob
        const rango = getRankLabel(user.level || 1)

        return m.reply(`🥷 *ROBO EXITOSO*\nLograste robar *${stolenAmount} ${moneda}* a *@${global.getJidNum(who)}*.\n> 🪙 Tu wallet: *${user.coin}*\n> ✨ XP: *+${xpRob} XP*\n> 🎖️ Rango: *${rango}*`, null, { mentions: [`${global.getJidNum(who)}@s.whatsapp.net`] })
    } else {
        // FRACASO: Pierde salud, y si la salud llega a 0, pierde dinero
        let healthLoss = Math.floor(Math.random() * (250 - 150 + 1) + 150) // Pierde de 150 a 250 de salud
        user.health -= healthLoss

        let replyMsg = `👮‍♂️ *TE ATRAPARON*\nIntentaste robar a *@${global.getJidNum(who)}* pero la policía te alcanzó. Perdiste en la pelea.\n> ❤️ Salud restada: -*${healthLoss}* (${user.health >= 0 ? user.health : 0}/1000)`

        // Sistema de desmayo/hospital si la salud llega o baja de cero
        if (user.health <= 0) {
            user.health = 1000 // Lo reviven
            let hospitalBillPercentage = 0.15 // Pierde el 15% de su dinero para el hospital
            let hospitalBill = Math.floor(user.coin * hospitalBillPercentage)
            user.coin -= hospitalBill

            if (hospitalBill > 0) {
                replyMsg += `\n\n🚑 *DESMAYADO*: Quedaste inconsciente y la ambulancia te llevó. Costos médicos: -*${hospitalBill} ${moneda}*. Tienes nueva salud: 1000.`
            } else {
                replyMsg += `\n\n🚑 *DESMAYADO*: Quedaste inconsciente y la ambulancia te llevó. Afortunadamente tu wallet estaba vacía y la pasaste gratis. Tienes nueva salud: 1000.`
            }
        }

        return m.reply(replyMsg, null, { mentions: [`${global.getJidNum(who)}@s.whatsapp.net`] })
    }
}

handler.help = ['robar @user', 'rob @user']
handler.tags = ['economy']
handler.command = ['robar', 'rob']
handler.group = true

export default handler

function msToTime(duration) {
    var milliseconds = parseInt((duration % 1000) / 100),
        seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24)

    hours = (hours < 10) ? "0" + hours : hours
    minutes = (minutes < 10) ? "0" + minutes : minutes
    seconds = (seconds < 10) ? "0" + seconds : seconds

    return hours + " Horas " + minutes + " Minutos"
}
