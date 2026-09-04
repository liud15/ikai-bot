import { getRankLabel } from '../../lib/levelRanks.js'
import { getRealJid } from '../../src/lib/family-utils.js'

let robarCooldown = 3600000 // 1 hora en milisegundos

let handler = async (m, { conn, text, usedPrefix, command }) => {
    let who
    const _mentioned = await m.mentionedJid
    const rawWho = m.isGroup
        ? (_mentioned[0] ? _mentioned[0] : m.quoted ? m.quoted.sender : false)
        : m.chat

    // Normalizar LID → PN para buscar correctamente en la DB
    if (rawWho) who = getRealJid(rawWho)
    else who = false

    if (!who) return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` 🥷 *SISTEMA DE ROBOS* 🥷\n\n` +
        ` ⌲ Etiqueta a alguien para intentar robarle.\n\n` +
        `> ✧ Ejemplo: *${usedPrefix + command} @usuario* ✧\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )
    // Comparar también con el sender normalizado
    if (who === getRealJid(m.sender)) return m.reply(
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
        ` ❌ *ACCIÓN INVÁLIDA* ❌\n\n` +
        ` ⌲ No puedes robarte a ti mismo.\n` +
        `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    )

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
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ⏱️ *PRÓFUGO DE LA JUSTICIA* ⏱️\n\n` +
            ` ⌲ Aún te está buscando la policía.\n` +
            `    Espera *${timeRemaining}* antes de volver a robar.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
    }

    let timeSinceTargetRobbed = new Date() - target.lastrobbed
    let targetCooldown = 3600000 // La víctima también tiene 1h de inmunidad después de ser robada/intentada
    if (timeSinceTargetRobbed < targetCooldown) {
        let timeRemainingTarget = msToTime(targetCooldown - timeSinceTargetRobbed)
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 🛡️ *VÍCTIMA PROTEGIDA* 🛡️\n\n` +
            ` ⌲ Esta persona ya sufrió un intento de robo reciente.\n` +
            `    Estará alerta por *${timeRemainingTarget}*.\n\n` +
            `> ✧ Intenta con alguien más ✧\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
    }

    if (user.health < 200) {
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ❤️‍🩹 *MALA SALUD* ❤️‍🩹\n\n` +
            ` ⌲ Tu salud está muy baja (*${user.health}*).\n` +
            `    No tienes fuerzas para asaltar a nadie.\n\n` +
            `> ✧ Usa pociones o ve al hospital ✧\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
    }

    if (target.coin < 100) {
        const whoNum = who.split('@')[0]
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ⚠️ *OBJETIVO POBRE* ⚠️\n\n` +
            ` ⌲ No seas abusivo, *@${whoNum}* tiene menos de 100 ${moneda}s en su wallet.\n` +
            `    No vale la pena el riesgo.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`, null, { mentions: [who] })
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

        const whoNum2 = who.split('@')[0]
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 🥷 *ROBO EXITOSO* 🥷\n\n` +
            ` ⌲ Lograste robar *${stolenAmount} ${moneda}* a *@${whoNum2}*.\n\n` +
            `   ▸ Tu wallet: *${user.coin}*\n` +
            `   ▸ XP: *+${xpRob} XP*\n` +
            `   ▸ Rango: *${rango}*\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`, null, { mentions: [who] })
    } else {
        // FRACASO: Pierde salud, y si la salud llega a 0, pierde dinero
        let healthLoss = Math.floor(Math.random() * (250 - 150 + 1) + 150) // Pierde de 150 a 250 de salud
        user.health -= healthLoss

        const whoNum3 = who.split('@')[0]
        let replyMsg = `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 👮‍♂️ *TE ATRAPARON* 👮‍♂️\n\n` +
            ` ⌲ Intentaste robar a *@${whoNum3}* pero la policía te alcanzó.\n` +
            `    Perdiste en la pelea.\n\n` +
            `   ▸ Salud restada: -*${healthLoss}* (${user.health >= 0 ? user.health : 0}/1000)`

        // Sistema de desmayo/hospital si la salud llega o baja de cero
        if (user.health <= 0) {
            user.health = 1000 // Lo reviven
            let hospitalBillPercentage = 0.15 // Pierde el 15% de su dinero para el hospital
            let hospitalBill = Math.floor(user.coin * hospitalBillPercentage)
            user.coin -= hospitalBill

            if (hospitalBill > 0) {
                replyMsg += `\n\n 🚑 *DESMAYADO*: Quedaste inconsciente y la ambulancia te llevó.\n   ▸ Costos médicos: -*${hospitalBill} ${moneda}*.\n   ▸ Tienes nueva salud: 1000.`
            } else {
                replyMsg += `\n\n 🚑 *DESMAYADO*: Quedaste inconsciente y la ambulancia te llevó.\n   ▸ Afortunadamente tu wallet estaba vacía y la pasaste gratis.\n   ▸ Tienes nueva salud: 1000.`
            }
        }
        
        replyMsg += `\n*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`

        return m.reply(replyMsg, null, { mentions: [who] })
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
