// ═══════════════════════════════════════════════
// 🎭 INTERACCIONES ANIME — Roleplay con GIFs
// Usa la API de evogb.org para enviar GIFs de
// interacciones anime entre usuarios del grupo.
// ═══════════════════════════════════════════════

import fetch from 'node-fetch'

// Mapa de comandos → tipo de API + mensaje en español
const INTERACCIONES = {
    // --- Cariñosas ---
    abrazo: { type: 'hug', msg: '🤗 *{user}* le dio un abrazo cálido a *{target}*', solo: '🤗 *{user}* se abraza a sí mismo... necesita cariño' },
    beso: { type: 'kiss', msg: '💋 *{user}* le dio un beso a *{target}*', solo: '💋 *{user}* lanzó un beso al aire~' },
    caricia: { type: 'pat', msg: '🥰 *{user}* le acarició la cabecita a *{target}*', solo: '🥰 *{user}* se acaricia la cabeza solito' },
    mimar: { type: 'cuddle', msg: '💕 *{user}* se acurrucó con *{target}*', solo: '💕 *{user}* se acurruca con su almohada' },
    besomejilla: { type: 'kisscheek', msg: '😘 *{user}* le dio un beso en la mejilla a *{target}*', solo: '😘 *{user}* se besó la mano' },
    tomarmano: { type: 'handhold', msg: '🤝 *{user}* tomó de la mano a *{target}*', solo: '🤝 *{user}* extiende su mano... ¿alguien la toma?' },
    acurrucar: { type: 'snuggle', msg: '🫂 *{user}* se acurrucó junto a *{target}*', solo: '🫂 *{user}* se acurruca solo~' },

    // --- Divertidas ---
    cachetada: { type: 'slap', msg: '👋 *{user}* le metió una cachetada a *{target}*', solo: '👋 *{user}* se cacheteó solo... ¿por qué?' },
    golpe: { type: 'punch', msg: '👊 *{user}* le soltó un golpe a *{target}*', solo: '👊 *{user}* golpeó el aire con furia' },
    morder: { type: 'bite', msg: '😬 *{user}* mordió a *{target}*', solo: '😬 *{user}* se mordió la lengua' },
    lamer: { type: 'lick', msg: '👅 *{user}* le dio un lametón a *{target}*', solo: '👅 *{user}* se lamió los labios' },
    bonk: { type: 'bonk', msg: '🔨 *{user}* le dio un bonk a *{target}*', solo: '🔨 *{user}* se dio un bonk solito' },
    patada: { type: 'kick', msg: '🦶 *{user}* le lanzó una patada a *{target}*', solo: '🦶 *{user}* pateó una piedra' },
    empujar: { type: 'push', msg: '🫸 *{user}* empujó a *{target}*', solo: '🫸 *{user}* empujó al vacío' },
    escupir: { type: 'spit', msg: '💦 *{user}* le escupió a *{target}*', solo: '💦 *{user}* escupió al suelo' },
    matar: { type: 'kill', msg: '💀 *{user}* acabó con *{target}*', solo: '💀 *{user}* murió de cringe' },
    bully: { type: 'bully', msg: '😈 *{user}* le hizo bullying a *{target}*', solo: '😈 *{user}* se hizo bullying a sí mismo' },

    // --- Expresiones ---
    bailar: { type: 'dance', msg: '💃 *{user}* invitó a bailar a *{target}*', solo: '💃 *{user}* se puso a bailar solo' },
    llorar: { type: 'cry', msg: '😭 *{user}* está llorando por culpa de *{target}*', solo: '😭 *{user}* está llorando...' },
    reir: { type: 'laugh', msg: '🤣 *{user}* se está riendo de *{target}*', solo: '🤣 *{user}* no para de reír' },
    sonreir: { type: 'smile', msg: '😊 *{user}* le sonrió a *{target}*', solo: '😊 *{user}* está sonriendo felizmente' },
    sonrojar: { type: 'blush', msg: '😳 *{user}* se sonrojó por *{target}*', solo: '😳 *{user}* se sonrojó de la nada' },
    saludar: { type: 'wave', msg: '👋 *{user}* saludó a *{target}*', solo: '👋 *{user}* está saludando a todos' },
    guiñar: { type: 'wink', msg: '😉 *{user}* le guiñó el ojo a *{target}*', solo: '😉 *{user}* guiñó el ojo~' },
    cringe: { type: 'cringe', msg: '😬 *{user}* le dio cringe por *{target}*', solo: '😬 *{user}* hizo una mueca de cringe' },
    feliz: { type: 'happy', msg: '😄 *{user}* está feliz gracias a *{target}*', solo: '😄 *{user}* está muy feliz hoy' },
    triste: { type: 'sad', msg: '😢 *{user}* está triste por *{target}*', solo: '😢 *{user}* se siente triste...' },
    enojado: { type: 'angry', msg: '😠 *{user}* está enojado con *{target}*', solo: '😠 *{user}* está furioso' },
    asustado: { type: 'scared', msg: '😱 *{user}* se asustó por *{target}*', solo: '😱 *{user}* se asustó' },
    timido: { type: 'shy', msg: '🫣 *{user}* se puso tímido frente a *{target}*', solo: '🫣 *{user}* está tímido~' },
    aburrido: { type: 'bored', msg: '😒 *{user}* está aburrido con *{target}*', solo: '😒 *{user}* está súper aburrido' },
    gritar: { type: 'scream', msg: '🗣️ *{user}* le gritó a *{target}*', solo: '🗣️ *{user}* está gritando' },
    nope: { type: 'nope', msg: '🙅 *{user}* le dijo NOPE a *{target}*', solo: '🙅 *{user}* dice nope' },
    presumir: { type: 'smug', msg: '😏 *{user}* presumió frente a *{target}*', solo: '😏 *{user}* está presumiendo' },

    // --- Acciones ---
    aplaudir: { type: 'clap', msg: '👏 *{user}* aplaudió para *{target}*', solo: '👏 *{user}* está aplaudiendo' },
    choca: { type: 'highfive', msg: '🖐️ *{user}* chocó los cinco con *{target}*', solo: '🖐️ *{user}* choca los cinco al aire' },
    cosquillas: { type: 'tickle', msg: '🤭 *{user}* le hizo cosquillas a *{target}*', solo: '🤭 *{user}* se hizo cosquillas solo' },
    espiar: { type: 'peek', msg: '👀 *{user}* está espiando a *{target}*', solo: '👀 *{user}* está espiando por ahí~' },
    mirar: { type: 'stare', msg: '👁️ *{user}* se quedó mirando a *{target}*', solo: '👁️ *{user}* mira fijamente a la nada' },
    correr: { type: 'run', msg: '🏃 *{user}* salió corriendo de *{target}*', solo: '🏃 *{user}* salió corriendo' },
    dormir: { type: 'sleep', msg: '😴 *{user}* se durmió encima de *{target}*', solo: '😴 *{user}* se fue a dormir' },
    comer: { type: 'eat', msg: '🍽️ *{user}* invitó a comer a *{target}*', solo: '🍽️ *{user}* está comiendo' },
    cafe: { type: 'coffee', msg: '☕ *{user}* invitó un café a *{target}*', solo: '☕ *{user}* se preparó un cafecito' },
    pensar: { type: 'think', msg: '🤔 *{user}* está pensando en *{target}*', solo: '🤔 *{user}* está pensando...' },
    caminar: { type: 'walk', msg: '🚶 *{user}* fue a caminar con *{target}*', solo: '🚶 *{user}* se fue a caminar' },
    saltar: { type: 'jump', msg: '🦘 *{user}* saltó sobre *{target}*', solo: '🦘 *{user}* está saltando de alegría' },
    cantar: { type: 'sing', msg: '🎤 *{user}* le cantó una canción a *{target}*', solo: '🎤 *{user}* está cantando~' },
    gaming: { type: 'gaming', msg: '🎮 *{user}* retó a *{target}* a jugar', solo: '🎮 *{user}* está jugando' },
    dibujar: { type: 'draw', msg: '🎨 *{user}* dibujó a *{target}*', solo: '🎨 *{user}* se puso a dibujar' },
    llamar: { type: 'call', msg: '📞 *{user}* está llamando a *{target}*', solo: '📞 *{user}* está llamando a alguien' },
    puchero: { type: 'pout', msg: '🥺 *{user}* le hizo un puchero a *{target}*', solo: '🥺 *{user}* está haciendo puchero' },
    tropezar: { type: 'trip', msg: '🤦 *{user}* tropezó frente a *{target}*', solo: '🤦 *{user}* se tropezó' },
    bleh: { type: 'bleh', msg: '😝 *{user}* le sacó la lengua a *{target}*', solo: '😝 *{user}* sacó la lengua' },
    borracho: { type: 'drunk', msg: '🍺 *{user}* se emborrachó con *{target}*', solo: '🍺 *{user}* está borrachito' },
    dramatico: { type: 'dramatic', msg: '🎭 *{user}* fue muy dramático con *{target}*', solo: '🎭 *{user}* se puso dramático' },
    fumar: { type: 'smoke', msg: '🚬 *{user}* está fumando con *{target}*', solo: '🚬 *{user}* se fue a fumar' },
    amor: { type: 'love', msg: '❤️ *{user}* le declaró su amor a *{target}*', solo: '❤️ *{user}* está lleno de amor' },
    seducir: { type: 'seduce', msg: '😏 *{user}* intentó seducir a *{target}*', solo: '😏 *{user}* está practicando poses' },
    olfatear: { type: 'sniff', msg: '👃 *{user}* olfateó a *{target}*', solo: '👃 *{user}* está olfateando algo' },
    curioso: { type: 'curious', msg: '🧐 *{user}* tiene curiosidad por *{target}*', solo: '🧐 *{user}* está curioso' },
    pisar: { type: 'step', msg: '🦶 *{user}* pisó a *{target}*', solo: '🦶 *{user}* pisó algo' },
}

