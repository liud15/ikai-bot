// ⛏️ economia-mineria.js — Sistema de Minería RPG
// Usa: lastmining (cooldown), inventory (materiales), coin, exp, health, diamond
import fetch from 'node-fetch'

const MINING_COOLDOWN = 3 * 60 * 60 * 1000 // 3 horas

// ─── DEFINICIÓN DE MINAS ─────────────────────────────────────────────────────
// Cada mina tiene 5 slots de foto (fotos[0..4]) que corresponden a los
// prompts del archivo prompts_mineria.txt según se indica en los comentarios.
// ⚠️ Pega la URL de Imgur generada con el prompt correcto en el slot vacío.

const MINAS = [
    {
        id: 1,
        nombre: 'Mina de Cobre',
        emoji: '▪',
        descripcion: 'Galerías superficiales llenas de polvo y mineral ordinario.',
        tier: 'Común',
        peligro: 0.15,
        // ── FOTOS ── (prompts_mineria.txt — Sección TIER COMÚN, prompts 1-5)
        fotos: [
            'https://i.pinimg.com/originals/27/83/14/27831469c886f728005447aab744cda2.jpg',  // Prompt 1  → Entrada a la Mina de Cobre            (uso: general/lista)
            'https://i.pinimg.com/originals/06/80/f6/0680f645a44f1f6e76f032562aaf1260.jpg',  // Prompt 2  → Veta de Cobre Descubierta              (uso: éxito)
            'https://i.pinimg.com/originals/cb/b5/51/cbb551de02ae7673f7ec25430f297866.jpg',  // Prompt 3  → Derrumbe en la Mina de Cobre          (uso: derrumbe sin botín)
            'https://i.pinimg.com/originals/c3/8e/54/c38e542275686a045936637683001b5d.jpg',  // Prompt 4  → Vagoneta de Mineral de Cobre          (uso: accidente con botín)
            'https://i.pinimg.com/originals/9e/21/61/9e2161d2fd0a734cc811a44f8bb656b5.jpg',  // Prompt 5  → Polvo de Mineral Flotando en la Galería (uso: éxito alternativo)
        ],
        minerales: [
            { nombre: 'mineral_cobre',  emoji: '◈', label: 'Cobre',  min: 3, max: 10, peso: 50 },
            { nombre: 'mineral_hierro', emoji: '◈', label: 'Hierro', min: 1, max: 5,  peso: 30 },
            { nombre: 'mineral_carbon', emoji: '▪', label: 'Carbón', min: 2, max: 8,  peso: 20 },
        ],
        coinMin: 80,  coinMax: 250,
        expMin: 10,   expMax: 30,
        mensajes: {
            exito:    'Excavaste con precisión y llenaste tu bolsa de mineral.',
            peligro:  'El techo crujió sobre ti mientras picabas la roca.',
            derrumbe: 'Una grieta se abrió y tuviste que escapar corriendo.',
        }
    },
    {
        id: 2,
        nombre: 'Mina de Plata',
        emoji: '◈',
        descripcion: 'Cavernas más profundas con vetas relucientes de plata pura.',
        tier: 'Mágico',
        peligro: 0.28,
        // ── FOTOS ── (prompts_mineria.txt — Sección TIER MÁGICO, prompts 6-10)
        fotos: [
            'https://i.pinimg.com/originals/ee/1e/ff/ee1effd31ee7c290ed310769c849f7d6.jpg',  // Prompt 6  → Galería de Plata Reluciente            (uso: general/lista)
            'https://i.pinimg.com/originals/0d/f7/38/0df738c1be09075d10c771f7c5a69eed.jpg',  // Prompt 7  → Cueva de Cuarzo y Plata                (uso: éxito)
            'https://i.pinimg.com/originals/84/76/c9/8476c9d36a00396e7c684f27a23b3784.jpg',  // Prompt 8  → Gas Tóxico en la Mina de Plata        (uso: derrumbe sin botín)
            'https://i.pinimg.com/originals/ce/a4/6c/cea46c62bec80e72ece521976319b89b.jpg',  // Prompt 9  → Veta de Plata Perfecta                 (uso: accidente con botín)
            'https://i.pinimg.com/originals/0b/c9/c6/0bc9c663e59ffe7c580d0fe8c5ccf066.jpg',  // Prompt 10 → Inundación Parcial de la Galería       (uso: éxito alternativo)
        ],
        minerales: [
            { nombre: 'mineral_plata',  emoji: '◈', label: 'Plata',  min: 2, max: 6, peso: 40 },
            { nombre: 'mineral_hierro', emoji: '◈', label: 'Hierro', min: 1, max: 4, peso: 30 },
            { nombre: 'mineral_cuarzo', emoji: '◇', label: 'Cuarzo', min: 1, max: 3, peso: 20 },
            { nombre: 'mineral_cobre',  emoji: '◈', label: 'Cobre',  min: 1, max: 3, peso: 10 },
        ],
        coinMin: 250, coinMax: 600,
        expMin: 30,   expMax: 70,
        mensajes: {
            exito:    'Las vetas de plata brillaron ante tu pico magistral.',
            peligro:  'Gases tóxicos te hicieron perder la orientación por un momento.',
            derrumbe: 'Una roca desprendida te golpeó y tuviste que retirarte con heridas.',
        }
    },
    {
        id: 3,
        nombre: 'Mina de Zafiro',
        emoji: '◆',
        descripcion: 'Profundidades azuladas donde la magia cristaliza en gemas puras.',
        tier: 'Épico',
        peligro: 0.45,
        // ── FOTOS ── (prompts_mineria.txt — Sección TIER ÉPICO, prompts 11-15)
        fotos: [
            'https://i.pinimg.com/originals/a0/db/45/a0db45a346a05bae3e6e4d251c384954.jpg',  // Prompt 11 → Caverna de Cristales de Zafiro         (uso: general/lista)
            'https://i.pinimg.com/originals/c5/75/6c/c5756c8afd2d31cae063bfdae39b14ba.jpg',  // Prompt 12 → Rayo de Luz en la Caverna de Zafiro   (uso: éxito)
            'https://i.pinimg.com/originals/46/18/59/461859918953776985928db39f3d36ec.jpg',  // Prompt 13 → Criatura Subterránea Despertada        (uso: derrumbe sin botín)
            'https://i.pinimg.com/originals/df/f2/0f/dff20f8f4235cdd62f6c844993184105.jpg',  // Prompt 14 → Rubíes en la Pared de Zafiro          (uso: accidente con botín)
            'https://i.pinimg.com/originals/1d/7d/c3/1d7dc37770704321bc42b09631c217f8.jpg',  // Prompt 15 → Derrumbe Catastrófico en Mina de Zafiro (uso: éxito alt/ko)
        ],
        minerales: [
            { nombre: 'mineral_zafiro', emoji: '◆', label: 'Zafiro', min: 1, max: 3, peso: 35 },
            { nombre: 'mineral_rubi',   emoji: '◆', label: 'Rubí',   min: 1, max: 2, peso: 25 },
            { nombre: 'mineral_plata',  emoji: '◈', label: 'Plata',  min: 1, max: 4, peso: 25 },
            { nombre: 'mineral_cuarzo', emoji: '◇', label: 'Cuarzo', min: 2, max: 5, peso: 15 },
        ],
        coinMin: 600,  coinMax: 1400,
        expMin: 70,    expMax: 140,
        mensajes: {
            exito:    'La gema cedió ante tu habilidad y cayó perfecta en tu mano.',
            peligro:  'Criaturas subterráneas despertaron con el eco de tu pico.',
            derrumbe: 'El corredor colapsó parcialmente. Te salvaste por poco, con heridas graves.',
        }
    },
    {
        id: 4,
        nombre: 'Mina Abismal',
        emoji: '✦',
        descripcion: 'Las entrañas de la tierra donde el roce de lo arcano vuelve cada mineral algo sagrado.',
        tier: 'Mítico',
        peligro: 0.65,
        // ── FOTOS ── (prompts_mineria.txt — Sección TIER MÍTICO, prompts 16-20)
        fotos: [
            'https://i.pinimg.com/originals/e5/a5/db/e5a5db58717d72c9826e18d8a65c5dc3.jpg',  // Prompt 16 → Las Profundidades Abisales             (uso: general/lista)
            'https://i.pinimg.com/originals/22/8c/0a/228c0a867f5be76bba098cf981c3127d.jpg',  // Prompt 17 → Corazón de la Mina Abismal            (uso: éxito)
            'https://i.pinimg.com/orignals/d2/b5/97/d2b597b233c7588ff811c6cea1ddda73.jpg',  // Prompt 18 → Entidad Oscura en las Profundidades    (uso: derrumbe sin botín)
            '',  // Prompt 19 → Suelo del Abismo Derrumbándose         (uso: accidente con botín)
            '',  // Prompt 20 → Veta de Obsidiana Sagrada con Runas   (uso: éxito alternativo)
        ],
        minerales: [
            { nombre: 'mineral_obsidiana', emoji: '✦', label: 'Obsidiana', min: 1, max: 2, peso: 30 },
            { nombre: 'mineral_zafiro',    emoji: '◆', label: 'Zafiro',    min: 1, max: 2, peso: 25 },
            { nombre: 'mineral_rubi',      emoji: '◆', label: 'Rubí',      min: 1, max: 2, peso: 25 },
            { nombre: 'mineral_plata',     emoji: '◈', label: 'Plata',     min: 1, max: 3, peso: 20 },
        ],
        coinMin: 1400, coinMax: 3000,
        expMin: 150,   expMax: 300,
        mensajes: {
            exito:    'Arrancaste minerales del núcleo mismo de la tierra con voluntad inquebratable.',
            peligro:  'Algo antiguo y oscuro se movió en las profundidades mientras minabas.',
            derrumbe: 'El suelo se desgarró bajo tus pies. Volviste a la superficie con el cuerpo destrozado.',
        }
    }
]

