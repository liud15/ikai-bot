let cooldown = 300000 // 5 minutos en milisegundos

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getRankLabel } from '../lib/levelRanks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ANIMALES_PATH = path.join(__dirname, '..', 'src', 'database', 'rpg_animales.json')

const TIER_BADGE = {
    'Común': '⚪ Común',
    'Mágico': '🔵 Mágico',
    'Épico': '🟣 Épico',
    'Mítico': '🔴 Mítico'
}

// Bonus de dificultad adicional por tier (no modifica el JSON, solo el cálculo)
const TIER_DANGER_BONUS = {
    'Común':  0.20,  // Comunes: peligro base + 20% → promedio ~28%
    'Mágico': 0.22,  // Mágicos: peligro base + 22% → promedio ~51%
    'Épico':  0.10,  // Épicos: peligro base + 10% → promedio ~69%
    'Mítico': 0.05   // Míticos: ya muy altos, pequeño empuje extra
}

// Hábitat de cada bestia (por ID) para personalizar el intro de la caza
const HABITATS = {
    // ── Tier Común ──
    1: 'el bosque lunar',
    2: 'el pantano de las esporas',
    3: 'las ramas del árbol de la tormenta',
    4: 'los campos volcánicos',
    5: 'las cimas de la montaña estelar',
    6: 'el bosque encantado',
    7: 'el prado tóxico',
    8: 'las playas de granito',
    9: 'el lago de las ilusiones',
    10: 'el río místico',
    // ── Tier Mágico ──
    11: 'los campos de batalla abandonados',
    12: 'las cavernas del subsuelo',
    13: 'el bosque muerto bajo la luna roja',
    14: 'las ruinas de la jungla antigua',
    15: 'las cuevas de hongos bioluminiscentes',
    16: 'los cielos de la tormenta perpetua',
    17: 'el cementerio abandonado',
    18: 'el pantano de las ruinas industriales',
    19: 'las tierras baldías del norte',
    20: 'la biblioteca mágica en las sombras',
    44: 'las profundidades oscuras del océano',
    45: 'el claro del bosque de plata',
    51: 'el jardín maldito',
    // ── Tier Épico ──
    21: 'el bosque de los árboles milenarios',
    22: 'las dunas del desierto ardiente',
    23: 'los cielos de las nubes de tormenta',
    24: 'la tundra helada del norte',
    25: 'las ruinas de la civilización perdida',
    26: 'la jungla prehistórica',
    27: 'la sabana en llamas',
    28: 'los lagos subterráneos de las montañas',
    29: 'la tundra ártica bajo el trueno',
    30: 'las dunas de arena del desierto profundo',
    46: 'el pantano carmesí al atardecer',
    47: 'el océano abierto en la noche',
    48: 'las dunas doradas al crepúsculo',
    // ── Tier Mítico ──
    31: 'las tierras corrompidas y malditas',
    32: 'el corazón tectónico de las montañas',
    33: 'el volcán en erupción activa',
    34: 'las ruinas del templo sagrado en llamas',
    35: 'el reino devastado por la calamidad',
    36: 'las profundidades insondables de la tierra',
    37: 'las puertas ardientes del inframundo',
    38: 'el bosque petrificado por la maldición',
    39: 'el vacío insondable del espacio cósmico',
    40: 'el castillo celestial flotante',
    49: 'la dimensión sin nombre del vacío absoluto',
    50: 'el océano primordial sin límites',
    52: 'las cimas de las montañas del eterno relámpago',
    // ── Tier Común (Nuevos) ──
    53: 'los callejones oscuros del mercado mágico',
    54: 'los huertos de cristal brillante',
    55: 'las aguas termales volcánicas',
    56: 'los archivos olvidados de la academia arcana',
    57: 'las grutas de cuarzo resonante',
    // ── Tier Mágico (Nuevos) ──
    58: 'los jardines de ceniza azul',
    59: 'las estepas de los tornados esmeralda',
    60: 'la jungla del tiempo suspendido',
    61: 'el bosque de la niebla violeta tóxica',
    62: 'el desierto de los espejismos de cristal',
    // ── Tier Épico (Nuevos) ──
    63: 'la cuenca del río oscuro devorado',
    64: 'los picos nevados manchados de sangre',
    65: 'el cañón de las fallas tectónicas abiertas',
    66: 'las cúpulas de la catedral gótica en ruinas',
    67: 'el epicentro del vacío del bosque oscuro',
    // ── Tier Mítico (Nuevos) ──
    68: 'las fosas abisales que rodean el continente',
    69: 'el altar flotante del sol negro',
    70: 'el puente de luz entre las estrellas fugaces',
    71: 'las llanuras desoladas de la escarcha eterna',
    72: 'el archipiélago que camina sobre el mar tempestuoso',
    // ── Tier Épico (Nuevos) ──
    76: 'los pasillos cambiantes del laberinto de piedra',
    77: 'las orillas fangosas del río del inframundo',
    // ── Tier Mítico (Nuevos) ──
    73: 'el altar sagrado bajo el cielo oscurecido por relámpagos',
    74: 'la cima de la montaña de los cinco elementos',
    75: 'el horizonte de sucesos del agujero negro distorsionado',
    78: 'el santuario sumergido de memorias líquidas',
    79: 'la pradera polar bajo la aurora boreal',
    80: 'el bosque primordial cubierto de niebla dorada',
    81: 'el bosque nuboso de medianoche',
    82: 'el archivo desértico enterrado en arena',
    83: 'la catedral de hielo bajo el océano ártico',
    84: 'el cañón oceánico de cristal sonoro',
    85: 'el campo de huesos al atardecer',
    86: 'el pantano boreal del bosque invertido',
    87: 'el bosque de bambú bajo lluvia intensa',
    88: 'la poza termal del santuario de sueños',
    89: 'la pradera alta junto al bosque antiguo',
    90: 'la selva hundida bajo tormenta monzónica',
    91: 'la fosa hadal de gravedad imposible',
    92: 'la forja volcánica bajo la montaña',
    93: 'el salar blanco de espejismos infinitos',
    94: 'la sabana crepuscular del observatorio estelar',
    95: 'la zanja sagrada del río profundo',
    96: 'la red subterránea de raíces profundas',
    97: 'el bambusal blanco de la montaña fantasma',
    98: 'el observatorio submarino de mareas eternas',
    99: 'la pirámide selvática del vacío nocturno',
    100: 'la grieta dimensional microscópica',
}