// Agregar aliases en inglés (type) → misma config
for (const [, cfg] of Object.entries(INTERACCIONES)) {
    if (!INTERACCIONES[cfg.type]) {
        INTERACCIONES[cfg.type] = cfg
    }
}

// API key y URL base
const API_KEY = 'liu_ofc'
const API_BASE = 'https://api.evogb.org/sfw/interaction'

// Cooldown por usuario (en ms) — 8 segundos
const COOLDOWN_MS = 8000
const cooldowns = new Map()

const normalizeJid = (jid) => {
    if (!jid) return null
    if (typeof jid === 'string') return jid
    if (typeof jid === 'number') return `${jid}@s.whatsapp.net`
    if (typeof jid !== 'object') return null

    if (jid.user && jid.server) return `${jid.user}@${jid.server}`

    const value = jid.jid || jid.id || jid.lid || jid.phoneNumber || jid.participant || jid.sender
    return value ? normalizeJid(value) : null
}

const uniqueJids = (jids = []) => [...new Set(jids.map(normalizeJid).filter(jid => typeof jid === 'string' && jid.includes('@')))]

const targetFromText = (text = '') => {
    const number = String(text).replace(/\D/g, '')
    return number.length >= 8 && number.length <= 15 ? `${number}@s.whatsapp.net` : null
}

