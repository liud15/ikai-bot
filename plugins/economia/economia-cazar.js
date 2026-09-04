const CREATURE_COOLDOWN = 30 * 60 * 1000 // 30 minutos por criatura
const SESSION_WINDOW   = 30 * 60 * 1000 // ventana de sesión: 30 minutos
const SESSION_MAX      = 3              // máximo de cazas por ventana

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getRankLabel } from '../../lib/levelRanks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ANIMALES_PATH = path.join(__dirname, '..', '..', 'src', 'database', 'rpg_animales.json')

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
    // ── Vol.2 — Tier Común ──
    101: 'el bosque de eucaliptos bajo la lluvia de madrugada',
    102: 'el arroyo de manglar bajo la luna de las mareas',
    103: 'las llanuras de arcilla roja en el borde del altiplano sísmico',
    104: 'el salar ardiente bajo el sol del mediodía',
    106: 'la galería de túneles bajo el jardín de polvo mineral',
    107: 'el tronco caído sobre el pantano de cipreses en la noche',
    134: 'el suelo húmedo del bosque de ámbar bajo el crepúsculo',
    142: 'las dunas costeras de la bahía serena al atardecer',
    // ── Vol.2 — Tier Mágico ──
    105: 'el bosque de nubes empapado tras la lluvia',
    108: 'la estepa nevada de abedules bajo la aurora boreal',
    109: 'el bambusal plateado bajo la luna llena',
    110: 'el altiplano volcánico barrido por el viento andino',
    113: 'el páramo de brezo al filo del acantilado en la niebla',
    114: 'el cañón del desierto al ocaso de cobre',
    117: 'la laguna hipersalina al atardecer rosado',
    119: 'el bosque de pinos quemados bajo la ceniza matinal',
    120: 'el dosel de la selva tropical en la tarde solar',
    124: 'el acantilado ártico de arenisca bajo la tormenta gris',
    125: 'el arrecife de aguas cristalinas bajo el sol del trópico',
    126: 'el canal del arrecife bajo el cielo de tormenta',
    131: 'la llanura de barro intertidal bajo la luna plateada',
    133: 'el patio de piedra del templo antiguo en la noche tranquila',
    135: 'el tronco de resina del bosque de coníferas en la tarde',
    136: 'el campo de mijo azotado por el monzón carmesí',
    137: 'la cripta de jade bajo el templo de piedra cubierto de vides',
    138: 'la llanura árida bajo las torres de adobe del termitero',
    144: 'la boca de madriguera en la sabana al amanecer',
    145: 'la cresta de duna de cuarzo bajo la luna del desierto',
    146: 'el acantilado rocoso bajo el sol vertical',
    147: 'la tundra congelada en medio del vendaval blanco',
    // ── Vol.2 — Tier Épico ──
    111: 'el paso de alta montaña antes de la tormenta de truenos',
    112: 'la llanura anegada tras la tormenta en la sabana',
    115: 'la catedral de selva ecuatorial en las profundidades',
    116: 'el estuario de mareas bajas al amanecer perlado',
    118: 'el río de selva en la penumbra del dosel',
    121: 'la selva de helechos gigantes bajo la lluvia tropical',
    122: 'la sabana eléctrica bajo el frente de tormenta inminente',
    123: 'el cañón volcánico sobre el campo de fumarolas activas',
    127: 'el mar abierto en la cresta de la ola al amanecer',
    128: 'la bóveda del cenote sagrado bajo el rayo de luz solar',
    130: 'la grieta del arrecife nocturno a veinte metros de profundidad',
    132: 'el túnel de azufre en la caverna volcánica activa',
    139: 'el dosel nocturno de la selva tropical bajo la luna llena',
    140: 'la vía del ferrocarril abandonado en el bosque nublado',
    141: 'el matorral calcinado tras el incendio controlado',
    143: 'la sabana de termiteros bajo la tormenta eléctrica',
    // ── Vol.2 — Tier Mítico ──
    129: 'la falla tectónica submarina a cuatro mil metros de profundidad',
    148: 'el fiordo estrecho entre paredes de glaciar vertical',
    149: 'la pradera de zafiro marino en la bahía tropical poco profunda',
    150: 'el mercado fantasma bajo la lluvia del monzón en la noche cerrada',
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
    (nombre) => `🪤 Pusiste una trampa muy elaborada para *${nombre}*... caíste tú mismo en ella. *${nombre}* te tomó foto y se fue. 📸`,
    (nombre) => `🧃 Intentaste seguir el rastro de *${nombre}* por el bosque, pero el rastro te llevó a una tienda de conveniencia. Te compraste un jugo y te fuiste. 🤌`,
    (nombre) => `😤 Le gritaste a *${nombre}*: "¡Prepárate para morir!" y *${nombre}* respondió "¿Quién eres tú?". Nadie sobrevive a eso. 💀`,
    (nombre) => `🎣 Sacaste tu red de caza... estabas usando la red de pescar. *${nombre}* te vio todo el tiempo y decidió no decirte nada por respeto. 🫡`,
    (nombre) => `🧲 El manual de caza dice: *"No caces lo que claramente te puede cazar a ti"*. *${nombre}* califica en esa categoría. Manual guardado. 📖`,
    (nombre) => `🌙 Te pusiste traje de camuflaje nocturno a las 2pm para sorprender a *${nombre}*. *${nombre}* te vio desde tres cuadras de distancia y avisó al grupo. 💬`,
    (nombre) => `🪄 Intentaste lanzarle un hechizo de inmovilización a *${nombre}*, pero te lo lanzaste a ti mismo. Estuviste quieto 10 minutos. *${nombre}* ni se enteró.`,
    (nombre) => `🐔 Tus pasos en el bosque sonaban tan fuerte que *${nombre}* los confundió con un terremoto, llamó a emergencias y cuando llegaron los guardias... te encontraron a ti. 🚨`,
    (nombre) => `😴 Llegaste tan tarde a la emboscada que *${nombre}* ya se había ido, comido, dormido y vuelto a llegar. Te dejó una nota que decía *"mejor suerte la próxima"*.`,
    (nombre) => `🧸 El bosque te rechazó antes de entrar. Los árboles sintieron que ibas a cazar a *${nombre}* y cerraron el paso. Hasta la naturaleza te dijo que no. 🌲`,
    (nombre) => `🤡 Tu intento de cazar a *${nombre}* fue tan patético que los animales del bosque se reunieron para observar. Dieron una ovación cuando huiste. 👏`,
    (nombre) => `🔕 Activaste el modo sigiloso, pero olvidaste que tenías el volumen al máximo. Tu notificación de WhatsApp delató tu posición a *${nombre}*. 📳`,
    (nombre) => `🧭 Seguiste el mapa del tesoro creyendo que llevaría a *${nombre}*... te llevó a una plaza vacía. Había una paloma. La paloma te juzgó. 🕊️`,
    (nombre) => `🏃 Cuando viste a *${nombre}* de frente, tu cerebro dijo "huye" y tus piernas obedecieron antes de que pudieras decidir. La persecución fue al revés. 😅`,
    (nombre) => `🧯 Quisiste usar una bomba de humo para confundir a *${nombre}*... pero la sacaste sin quitarle el seguro. Diez minutos después seguías intentándolo frente a *${nombre}*. 💨`,
    (nombre) => `📜 El código de honor del cazador prohíbe atacar a alguien más inteligente, más rápido y más guapo que tú. *${nombre}* marcó todos esos casilleros. Caza rechazada.`,
    (nombre) => `🎺 Intentaste el clásico ataque sorpresa... pero alguien en el fondo tocó una trompeta justo cuando ibas a atacar. *${nombre}* se giró y te vio. ¿Eras tú el de la trompeta?`,
    (nombre) => `🧈 Pisaste una tarima de madera mojada camino a *${nombre}*, resbalaste de forma épica y terminaste en el foso con los otros cazadores fallidos. Al menos tienen compañía. 🕳️`,
    (nombre) => `🦂 El bestiario clasifica a *${nombre}* como: *PELIGRO NIVEL OMEGA - NO PERSEGUIR, NO MIRAR, NO RESPIRAR CERCA*. Misión abortada por protocolo de supervivencia. 🚫`,
    (nombre) => `📱 *${nombre}* recibió una notificación de que alguien intentaría cazarle hoy. La leyó, rió, y siguió con su día. Tú nunca apareciste porque llegaste tarde. ⏰`,
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
    if (!user.cazaCooldowns || typeof user.cazaCooldowns !== 'object') user.cazaCooldowns = {}
    if (!user.cazaSesion  || typeof user.cazaSesion  !== 'object') user.cazaSesion = { inicio: 0, contador: 0 }

    // ── Resetear sesión si la ventana de 30 min ya expiró ──────────
    if (Date.now() - user.cazaSesion.inicio >= SESSION_WINDOW) {
        user.cazaSesion = { inicio: Date.now(), contador: 0 }
    }

    // XP por tier
    const TIER_XP = {
        'Común':  { min: 15,  max: 30  },
        'Mágico': { min: 35,  max: 60  },
        'Épico':  { min: 65,  max: 100 },
        'Mítico': { min: 120, max: 200 }
    }

    // Helper: comprueba si una criatura está en cooldown para este usuario
    const estaEnCooldown = (animalId) => {
        const ultimo = user.cazaCooldowns[animalId] || 0
        return (Date.now() - ultimo) < CREATURE_COOLDOWN
    }

    // Helper: tiempo restante de criatura formateado
    const tiempoRestante = (animalId) => {
        const ultimo = user.cazaCooldowns[animalId] || 0
        return msToTime(CREATURE_COOLDOWN - (Date.now() - ultimo))
    }

    // ── Límite de sesión: máx SESSION_MAX cazas por ventana ────────
    if (user.cazaSesion.contador >= SESSION_MAX) {
        const tiempoSesion = msToTime(SESSION_WINDOW - (Date.now() - user.cazaSesion.inicio))
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 🛑 *LÍMITE ALCANZADO* 🛑\n\n` +
            ` ⌲ Ya cazaste *${SESSION_MAX} bestias* en esta\n` +
            `    ventana de 30 minutos.\n\n` +
            ` ⌲ Tu stamina se renueva en: *${tiempoSesion}*\n` +
            `> ✧ Usa ${usedPrefix}bestiario para planear ✧\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
    }

    // Requisito de Salud
    if (user.health < 500) {
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 🤒 *POCA ENERGÍA* 🤒\n\n` +
            ` ⌲ Tu salud es muy baja (*${user.health}/1000*).\n` +
            ` ⌲ Una criatura podría acabar contigo.\n\n` +
            `> ✧ Ve al hospital con *${usedPrefix}heal* ✧\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
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
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                ` ❌ *CRIATURA NO ENCONTRADA* ❌\n\n` +
                ` ⌲ No encontré esa criatura.\n\n` +
                `> ✧ Consulta el catálogo con *${usedPrefix}bestiario* ✧\n` +
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
            )
        }

        // Verificar cooldown de criatura específica
        if (estaEnCooldown(encontrado.id)) {
            const tr = tiempoRestante(encontrado.id)
            return m.reply(
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                ` ⏳ *CRIATURA DESCANSANDO* ⏳\n\n` +
                ` ⌲ *${encontrado.nombre}* ya fue cazada.\n` +
                ` ⌲ Regresará a su hábitat en *${tr}*.\n\n` +
                `> ✧ Puedes cazar otra criatura mientras ✧\n` +
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
            )
        }

        animal = encontrado
    } else {
        // Caza aleatoria con sistema de tiers — excluye criaturas en cooldown
        // 40% Común | 35% Mágico | 20% Épico | 5% Mítico
        const porTier = (t) => animales.filter(a => a.tier === t && !estaEnCooldown(a.id))
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

        // Si el tier sorteado no tiene criaturas disponibles, busca en todos los tiers
        if (!pool || pool.length === 0) {
            pool = animales.filter(a => !estaEnCooldown(a.id))
        }

        // Si absolutamente todas están en cooldown, informar cuándo vuelve la primera
        if (!pool || pool.length === 0) {
            const proxima = Object.entries(user.cazaCooldowns)
                .map(([id, ts]) => ({ id: parseInt(id), restante: CREATURE_COOLDOWN - (Date.now() - ts) }))
                .filter(x => x.restante > 0)
                .sort((a, b) => a.restante - b.restante)[0]
            const tiempoProx = proxima ? msToTime(proxima.restante) : '0m 00s'
            return m.reply(
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                ` 😴 *BOSQUE DESPEJADO* 😴\n\n` +
                ` ⌲ Has cazado todas las criaturas.\n\n` +
                `> ✧ La próxima estará lista en *${tiempoProx}* ✧\n` +
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
            )
        }

        animal = pool[Math.floor(Math.random() * pool.length)]
    }

    // ─── INICIO DE LA CAZA — registrar cooldown de criatura y sesión ──
    user.cazaCooldowns[animal.id] = Date.now()
    user.cazaSesion.contador += 1
    // Mostrar cazas restantes en esta sesión (info útil al jugador)
    const cazasRestantes = SESSION_MAX - user.cazaSesion.contador

    const habitat = HABITATS[animal.id] || 'el bosque'

    // Peligro efectivo = peligro base del JSON + bonus por tier
    const efectivoPeligro = Math.min(1, animal.peligro + (TIER_DANGER_BONUS[animal.tier] || 0))

    const sesiónLabel = cazasRestantes > 0
        ? `🎯 Cazas restantes: *${cazasRestantes}/${SESSION_MAX}*`
        : `⛔ Última caza de la sesión`
    let txt = `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
              ` 🌿 *ZONA DE CAZA* 🏹\n\n` +
              ` ⌲ Te adentras en *${habitat}*\n` +
              `    y encuentras un *${animal.nombre}*.\n\n`
    txt += ` ── ${TIER_BADGE[animal.tier] || animal.tier} ──\n ⚠️ Peligro: ${Math.round(efectivoPeligro * 100)}%\n`
    txt += ` ${sesiónLabel}\n\n`

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
            txt += ` 💥 *EL ANIMAL HUYÓ*\n ⌲ _${escapeMsg}_\n\n`
            txt += ` 💔 *DAÑO SUFRIDO*\n ⌲ *-${healthLoss}* de salud (Quedan: *${user.health}* ❤️)\n ⌲ ❌ No conseguiste botín.\n`
        } else {
            // Caza sangrienta (con daño pero con premio)
            let coinsGained = Math.floor(Math.random() * (animal.recompensaMax - animal.recompensaMin + 1)) + animal.recompensaMin
            user.coin += coinsGained
            const xpRange2 = TIER_XP[animal.tier] || { min: 15, max: 30 }
            const xpSang = Math.floor(Math.random() * ((xpRange2.max - xpRange2.min) / 2 + 1)) + xpRange2.min
            user.exp += xpSang
            let defeatMsg = animal.mensajes?.derrota || `El ${animal.nombre} te lastimó pero lograste abatirlo.`
            txt += ` 🩸 *CAZA SANGRIENTA*\n ⌲ _${defeatMsg}_\n\n`
            txt += ` 💔 *DAÑO SUFRIDO*\n ⌲ *-${healthLoss}* de salud (Quedan: *${user.health}* ❤️)\n\n`
            txt += ` 🎁 *BOTÍN*\n ⌲ 🪙 *+${coinsGained} ${moneda}* | ✨ *+${xpSang} XP*\n`
        }

        if (user.health <= 0) {
            user.health = 1000
            let hospitalBill = Math.floor(user.coin * 0.15)
            user.coin -= hospitalBill
            txt += `\n 🚑 *DESMAYADO*\n ⌲ Tus heridas fueron muy graves.\n ⌲ Pagaste al hospital *-${hospitalBill} ${moneda}*.\n ⌲ Tienes salud al 1000.\n`
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
        txt += ` 🎯 *CAZA PERFECTA*\n ⌲ _${exitoMsg}_\n\n`
        txt += ` 🎁 *BOTÍN*\n ⌲ 🪙 *+${coinsGained} ${moneda}* | ✨ *+${xpGained} XP*\n ⌲ 🎖️ Rango: *${rango}*\n`
    }
    txt += `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`

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
