let cooldown = 900000 // 15 minutos en ms

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Groq from 'groq-sdk' // 👈 Importamos Groq

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const LUGARES_PATH = path.join(__dirname, '..', 'src', 'database', 'rpg_lugares.json')

const GROQ_API_KEY = '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'  // 👈 Reemplaza con tu API Key
const GROQ_MODEL = 'llama-3.1-8b-instant'

// Función para pedirle a Groq que narre la aventura (con un timeout de 5s para que no mate el bot si falla)
async function getGroqNarration(contextText, defaultText) {
    if (GROQ_API_KEY === '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') return defaultText // Si no hay Key, usa texto estático 

    try {
        const groq = new Groq({ apiKey: GROQ_API_KEY })
        const promptSystem = `Eres el Dungeon Master (Narrador) de un juego estilo RPG en un chat de WhatsApp. 
REGLAS:
1. Yo te daré las estadísticas de lo que acaba de pasarle al jugador (Lugar, Oro ganado/perdido, Salud, etc).
2. Debes escribir una narración MUY BREVE y épica (MÁXIMO 2 frases, ej: 20-30 palabras) describiendo la escena de acción. 
3. Mantén la narración en SEGUNDA PERSONA ("Te adentraste...", "Un golem te golpeó...").
4. No pongas los números exactos en la narración (el sistema los pondrá después), solo describe la acción.
5. NO uses saludos ni presentaciones. Solo la narrativa directa.
6. Si es victoria, que suene genial. Si es derrota, que suene aterrante pero emocionante.`

        // Promesa con timeout de 5 segundos
        const completion = await Promise.race([
            groq.chat.completions.create({
                messages: [
                    { role: 'system', content: promptSystem },
                    { role: 'user', content: `Genera una micro-narrativa para esto: ${contextText}` }
                ],
                model: GROQ_MODEL,
                temperature: 0.8,
                max_tokens: 100,
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ])

        return completion.choices[0]?.message?.content || defaultText
    } catch (e) {
        console.error('[aventura-groq] Error/Timeout narrando:', e.message)
        return defaultText // Fallback al texto normal si hay error o tarda mucho
    }
}


let handler = async (m, { conn, usedPrefix, command }) => {
    let user = global.db.data.users[m.sender]
    if (!user) return

    let lugares = []
    try {
        const data = fs.readFileSync(LUGARES_PATH, 'utf-8')
        lugares = JSON.parse(data)
    } catch (e) {
        console.error('[aventura] Error leyendo lugares:', e)
        return m.reply('❌ No hay lugares vírgenes para explorar hoy.')
    }

    // Inicialización de variables
    user.health = Number.isFinite(user.health) ? user.health : 1000
    user.coin = Number.isFinite(user.coin) ? user.coin : 0
    user.diamond = Number.isFinite(user.diamond) ? user.diamond : 0
    user.exp = Number.isFinite(user.exp) ? user.exp : 0
    user.lastadventure = user.lastadventure || 0

    // Verificación de Cooldown
    let timeSinceLastAdv = new Date() - user.lastadventure
    if (timeSinceLastAdv < cooldown) {
        let timeRemaining = msToTime(cooldown - timeSinceLastAdv)
        return m.reply(`🏕️ Ya fuiste de aventura recientemente.\nDescansa un rato y vuelve en *${timeRemaining}*.`)
    }

    // Requisito de Salud
    if (user.health < 800) {
        return m.reply(`☠️ *¡Muy arriesgado!*\nTu salud es muy baja (*${user.health}/1000*). Necesitas al menos *800* para sobrevivir en las mazmorras.\nUsa *${usedPrefix}heal* en el hospital para curarte primero.`)
    }

    // Comienzo de la aventura
    user.lastadventure = new Date() * 1

    // Escoger un lugar al azar
    let lugar = lugares[Math.floor(Math.random() * lugares.length)]
    let userName = conn.getName(m.sender) || 'El aventurero'

    await m.react(rwait) // Reacción de espera para que sepa que la IA está narrando

    let txt = `🗡️ *AVENTURA RPG* 🛡️\n_*Lugar:* ${lugar.nombre}_\n\n`
    let rng = Math.random() // Probabilidad (0.0 a 1.0)
    let dynamicStory = ""

    // Resultados (60% Éxito, 25% Falla Menor, 15% Emboscada)
    if (rng >= 0.40) {
        // VICTORIA (60%)
        let coinsGained = Math.floor(Math.random() * (2500 - 1000 + 1)) + 1000
        let expGained = Math.floor(Math.random() * (500 - 200 + 1)) + 200

        user.coin += coinsGained
        user.exp += expGained

        // Petición al narrador
        let context = `El aventurero ${userName} fue a ${lugar.nombre} (${lugar.descripcion}). Tuvo una victoria fácil contra los enemigos de la zona, ganó mucho oro y salió ileso.`
        let defaultMsg = lugar.mensajes?.exito || '¡Derrotaste al guardián local sin despeinarte!'
        dynamicStory = await getGroqNarration(context, defaultMsg)

        txt += `✨ ${dynamicStory}\n\n`
        txt += `> Recogiste: *+${coinsGained} ${moneda}* y *+${expGained} XP*\n`

        // Posibilidad extra de un drop raro (1 Diamante)
        if (Math.random() > 0.95) {
            user.diamond += 1
            txt += `\n💎 *¡DROP RARO!* Encontraste un diamante brillante entre los restos.`
        }

    } else if (rng >= 0.15 && rng < 0.40) {
        // DERROTA MENOR (25%)
        let healthLoss = Math.floor(Math.random() * (300 - 150 + 1)) + 150
        let coinsGained = Math.floor(Math.random() * (300 - 100 + 1)) + 100

        user.health -= healthLoss
        user.coin += coinsGained

        let context = `El aventurero ${userName} fue a ${lugar.nombre} (${lugar.descripcion}). Ganó la pelea pero fue duro, recibió heridas moderadas pero logró llevarse poco oro de saqueo.`
        let defaultMsg = lugar.mensajes?.derrota_menor || 'Te encontraste con un grupo de salvajes y ganaste a duras penas, sufriendo algunos golpes.'
        dynamicStory = await getGroqNarration(context, defaultMsg)

        txt += `🩹 ${dynamicStory}\n\n`
        txt += `> Recogiste solo: *+${coinsGained} ${moneda}*\n> 💔 Daño sufrido: *-${healthLoss} Salud* (Restante: ${user.health})`

    } else {
        // EMBOSCADA FATAL (15%)
        let healthLoss = Math.floor(Math.random() * (500 - 300 + 1)) + 300
        user.health -= healthLoss

        let context = `El aventurero ${userName} fue a ${lugar.nombre} (${lugar.descripcion}). Sufrió una emboscada terrible por monstruos muy fuertes. Recibió daño crítico, no ganó nada y tuvo que huir por su vida.`
        let defaultMsg = lugar.mensajes?.emboscada || 'Una bestia colosal cayó sobre ti causándote heridas graves. Lograste escapar sin botín.'
        dynamicStory = await getGroqNarration(context, defaultMsg)

        txt += `💀 *¡EMBOSCADA!*\n${dynamicStory}\n\n`
        txt += `> 💔 Daño crítico sufrido: *-${healthLoss} Salud*\n`

        if (user.health <= 0) {
            user.health = 1000 // Lo reviven
            let hospitalBillPercentage = 0.15
            let hospitalBill = Math.floor(user.coin * hospitalBillPercentage)
            user.coin -= hospitalBill

            if (hospitalBill > 0) {
                txt += `\n🚑 *INCONSCIENTE*: Perdiste el conocimiento. Otros exploradores te rescataron y llevaron al hospital. Pagaste *-${hospitalBill} ${moneda}*. Tienes salud nueva.`
            } else {
                txt += `\n🚑 *INCONSCIENTE*: Un curandero despistado te reanimó gratis (porque no tienes dinero). Tienes salud nueva.`
            }
        } else {
            txt += `> Salud restante: *${user.health}/1000*`
        }
    }

    await m.react(done) // Quitar reloj de arena

    // Enviar imagen si hay un enlace válido
    if (lugar.foto && lugar.foto.startsWith('http')) {
        await conn.sendMessage(m.chat, {
            text: txt,
            contextInfo: {
                externalAdReply: {
                    title: "🗡️ Aventura RPG",
                    body: "🌟 IKAIBOT-MD RPG NARRATOR",
                    thumbnailUrl: lugar.foto,
                    sourceUrl: "",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m })
    } else {
        await m.reply(txt)
    }
}

handler.help = ['aventura', 'adventure']
handler.tags = ['economy']
handler.command = ['aventura', 'adventure', 'adv']
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

    return hours + "h " + minutes + "m " + seconds + "s"
}