const safeCall = async (fn, fallback = '') => {
    try {
        return await fn()
    } catch {
        return fallback
    }
}

const resolveLid = async (jid, chat, conn) => {
    jid = normalizeJid(jid)
    if (!jid || !jid.endsWith('@lid') || !chat?.endsWith?.('@g.us') || typeof String.prototype.resolveLidToRealJid !== 'function') {
        return jid
    }

    return await safeCall(() => String.prototype.resolveLidToRealJid.call(jid, chat, conn), jid)
}

const areSameUser = async (jidA, jidB, chat, conn) => {
    jidA = normalizeJid(jidA)
    jidB = normalizeJid(jidB)
    if (!jidA || !jidB) return false
    if (jidA === jidB) return true

    const [resolvedA, resolvedB] = await Promise.all([
        resolveLid(jidA, chat, conn),
        resolveLid(jidB, chat, conn)
    ])

    if (resolvedA === resolvedB) return true
    if (typeof conn.decodeJid === 'function') return conn.decodeJid(resolvedA) === conn.decodeJid(resolvedB)
    return false
}

const mentionText = async (jid, chat, conn) => {
    jid = normalizeJid(jid)
    if (!jid) return '@Usuario'

    const resolved = await resolveLid(jid, chat, conn)
    if (resolved?.endsWith?.('@s.whatsapp.net')) return `@${resolved.split('@')[0]}`

    const name = await safeCall(() => conn.getName(jid), '')
    return name || `@${String(jid).split('@')[0]}`
}

let handler = async (m, { conn, command, usedPrefix, text }) => {
    // Buscar la interacción por el comando usado
    const interaccion = INTERACCIONES[command]
    if (!interaccion) return

    // --- Cooldown anti-spam ---
    const now = Date.now()
    const userCd = cooldowns.get(m.sender) || 0
    if (now - userCd < COOLDOWN_MS) {
        const restante = Math.ceil((COOLDOWN_MS - (now - userCd)) / 1000)
        return m.reply(`⏳ Espera *${restante}s* antes de usar otra interacción.`)
    }
    cooldowns.set(m.sender, now)

    // --- Determinar target ---
    const mentionedJids = await m.mentionedJid
    let target = normalizeJid((Array.isArray(mentionedJids) ? mentionedJids[0] : null) || m.quoted?.sender || targetFromText(text))
    const isSelfTarget = target ? await areSameUser(target, m.sender, m.chat, conn) : false
    const mentions = uniqueJids(isSelfTarget || !target ? [m.sender] : [m.sender, target])

    const userName = await mentionText(m.sender, m.chat, conn)

    let texto
    if (target && !isSelfTarget) {
        const targetName = await mentionText(target, m.chat, conn)
        texto = interaccion.msg.replace('{user}', userName).replace('{target}', targetName)
    } else {
        texto = interaccion.solo.replace('{user}', userName)
    }

    // --- Llamar a la API ---
    try {
        const res = await fetch(`${API_BASE}?type=${interaccion.type}&key=${API_KEY}`)
        const json = await res.json()

        if (!json.status || !json.result) {
            return conn.reply(m.chat, texto, m, { mentions })
        }

        const videoUrl = json.result

        // Enviar como GIF animado
        await conn.sendMessage(m.chat, {
            video: { url: videoUrl },
            gifPlayback: true,
            caption: texto,
            mentions
        }, { quoted: m })

    } catch (err) {
        console.error('Error en interacción:', err)
        // Si la API falla, al menos enviar el texto
        await conn.reply(m.chat, texto, m, { mentions })
    }
}

handler.help = [
    'abrazo @user', 'beso @user', 'caricia @user', 'cachetada @user',
    'golpe @user', 'morder @user', 'bailar @user', 'llorar',
    'reir', 'aplaudir', 'choca @user', 'cosquillas @user'
]
handler.tags = ['fun']
handler.command = Object.keys(INTERACCIONES)
handler.group = true

export default handler