// ─── FOTOS DE HERRAMIENTAS Y OBJETOS ────────────────────────────────────────
// (prompts_mineria.txt — Sección HERRAMIENTAS Y OBJETOS, prompts 21-25)
// Usadas en el comando de lista de minas (!minar minas) como thumbnail del menú.
const FOTOS_HERRAMIENTAS = [
    '',  // Prompt 21 → Pico de Minero Brillante
    '',  // Prompt 22 → Sacos de Mineral Apilados
    '',  // Prompt 23 → Linterna de Minero Solitaria
    '',  // Prompt 24 → Diamante en Bruto Encontrado
    '',  // Prompt 25 → Mural de Minerales Expuesto
]

// ─── FOTOS DE ACCIDENTES Y PELIGROS ──────────────────────────────────────
// (prompts_mineria.txt — Sección ACCIDENTES Y PELIGROS, prompts 26-30)
// Usadas cuando el jugador queda KO (inconsciente) en la mina.
const FOTOS_ACCIDENTES = [
    '',  // Prompt 26 → Explosión de Polvo de Roca
    '',  // Prompt 27 → Grieta Abierta en el Suelo
    '',  // Prompt 28 → Cadena de Soportes Cediendo
    '',  // Prompt 29 → Agua Subterránea Inundando el Túnel
    '',  // Prompt 30 → Magma Filtrándose por las Paredes
]

