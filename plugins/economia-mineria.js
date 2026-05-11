// ⛏️ economia-mineria.js — Sistema de Minería RPG
// Usa: lastmining (cooldown), inventory (materiales), coin, exp, health, diamond

const MINING_COOLDOWN = 3 * 60 * 60 * 1000 // 3 horas

// ─── DEFINICIÓN DE MINAS ─────────────────────────────────────────────────────
// Cada mina tiene 5 slots de foto (fotos[0..4]) que corresponden a los
// prompts del archivo prompts_mineria.txt según se indica en los comentarios.
// ⚠️ Pega la URL de Imgur generada con el prompt correcto en el slot vacío.

const MINAS = [
    {
        id: 1,
        nombre: 'Mina de Cobre',
        emoji: '🪨',
        descripcion: 'Galerías superficiales llenas de polvo y mineral ordinario.',
        tier: 'Común',
        peligro: 0.15,
        // ── FOTOS ── (prompts_mineria.txt — Sección TIER COMÚN, prompts 1-5)
        fotos: [
            '',  // Prompt 1  → Entrada a la Mina de Cobre            (uso: general/lista)
            '',  // Prompt 2  → Veta de Cobre Descubierta              (uso: éxito)
            '',  // Prompt 3  → Derrumbe en la Mina de Cobre          (uso: derrumbe sin botín)
            '',  // Prompt 4  → Vagoneta de Mineral de Cobre          (uso: accidente con botín)
            '',  // Prompt 5  → Polvo de Mineral Flotando en la Galería (uso: éxito alternativo)
        ],
        minerales: [
            { nombre: 'mineral_cobre',  emoji: '🟤', label: 'Cobre',  min: 3, max: 10, peso: 50 },
            { nombre: 'mineral_hierro', emoji: '⚙️',  label: 'Hierro', min: 1, max: 5,  peso: 30 },
            { nombre: 'mineral_carbon', emoji: '🖤',  label: 'Carbón', min: 2, max: 8,  peso: 20 },
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
        emoji: '🪙',
        descripcion: 'Cavernas más profundas con vetas relucientes de plata pura.',
        tier: 'Mágico',
        peligro: 0.28,
        // ── FOTOS ── (prompts_mineria.txt — Sección TIER MÁGICO, prompts 6-10)
        fotos: [
            '',  // Prompt 6  → Galería de Plata Reluciente            (uso: general/lista)
            '',  // Prompt 7  → Cueva de Cuarzo y Plata                (uso: éxito)
            '',  // Prompt 8  → Gas Tóxico en la Mina de Plata        (uso: derrumbe sin botín)
            '',  // Prompt 9  → Veta de Plata Perfecta                 (uso: accidente con botín)
            '',  // Prompt 10 → Inundación Parcial de la Galería       (uso: éxito alternativo)
        ],
        minerales: [
            { nombre: 'mineral_plata',  emoji: '🩶', label: 'Plata',  min: 2, max: 6, peso: 40 },
            { nombre: 'mineral_hierro', emoji: '⚙️',  label: 'Hierro', min: 1, max: 4, peso: 30 },
            { nombre: 'mineral_cuarzo', emoji: '🔷', label: 'Cuarzo', min: 1, max: 3, peso: 20 },
            { nombre: 'mineral_cobre',  emoji: '🟤', label: 'Cobre',  min: 1, max: 3, peso: 10 },
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
        emoji: '💎',
        descripcion: 'Profundidades azuladas donde la magia cristaliza en gemas puras.',
        tier: 'Épico',
        peligro: 0.45,
        // ── FOTOS ── (prompts_mineria.txt — Sección TIER ÉPICO, prompts 11-15)
        fotos: [
            '',  // Prompt 11 → Caverna de Cristales de Zafiro         (uso: general/lista)
            '',  // Prompt 12 → Rayo de Luz en la Caverna de Zafiro   (uso: éxito)
            '',  // Prompt 13 → Criatura Subterránea Despertada        (uso: derrumbe sin botín)
            '',  // Prompt 14 → Rubíes en la Pared de Zafiro          (uso: accidente con botín)
            '',  // Prompt 15 → Derrumbe Catastrófico en Mina de Zafiro (uso: éxito alt/ko)
        ],
        minerales: [
            { nombre: 'mineral_zafiro', emoji: '💠', label: 'Zafiro', min: 1, max: 3, peso: 35 },
            { nombre: 'mineral_rubi',   emoji: '🔴', label: 'Rubí',   min: 1, max: 2, peso: 25 },
            { nombre: 'mineral_plata',  emoji: '🩶', label: 'Plata',  min: 1, max: 4, peso: 25 },
            { nombre: 'mineral_cuarzo', emoji: '🔷', label: 'Cuarzo', min: 2, max: 5, peso: 15 },
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
        emoji: '🕳️',
        descripcion: 'Las entrañas de la tierra donde el roce de lo arcano vuelve cada mineral algo sagrado.',
        tier: 'Mítico',
        peligro: 0.65,
        // ── FOTOS ── (prompts_mineria.txt — Sección TIER MÍTICO, prompts 16-20)
        fotos: [
            '',  // Prompt 16 → Las Profundidades Abisales             (uso: general/lista)
            '',  // Prompt 17 → Corazón de la Mina Abismal            (uso: éxito)
            '',  // Prompt 18 → Entidad Oscura en las Profundidades    (uso: derrumbe sin botín)
            '',  // Prompt 19 → Suelo del Abismo Derrumbándose         (uso: accidente con botín)
            '',  // Prompt 20 → Veta de Obsidiana Sagrada con Runas   (uso: éxito alternativo)
        ],
        minerales: [
            { nombre: 'mineral_obsidiana', emoji: '🌑', label: 'Obsidiana', min: 1, max: 2, peso: 30 },
            { nombre: 'mineral_zafiro',    emoji: '💠', label: 'Zafiro',    min: 1, max: 2, peso: 25 },
            { nombre: 'mineral_rubi',      emoji: '🔴', label: 'Rubí',      min: 1, max: 2, peso: 25 },
            { nombre: 'mineral_plata',     emoji: '🩶', label: 'Plata',     min: 1, max: 3, peso: 20 },
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
    'Común':  '⚪ Común',
    'Mágico': '🔵 Mágico',
    'Épico':  '🟣 Épico',
    'Mítico': '🔴 Mítico'
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
        let msg = `⛏️ *MINAS DISPONIBLES*\n${'─'.repeat(28)}\n`
        for (const m_ of MINAS) {
            msg += `\n${m_.emoji} *${m_.nombre}* — ${TIER_BADGE[m_.tier]}\n`
            msg += `   📍 ${m_.descripcion}\n`
            msg += `   ⚠️ Peligro: ${Math.round(m_.peligro * 100)}%\n`
        }
        msg += `\n💡 Usa *${usedPrefix}minar [nombre]* para elegir una mina.\nEjemplo: *${usedPrefix}minar zafiro*`
        return m.reply(msg)
    }

    // ── Cooldown ──────────────────────────────────────────────────────────────
    const now = Date.now()
    const elapsed = now - user.lastmining
    if (elapsed < MINING_COOLDOWN) {
        return m.reply(`⛏️ Tus herramientas están desgastadas.\nVuelve a minar en *${msToTime(MINING_COOLDOWN - elapsed)}*.`)
    }

    // ── Requisito de salud ────────────────────────────────────────────────────
    if (user.health < 300) {
        return m.reply(`🤕 *Estás muy débil para minar.*\nTu salud es *${user.health}/1000*. Necesitas al menos 300.\nUsa *${usedPrefix}heal* para curarte.`)
    }

    // ── Selección de mina ─────────────────────────────────────────────────────
    let mina
    if (text && text.trim().length > 0) {
        const busq = text.trim().toLowerCase()
        mina = MINAS.find(mi => mi.nombre.toLowerCase().includes(busq))
        if (!mina) {
            return m.reply(`❌ No existe esa mina.\nUsa *${usedPrefix}minar minas* para ver la lista completa.`)
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
    let txt = `${mina.emoji} *MINERÍA* — ${TIER_BADGE[mina.tier]}\n`
    txt += `📍 *${mina.nombre}*\n⚠️ Peligro: ${Math.round(mina.peligro * 100)}%\n${'─'.repeat(28)}\n\n`

    if (rng < mina.peligro) {
        // ── DERRUMBE / ACCIDENTE ──────────────────────────────────────────────
        const dmg = rand(dañoRange.min, dañoRange.max)
        user.health = Math.max(0, user.health - dmg)

        const escapó = Math.random() < 0.5 // 50% escapa sin premio

        if (escapó) {
            // Salió vivo pero sin nada
            eventoTipo = 'derrumbe'
            txt += `💥 *¡DERRUMBE!*\n`
            txt += `> ${mina.mensajes.derrumbe}\n\n`
            txt += `> 💔 Daño sufrido: *-${dmg} Salud* → Restante: *${user.health}*\n`
            txt += `> No lograste extraer ningún mineral esta vez.`
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
            txt += `🩸 *ACCIDENTE CON BOTÍN*\n`
            txt += `> ${mina.mensajes.peligro}\n\n`
            txt += `> 💔 Daño: *-${dmg} Salud* → Restante: *${user.health}*\n`
            txt += `> ${mineral.emoji} Extrajiste: *${cantidad}x ${mineral.label}*\n`
            txt += `> 💰 Vendiste restos: *+${cantCoins} coins* | ✨ *+${xpGained} XP*`
        }

        // KO
        if (user.health <= 0) {
            user.health = 1000
            const factura = Math.floor(user.coin * 0.12)
            user.coin = Math.max(0, user.coin - factura)
            eventoTipo = 'ko' // override: foto de accidente grave (prompts 26-30)
            txt += `\n\n🚑 *INCONSCIENTE*: Los compañeros de mina te sacaron a rastras.\nPagaste al médico: *-${factura} coins*. Salud restaurada.`
        }

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
            mineralExtra = `\n> ${mineral2.emoji} *${cantidad2}x ${mineral2.label}* (extra)`
        }

        user.coin += cantCoins
        user.exp  += xpGained

        txt += `⛏️ *¡EXTRACCIÓN EXITOSA!*\n`
        txt += `> ${mina.mensajes.exito}\n\n`
        txt += `> ${mineral1.emoji} *${cantidad1}x ${mineral1.label}*${mineralExtra}\n`
        txt += `> 💰 Vendiste minerales: *+${cantCoins} coins*\n`
        txt += `> ✨ Experiencia: *+${xpGained} XP*\n`
        txt += `> ❤️ Salud restante: *${user.health}/1000*`

        // Drop raro: diamante (5% en épico/mítico, 1% en comunes)
        const dropDiaChance = (mina.tier === 'Épico' || mina.tier === 'Mítico') ? 0.05 : 0.01
        if (Math.random() < dropDiaChance) {
            user.diamond += 1
            eventoTipo = 'raro' // override: drop raro tiene su propia imágen
            txt += `\n\n💎 *¡DROP RARO!* Encontraste un *diamante* entre las rocas.`
        }
    }

    // ── Enviar resultado con thumbnail dinámico ───────────────────────────────
    // La foto se elige según el tipo de evento ocurrido en la sesión de minería
    const thumb = _elegirFoto(mina, eventoTipo)
    if (thumb) {
        await conn.sendMessage(m.chat, {
            text: txt,
            contextInfo: {
                externalAdReply: {
                    title: `⛏️ ${mina.nombre}`,
                    body: `${TIER_BADGE[mina.tier]} | IKAIBOT RPG`,
                    thumbnailUrl: thumb,
                    sourceUrl: '',
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m })
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