const CAZAR_USUARIO_MSGS = [
    (nombre) => `🏹 Apuntaste tu arco hacia *${nombre}*... pero justo antes de disparar te miró con esos ojos y bajaste el arco avergonzado. 💀`,
    (nombre) => `😂 Intentaste cazar a *${nombre}* pero se dio la vuelta, te miró fijo y dijo "¿qué haces?". Te fuiste corriendo sin decir nada.`,
    (nombre) => `🐾 *${nombre}* detectó tu presencia antes de que pudieras acercarte, sacó el teléfono, te grabó y te mandó al grupo. GG.`,
    (nombre) => `🌿 Te adentraste en el bosque buscando a *${nombre}*... pero resulta que *${nombre}* ya estaba allí cazando. Ahora eres la presa. 🫵`,
    (nombre) => `🎯 Fallaste cada flecha, tropezaste con una raíz y *${nombre}* te sacó foto mientras estabas en el suelo. La caza terminó antes de empezar.`,
    (nombre) => `🧠 El sistema de caza detectó que *${nombre}* tiene más inteligencia que todos los animales del bestiario juntos. Caza cancelada por seguridad.`,
    (nombre) => `🍃 Te escondiste detrás de un árbol esperando a *${nombre}*... pero era tan pequeño que *${nombre}* te vio de inmediato y preguntó si estabas bien. 😐`,
    (nombre) => `⚰️ Lanzaste la red, pero *${nombre}* simplemente la esquivó, te miró con lástima y siguió su camino. Nadie habló de esto nunca más.`,
    (nombre) => `🗡️ Desenfundaste tu arma frente a *${nombre}*... y *${nombre}* desenfundó la suya. Era más grande. Guardaste la tuya y dijiste "me equivoqué de persona".`,
    (nombre) => `🦆 El bestiario no tiene registrado a *${nombre}* porque los humanos no cazan personas. O eso dice el reglamento. Por ahora. 👀`,
]