// ─── FOTOS DE DROPS RAROS ────────────────────────────────────────────────────
// (prompts_mineria.txt — Sección DROPS RAROS Y MOMENTOS ESPECIALES, prompts 31-35)
// Se elige aleatoriamente cuando cae un diamante o se descubre algo especial.
const FOTOS_RAROS = [
    '',  // Prompt 31 → Geoda de Cristal Gigante Descubierta
    '',  // Prompt 32 → Diamante Flotando en Energía Arcana
    '',  // Prompt 33 → Veta de Oro Puro Descubierta
    '',  // Prompt 34 → Relicario Enterrado Encontrado
    '',  // Prompt 35 → Caverna de Hongos Bioluminiscentes con Minerales
]

const TIER_BADGE = {
    'Común':  '◇ Común',
    'Mágico': '◈ Mágico',
    'Épico':  '◆ Épico',
    'Mítico': '✦ Mítico'
}

// Daño por peligro según tier
const TIER_DAMAGE = {
    'Común':  { min: 30,  max: 100 },
    'Mágico': { min: 80,  max: 180 },
    'Épico':  { min: 150, max: 280 },
    'Mítico': { min: 250, max: 420 }
}

function pesoPick(arr) {
    const total = arr.reduce((s, i) => s + i.peso, 0)
    let r = Math.random() * total
    for (const item of arr) {
        r -= item.peso
        if (r <= 0) return item
    }
    return arr[arr.length - 1]
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function msToTime(ms) {
    if (ms <= 0) return 'ahora'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
let handler = async (m, { conn, usedPrefix, command, text }) => {
    const user = global.db.data.users[m.sender]
    if (!user) return

    // Inicializar campos
    user.health   = Number.isFinite(user.health)   ? user.health   : 1000
    user.coin     = Number.isFinite(user.coin)     ? user.coin     : 0
    user.exp      = Number.isFinite(user.exp)      ? user.exp      : 0
    user.diamond  = Number.isFinite(user.diamond)  ? user.diamond  : 0
    user.lastmining = user.lastmining || 0
    user.inventory  = user.inventory  || {}

    // ── Ver lista de minas ────────────────────────────────────────────────────
    if (text && ['minas', 'lista', 'list'].includes(text.trim().toLowerCase())) {
        let msg = `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n 🗺️ *MINAS DISPONIBLES* 🗺️\n\n`
        for (const m_ of MINAS) {
            msg += ` ${m_.emoji} *${m_.nombre}* · [${TIER_BADGE[m_.tier]}]\n`
            msg += ` ⌲ ${m_.descripcion}\n`
            msg += `   ▸ Riesgo de zona : *${Math.round(m_.peligro * 100)}%*\n\n`
        }
        msg += `> ✧ Usa *${usedPrefix}minar [nombre]* para explorar una mina. Ejemplo: *${usedPrefix}minar zafiro* ✧\n*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        return m.reply(msg)
    }

    // ── Cooldown ──────────────────────────────────────────────────────────────
    const now = Date.now()
    const elapsed = now - user.lastmining
    if (elapsed < MINING_COOLDOWN) {
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ⏳ *HERRAMIENTAS DESGASTADAS* ⏳\n\n` +
            ` ⌲ Tu pico y tus herramientas de\n` +
            `    excavación necesitan mantenimiento.\n\n` +
            `   ▸ Vuelve a minar en : *${msToTime(MINING_COOLDOWN - elapsed)}*\n` +
            `   ▸ O visita la tienda: *${usedPrefix}shop*\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
    }

    // ── Requisito de salud ────────────────────────────────────────────────────
    if (user.health < 300) {
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ⚠️ *ESTADO DEBILITADO* ⚠️\n\n` +
            ` ⌲ No tienes las fuerzas necesarias\n` +
            `    para soportar el trabajo en la mina.\n\n` +
            `   ▸ Salud actual   : *${user.health.toLocaleString()}* / 1,000\n` +
            `   ▸ Salud requerida: *300* mínimo\n\n` +
            `> ✧ Usa *${usedPrefix}heal* o consume una poción con *${usedPrefix}usar pocion* para recuperarte ✧\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
    }

    // ── Selección de mina ─────────────────────────────────────────────────────
    let mina
    if (text && text.trim().length > 0) {
        const busq = text.trim().toLowerCase()
        mina = MINAS.find(mi => mi.nombre.toLowerCase().includes(busq))
        if (!mina) {
            return m.reply(
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                ` ❌ *MINA NO ENCONTRADA* ❌\n\n` +
                ` ⌲ El nombre de la mina que intentas\n` +
                `    explorar no existe en el mapa.\n\n` +
                `> ✧ Ver minas disponibles : *${usedPrefix}minar minas* ✧\n` +
                `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
            )
        }
    } else {
        // Selección aleatoria ponderada: 45% Común | 30% Mágico | 20% Épico | 5% Mítico
        const r = Math.random()
        if      (r > 0.95) mina = MINAS[3] // Mítico
        else if (r > 0.75) mina = MINAS[2] // Épico
        else if (r > 0.45) mina = MINAS[1] // Mágico
        else               mina = MINAS[0] // Común
    }

    // ── Registrar cooldown ────────────────────────────────────────────────────
    user.lastmining = now

    // ── Calcular resultado ─────────────────────────────────────────────────────
    const rng = Math.random()
    const dañoRange = TIER_DAMAGE[mina.tier] || { min: 30, max: 100 }
    let eventoTipo = 'exito' // valor por defecto, se sobreescribe abajo
    const curr = typeof moneda !== 'undefined' ? moneda : 'coins'

    let txt = `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
              ` ⛏️ *EXCAVACIÓN RPG* ⛏️\n\n` +
              ` ⌲ Zona explorada : *${mina.nombre}* [${TIER_BADGE[mina.tier]}]\n` +
              ` ⌲ Riesgo de zona : *${Math.round(mina.peligro * 100)}%*\n\n`

    if (rng < mina.peligro) {
        // ── DERRUMBE / ACCIDENTE ──────────────────────────────────────────────
        const dmg = rand(dañoRange.min, dañoRange.max)
        user.health = Math.max(0, user.health - dmg)

        const escapó = Math.random() < 0.5 // 50% escapa sin premio

        if (escapó) {
            // Salió vivo pero sin nada
            eventoTipo = 'derrumbe'
            txt += ` 💥 _${mina.mensajes.derrumbe}_\n\n` +
                   `   ▸ Daño sufrido   : *-${dmg.toLocaleString()}* Salud\n` +
                   `   ▸ Salud restante : *${user.health.toLocaleString()}* / 1,000\n` +
                   `   ▸ Botín extraído : _Ninguno (tuviste que huir)_\n` +
                   `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        } else {
            // Accidente parcial: consiguió algo pero se hizo daño
            const cantCoins = rand(Math.floor(mina.coinMin * 0.3), Math.floor(mina.coinMax * 0.4))
            const xpGained  = rand(Math.floor(mina.expMin * 0.4), Math.floor(mina.expMax * 0.6))
            const mineral   = pesoPick(mina.minerales)
            const cantidad  = rand(1, Math.max(1, Math.floor(mineral.max * 0.4)))

            user.coin += cantCoins
            user.exp  += xpGained
            user.inventory[mineral.nombre] = (user.inventory[mineral.nombre] || 0) + cantidad

            eventoTipo = 'accidente'
            txt += ` 🩸 _${mina.mensajes.peligro}_\n\n` +
                   `   ▸ Daño sufrido   : *-${dmg.toLocaleString()}* Salud\n` +
                   `   ▸ Salud restante : *${user.health.toLocaleString()}* / 1,000\n\n` +
                   ` ◈ *Botín Rescatado:*\n` +
                   `   ▸ ${mineral.emoji} *${cantidad.toLocaleString()}x ${mineral.label}*\n` +
                   `   ▸ Restos vendidos: *+${cantCoins.toLocaleString()}* ${curr}\n` +
                   `   ▸ Experiencia    : *+${xpGained.toLocaleString()}* XP\n`
        }

        // KO
        if (user.health <= 0) {
            user.health = 1000
            const factura = Math.floor(user.coin * 0.12)
            user.coin = Math.max(0, user.coin - factura)
            eventoTipo = 'ko' // override: foto de accidente grave (prompts 26-30)
            txt += `\n 💀 *¡INCONSCIENTE!*\n` +
                   ` ⌲ Los compañeros de mina te sacaron a rastras.\n` +
                   `   ▸ Pagaste al médico: *-${factura.toLocaleString()}* ${curr}\n` +
                   `   ▸ Salud restaurada : *1,000* / 1,000\n`
        }
        
        if (!escapó) txt += `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`

    } else {
        // ── MINERÍA EXITOSA ───────────────────────────────────────────────────
        const cantCoins = rand(mina.coinMin, mina.coinMax)
        const xpGained  = rand(mina.expMin, mina.expMax)

        // Seleccionar 1-2 minerales
        const mineral1   = pesoPick(mina.minerales)
        const cantidad1  = rand(mineral1.min, mineral1.max)
        user.inventory[mineral1.nombre] = (user.inventory[mineral1.nombre] || 0) + cantidad1

        let mineralExtra = ''
        if (Math.random() > 0.55) {
            const mineral2  = pesoPick(mina.minerales)
            const cantidad2 = rand(1, Math.max(1, Math.floor(mineral2.max * 0.5)))
            user.inventory[mineral2.nombre] = (user.inventory[mineral2.nombre] || 0) + cantidad2
            mineralExtra = `\n   ▸ ${mineral2.emoji} *${cantidad2.toLocaleString()}x ${mineral2.label}* (extra)`
        }

        user.coin += cantCoins
        user.exp  += xpGained

        txt += ` ◈ *Botín Extraído:*\n` +
               `   ▸ ${mineral1.emoji} *${cantidad1.toLocaleString()}x ${mineral1.label}*${mineralExtra}\n\n` +
               `   ▸ Monedas ganadas : *+${cantCoins.toLocaleString()}* ${curr}\n` +
               `   ▸ Experiencia     : *+${xpGained.toLocaleString()}* XP\n` +
               `   ▸ Salud restante  : *${user.health.toLocaleString()}* / 1,000\n`

        // Drop raro: diamante (5% en épico/mítico, 1% en comunes)
        const dropDiaChance = (mina.tier === 'Épico' || mina.tier === 'Mítico') ? 0.05 : 0.01
        if (Math.random() < dropDiaChance) {
            user.diamond += 1
            eventoTipo = 'raro' // override: drop raro tiene su propia imágen
            txt += `\n ✨ *¡DROP RARO!*\n` +
                   ` ⌲ Has encontrado un *Diamante (◈)* entre las rocas.\n`
        }
        txt += `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
    }

    // ── Enviar resultado con imagen dinámica ────────────────────────────────
    const thumb = _elegirFoto(mina, eventoTipo)
    let imgBuffer = null
    if (thumb) {
        try {
            const res = await fetch(thumb)
            if (res.ok) imgBuffer = Buffer.from(await res.arrayBuffer())
        } catch { /* sin imagen, fallback a texto */ }
    }
    if (imgBuffer) {
        await conn.sendMessage(m.chat, { image: imgBuffer, caption: txt }, { quoted: m })
    } else {
        await m.reply(txt)
    }
}

handler.help = ['minar [nombre|minas]', 'mine']
handler.tags = ['economy']
handler.command = ['minar', 'mine', 'mineria', 'excavate']
handler.group = true

export default handler

// ─── HELPER: elige la foto correcta según el evento ──────────────────────────
//
// MAPA COMPLETO DE 35 SLOTS → mina.fotos[] y arrays globales:
//
//  TIER COMÚN  (Mina de Cobre)   → fotos[0..4] = prompts  1-5
//  TIER MÁGICO (Mina de Plata)   → fotos[0..4] = prompts  6-10
//  TIER ÉPICO  (Mina de Zafiro)  → fotos[0..4] = prompts 11-15
//  TIER MÍTICO (Mina Abismal)    → fotos[0..4] = prompts 16-20
//  HERRAMIENTAS                  → FOTOS_HERRAMIENTAS[0..4] = prompts 21-25  (menú lista)
//  ACCIDENTES Y PELIGROS         → FOTOS_ACCIDENTES[0..4]  = prompts 26-30  (KO/inconsciente)
//  DROPS RAROS                   → FOTOS_RAROS[0..4]       = prompts 31-35  (diamante drop)
//
// Índices dentro de mina.fotos[]:
//   [0] general/lista  [1] éxito  [2] derrumbe  [3] accidente  [4] éxito-variante
function _elegirFoto(mina, eventoTipo) {
    // KO / inconsciente → foto de accidente grave aleatoria (prompts 26-30)
    if (eventoTipo === 'ko') {
        const graves = FOTOS_ACCIDENTES.filter(f => f && f.startsWith('http'))
        if (graves.length > 0) return graves[Math.floor(Math.random() * graves.length)]
    }

    // Drop raro → foto especial aleatoria de FOTOS_RAROS (prompts 31-35)
    if (eventoTipo === 'raro') {
        const raras = FOTOS_RAROS.filter(f => f && f.startsWith('http'))
        if (raras.length > 0) return raras[Math.floor(Math.random() * raras.length)]
    }

    const idx = { exito: 1, derrumbe: 2, accidente: 3 }[eventoTipo] ?? 1

    // 30% de chance de usar fotos[4] (variante) en lugar de fotos[1] en éxito
    const usarAlternativa = eventoTipo === 'exito' && Math.random() < 0.30

    const fotosValidas = mina.fotos || []
    const elegida = usarAlternativa
        ? (fotosValidas[4] || fotosValidas[idx])
        : fotosValidas[idx]

    if (elegida && elegida.startsWith('http')) return elegida

    // Fallback accidente/derrumbe → ir a FOTOS_ACCIDENTES si no hay foto de mina
    if (eventoTipo === 'derrumbe' || eventoTipo === 'accidente') {
        const acc = FOTOS_ACCIDENTES.filter(f => f && f.startsWith('http'))
        if (acc.length > 0) return acc[Math.floor(Math.random() * acc.length)]
    }

    // Fallback final: cualquier foto válida de la mina
    const cualquiera = fotosValidas.find(f => f && f.startsWith('http'))
    return cualquiera || null
}