let handler = async (m, { conn, usedPrefix, command, text }) => {
    let user = global.db.data.users[m.sender]
    if (!user) return

    // Si menciona a alguien, responder con mensaje gracioso
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        const mencionado = m.mentionedJid[0]
        const nombre = '@' + (mencionado.split('@')[0])
        const msgFn = CAZAR_USUARIO_MSGS[Math.floor(Math.random() * CAZAR_USUARIO_MSGS.length)]
        return conn.sendMessage(m.chat, {
            text: msgFn(nombre),
            mentions: [mencionado]
        }, { quoted: m })
    }

    let animales = []
    try {
        const data = fs.readFileSync(ANIMALES_PATH, 'utf-8')
        animales = JSON.parse(data)
    } catch (e) {
        console.error('[cazar] Error leyendo animales:', e)
        return m.reply('❌ No hay animales en el bosque hoy.')
    }

    // Inicialización de variables
    user.health = Number.isFinite(user.health) ? user.health : 1000
    user.coin = Number.isFinite(user.coin) ? user.coin : 0
    user.exp = Number.isFinite(user.exp) ? user.exp : 0
    user.lastcazar = user.lastcazar || 0

    // XP por tier
    const TIER_XP = {
        'Común':  { min: 15,  max: 30  },
        'Mágico': { min: 35,  max: 60  },
        'Épico':  { min: 65,  max: 100 },
        'Mítico': { min: 120, max: 200 }
    }

    // Verificación de Cooldown
    let timeSinceLastHunt = new Date() - user.lastcazar
    if (timeSinceLastHunt < cooldown) {
        let timeRemaining = msToTime(cooldown - timeSinceLastHunt)
        return m.reply(`🏹 Tus armas se están reparando.\nVuelve al bosque en *${timeRemaining}*.`)
    }

    // Requisito de Salud
    if (user.health < 500) {
        return m.reply(`🤒 *Poca Energía*\nTu salud de cazador es muy baja (*${user.health}/1000*). Una criatura podría acabar contigo.\nVe al hospital con *${usedPrefix}heal* para curarte primero.`)
    }

    // ─── SELECCIÓN DE ANIMAL ──────────────────────────────────────
    let animal

    if (text && text.trim().length > 0) {
        // El usuario eligió un objetivo específico por nombre
        const busqueda = text.trim().toLowerCase()
        const encontrado = animales.find(a =>
            a.nombre.toLowerCase().includes(busqueda)
        )

        if (!encontrado) {
            return m.reply(
                `❌ No encontré esa criatura en el bestiario.\n` +
                `Consulta el catálogo completo con *${usedPrefix}bestiario*.`
            )
        }

        animal = encontrado
    } else {
        // Caza aleatoria con sistema de tiers (dinámico, filtra por campo tier)
        // 40% Común | 35% Mágico | 20% Épico | 5% Mítico
        const porTier = (t) => animales.filter(a => a.tier === t)
        let r = Math.random()
        let pool
        if (r > 0.95) {
            pool = porTier('Mítico')
        } else if (r > 0.75) {
            pool = porTier('Épico')
        } else if (r > 0.40) {
            pool = porTier('Mágico')
        } else {
            pool = porTier('Común')
        }
        animal = pool[Math.floor(Math.random() * pool.length)]
    }

    // ─── INICIO DE LA CAZA ────────────────────────────────────────
    user.lastcazar = new Date() * 1

    const habitat = HABITATS[animal.id] || 'el bosque'

    // Peligro efectivo = peligro base del JSON + bonus por tier
    const efectivoPeligro = Math.min(1, animal.peligro + (TIER_DANGER_BONUS[animal.tier] || 0))

    let txt = `🌿 *ZONA DE CAZA*\nTe adentras en *${habitat}* y encuentras un *${animal.nombre}*.\n`
    txt += `${TIER_BADGE[animal.tier] || animal.tier} | ⚠️ Peligro: ${Math.round(efectivoPeligro * 100)}%\n\n`

    let rng = Math.random()

    if (rng < efectivoPeligro) {
        // Daño escalado por tier
        const TIER_DAMAGE = {
            'Común':  { min: 50,  max: 120 },
            'Mágico': { min: 100, max: 200 },
            'Épico':  { min: 180, max: 300 },
            'Mítico': { min: 280, max: 450 }
        }
        const dmgRange = TIER_DAMAGE[animal.tier] || { min: 8, max: 18 }
        let healthLoss = Math.floor(Math.random() * (dmgRange.max - dmgRange.min + 1)) + dmgRange.min
        user.health -= healthLoss

        // Probabilidad de escape (Míticos escapan poco — si te lastiman, al menos llevas premio)
        const TIER_ESCAPE_CHANCE = {
            'Común':  0.65,  // 65% escapa sin premio
            'Mágico': 0.50,  // 50/50
            'Épico':  0.35,  // 35% escapa, 65% sangrienta con premio
            'Mítico': 0.20   // 20% escapa, 80% sangrienta con premio
        }
        const escapeChance = TIER_ESCAPE_CHANCE[animal.tier] ?? 0.5

        if (Math.random() < escapeChance) {
            // El animal escapó
            let escapeMsg = animal.mensajes?.escape || `El ${animal.nombre} se defendió y escapó!`
            txt += `💥 *El animal huyó!*\n> ${escapeMsg}\n`
            txt += `> Recibiste *-${healthLoss}* de salud (Te quedan *${user.health}* ❤️)\nNo conseguiste ninguna moneda esta vez.`
        } else {
            // Caza sangrienta (con daño pero con premio)
            let coinsGained = Math.floor(Math.random() * (animal.recompensaMax - animal.recompensaMin + 1)) + animal.recompensaMin
            user.coin += coinsGained
            const xpRange2 = TIER_XP[animal.tier] || { min: 15, max: 30 }
            const xpSang = Math.floor(Math.random() * ((xpRange2.max - xpRange2.min) / 2 + 1)) + xpRange2.min
            user.exp += xpSang
            let defeatMsg = animal.mensajes?.derrota || `El ${animal.nombre} te lastimó pero lograste abatirlo.`
            txt += `🩸 *Caza Sangrienta*\n> ${defeatMsg}\n`
            txt += `> Recibiste *-${healthLoss}* de salud (Te quedan *${user.health}* ❤️)\n`
            txt += `> Lograste vender sus restos por *${coinsGained} ${moneda}*. | ✨ *+${xpSang} XP*`
        }

        if (user.health <= 0) {
            user.health = 1000
            let hospitalBill = Math.floor(user.coin * 0.15)
            user.coin -= hospitalBill
            txt += `\n\n🚑 *DESMAYADO*: Tus heridas fueron muy graves. Te recogieron los guardias del bosque. Pagaste al hospital *-${hospitalBill} ${moneda}*. Tienes salud al 1000.`
        }

    } else {
        // Caza exitosa
        let coinsGained = Math.floor(Math.random() * (animal.recompensaMax - animal.recompensaMin + 1)) + animal.recompensaMin
        user.coin += coinsGained
        const xpRangeT = TIER_XP[animal.tier] || { min: 15, max: 30 }
        const xpGained = Math.floor(Math.random() * (xpRangeT.max - xpRangeT.min + 1)) + xpRangeT.min
        user.exp += xpGained
        const rango = getRankLabel(user.level || 1)
        let exitoMsg = animal.mensajes?.exito || `Abatiste al ${animal.nombre} sin sufrir daño.`
        txt += `🎯 *CAZA PERFECTA*\n> ${exitoMsg}\n`
        txt += `> Lograste vender su piel/carne por *${coinsGained} ${moneda}*. | ✨ *+${xpGained} XP*\n`
        txt += `> 🎖️ Rango actual: *${rango}*`
    }

    // Enviar la imagen completa si el animal tiene foto
    if (animal.foto && animal.foto.startsWith('http')) {
        await conn.sendMessage(m.chat, {
            image: { url: animal.foto },
            caption: txt
        }, { quoted: m })
    } else {
        await m.reply(txt)
    }
}

handler.help = ['cazar [nombre]', 'hunt']
handler.tags = ['economy']
handler.command = ['cazar', 'hunt']
handler.group = true

export default handler

function msToTime(duration) {
    var milliseconds = parseInt((duration % 1000) / 100),
        seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24)

    minutes = (minutes < 10) ? "0" + minutes : minutes
    seconds = (seconds < 10) ? "0" + seconds : seconds

    return minutes + "m " + seconds + "s"
}
