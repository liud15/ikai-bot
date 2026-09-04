import { smsg } from './lib/simple.js'
import { format } from 'util'
import { fileURLToPath } from 'url'
import path, { join } from 'path'
import { unwatchFile, watchFile, existsSync, readFileSync } from 'fs'
import chalk from 'chalk'
import printMessage from './lib/print.js'
import downloadSemaphore from './lib/download-semaphore.js'
import { botContext } from './lib/bot-context.js'
const isNumber = x => typeof x === 'number' && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(function () {
    clearTimeout(this)
    resolve()
}, ms))

function stripDevice(jid = '') {
    if (!jid) return ''
    const str = String(jid)
    let raw = str.split('@')[0]
    raw = raw.split(':')[0]
    if (str.endsWith('@lid')) return raw + '@lid'
    if (str.endsWith('@g.us') || str.endsWith('@newsletter') || str.endsWith('@broadcast')) return str
    return raw + '@s.whatsapp.net'
}

global.getJidNum = (jid = '') => {
    if (!jid) return ''
    const str = String(jid)
    let raw = str.split('@')[0]
    raw = raw.split(':')[0]
    return raw
}

function getSocketJid(conn) {
    const raw = conn?.user?.jid || conn?.user?.id || ''
    if (!raw) return ''

    try {
        return stripDevice(conn?.decodeJid?.(raw) || raw)
    } catch {
        return stripDevice(raw)
    }
}

function isSocketOpen(conn) {
    const readyState =
        conn?.ws?.socket?.readyState ??
        conn?.ws?.readyState

    return readyState === 1
}

function getMessageContextInfo(message = {}) {
    if (!message || typeof message !== 'object') return null

    for (const content of Object.values(message)) {
        if (content?.contextInfo) return content.contextInfo
    }

    return null
}

function getAlternateJid(m) {
    const contextInfo = getMessageContextInfo(m?.message)

    return (
        m?.key?.participantAlt ||
        m?.key?.remoteJidAlt ||
        contextInfo?.participantAlt ||
        contextInfo?.remoteJidAlt ||
        null
    )
}

function cloneRegex(regex) {
    return new RegExp(
        regex.source,
        regex.flags.replace(/[gy]/g, '')
    )
}

function matchPrefix(prefix, text = '') {
    const regex = prefix instanceof RegExp
        ? cloneRegex(prefix)
        : new RegExp(`^${escapeRegExp(String(prefix))}`)

    return [regex.exec(text), regex]
}

function commandMatches(rule, command = '') {
    if (rule instanceof RegExp) {
        return cloneRegex(rule).test(command)
    }

    if (Array.isArray(rule)) {
        return rule.some(item =>
            item instanceof RegExp
                ? cloneRegex(item).test(command)
                : item === command
        )
    }

    return typeof rule === 'string'
        ? rule === command
        : false
}

function escapeRegExp(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeAuthJid(value) {
    const raw = Array.isArray(value) ? value[0] : value
    if (!raw) return null
    const text = stripDevice(String(raw).trim())
    if (!text) return null
    if (text.endsWith('@lid') || text.endsWith('@s.whatsapp.net')) return text
    const number = text.replace(/[^0-9]/g, '')
    return number ? `${number}@s.whatsapp.net` : null
}

function normalizeAuthList(list = []) {
    return [...new Set(list.map(normalizeAuthJid).filter(Boolean))]
}

// Utilidades de LID internas
async function getPnForLid(lid, conn) {
    if (!lid?.endsWith('@lid')) return null

    // 1. Verificar primero en nuestra base de datos (lidmap guardado)
    const lidKey = lid.split('@')[0];
    const mapped = global.db?.data?.lidmap?.[lidKey] || global.db?.data?.lidmap?.[lid];
    if (mapped) {
        const normalized = stripDevice(String(mapped));
        if (normalized.includes('@')) return normalized;
        const digits = normalized.replace(/[^0-9]/g, '');
        return digits ? `${digits}@s.whatsapp.net` : null;
    }

    // 2. Fallback a Signal Repository de Baileys
    const mapping = conn?.signalRepository?.lidMapping
    if (!mapping?.getPNForLID) return null

    try {
        const pn = await mapping.getPNForLID(lid)
        if (!pn) return null

        const normalized = stripDevice(String(pn))
        if (normalized.includes('@')) return normalized

        const digits = normalized.replace(/[^0-9]/g, '')
        return digits ? `${digits}@s.whatsapp.net` : null
    } catch {
        return null
    }
}

async function areJidsSameUserLid(jid1, jid2, conn) {
    if (!jid1 || !jid2) return false

    const first = stripDevice(jid1)
    const second = stripDevice(jid2)

    if (first === second) return true

    const lid = first.endsWith('@lid')
        ? first
        : second.endsWith('@lid')
            ? second
            : null

    const pn = first.endsWith('@s.whatsapp.net')
        ? first
        : second.endsWith('@s.whatsapp.net')
            ? second
            : null

    if (!lid || !pn) return false

    const resolvedPn = await getPnForLid(lid, conn)
    return Boolean(resolvedPn && stripDevice(resolvedPn) === pn)
}

async function findParticipant(participants, jid, conn) {
    if (!Array.isArray(participants) || !jid) return null

    const target = stripDevice(jid)

    let participant = participants.find(entry =>
        [entry?.id, entry?.lid, entry?.phoneNumber]
            .filter(Boolean)
            .map(stripDevice)
            .includes(target)
    )

    if (participant) return participant

    if (target.endsWith('@lid')) {
        const pn = await getPnForLid(target, conn)

        if (pn) {
            participant = participants.find(entry =>
                [entry?.id, entry?.lid, entry?.phoneNumber]
                    .filter(Boolean)
                    .map(stripDevice)
                    .includes(stripDevice(pn))
            )
        }
    } else if (target.endsWith('@s.whatsapp.net') && global.db?.data?.lidmap) {
        // Buscar el LID que corresponde a este PN en el mapa
        const lidMatch = Object.keys(global.db.data.lidmap).find(lid => global.db.data.lidmap[lid] === target);
        if (lidMatch) {
            participant = participants.find(entry =>
                [entry?.id, entry?.lid, entry?.phoneNumber]
                    .filter(Boolean)
                    .map(stripDevice)
                    .includes(stripDevice(lidMatch))
            );
        }
    }

    return participant || null
}

export async function handler(chatUpdate) {
    this.msgqueque = this.msgqueque || []
    this.uptime = this.uptime || Date.now()
    if (!chatUpdate)
        return
    const messages = chatUpdate?.messages
    if (!Array.isArray(messages) || messages.length === 0)
        return
    await this.pushMessage(messages).catch(console.error)

    const myJid = getSocketJid(this)
    global.db.data.subbots = global.db.data.subbots || {}
    const mySettings = global.db.data.subbots[myJid] || {}

    await botContext.run(mySettings, async () => {
        for (const rawMessage of messages) {
            try {
                await processMessage.call(this, rawMessage, chatUpdate)
            } catch (pluginError) {
                console.error(
                    'Error crítico ejecutando proceso de mensaje:',
                    pluginError?.stack || pluginError
                )
            }
        }
    })
}

async function processMessage(rawMessage, chatUpdate) {
    const conn = this

    /*
     * Debe declararse fuera del try porque también se utiliza en finally.
     * Las variables const/let declaradas dentro de try no existen en finally.
     */
    const botJid = getSocketJid(this)

    let m = rawMessage
    if (!m)
        return;
    if (global.db.data == null)
        await global.loadDatabase()
    try {
        m = smsg(this, m) || m
        if (!m)
            return

        // ── Ignorar mensajes dentro de canales de WhatsApp ──────────────
        // Los canales (@newsletter) son de solo lectura para el bot.
        // Cualquier comando enviado ahí (ej: .menu) es silenciado.
        // FIX: Auto-react en canales desactivado para subbots (solo bot principal),
        //      probabilidad reducida al 10%, delay exponencial humano (10-60s).
        //      Esto evita que WhatsApp detecte patrones de automatización y banee los números.
        if (m.chat && m.chat.endsWith('@newsletter')) {
            try {
                if (!global.autoReactChannelsLoaded) {
                    try {
                        const _file = join(process.cwd(), 'autoreact-channels.json')
                        if (existsSync(_file)) {
                            const _data = JSON.parse(readFileSync(_file, 'utf-8'))
                            global.autoReactChannels = Array.isArray(_data) ? _data : []
                        } else {
                            global.autoReactChannels = []
                        }
                    } catch { 
                        global.autoReactChannels = [] 
                    } finally {
                        global.autoReactChannelsLoaded = true;
                    }
                }
                const _autoReact = global.autoReactChannels

                // FIX: Solo el bot principal reacciona en canales (subbots se saltan)
                const _isMainBot = this === global.conn
                if (_isMainBot && _autoReact.includes(m.chat) && !m.message?.reactionMessage && m.key?.id) {
                    // FIX: Solo reaccionar al 10% de posts (evita patrón detectable)
                    if (Math.random() < 0.10) {
                        // Obtener server_id — si no lo encontramos de forma confiable, NO reaccionar
                        const _serverId = m.key?.server_id || m.key?.serverId
                            || rawMessage?.messageServerID || rawMessage?.messageServerIdFull
                            || m?.messageServerID || m?.messageServerIdFull

                        if (_serverId) {
                            const _emojis = ['❤️', '🔥', '👏', '😍', '🫶', '💯', '🎉', '⭐', '👍', '💖', '🥰', '✨', '💜', '🙌']
                            const _emoji = _emojis[Math.floor(Math.random() * _emojis.length)]
                            // FIX: Delay exponencial (más humano) — mínimo 10s, promedio ~25s, máximo ~60s
                            const _delay = 10000 + Math.floor(-Math.log(Math.random()) * 15000)
                            const _chat = m.chat
                            const _conn = this
                            setTimeout(() => {
                                if (typeof _conn.newsletterReactMessage === 'function') {
                                    _conn.newsletterReactMessage(_chat, _serverId, _emoji).catch(() => {})
                                }
                            }, Math.min(_delay, 60000))
                        }
                    }
                }
            } catch (e) { console.log(`[AutoReact] 💥 ${e?.message}`) }
            return
        }
        // ─────────────────────────────────────────────────────────────────

        if (!botJid) return

        // El bot ahora manejará a los usuarios mediante sus LIDs de manera nativa 
        // para no perder la información de la base de datos (economy, logros, etc).
        // --- MIGRACIÓN AUTOMÁTICA DE DATOS (NÚMERO -> LID) ---
        // Si el usuario tenía su economía en su número real, la pasamos a su nuevo LID
        if (m.sender && (m.sender.endsWith('@lid') || (m.sender.endsWith('@s.whatsapp.net') && m.sender.split('@')[0].length >= 15))) {
            try {
                let realJid = null

                // En Baileys v7 los alternativos pueden llegar en MessageKey
                // o dentro de contextInfo, según el tipo de mensaje.
                const alternateJid = getAlternateJid(m)
                if (alternateJid?.endsWith('@s.whatsapp.net')) {
                    realJid = stripDevice(alternateJid)
                }
                
                // Intentar extraer el número real de los participantes del grupo
                if (!realJid && m.isGroup) {
                    const groupMeta = (this.chats?.[m.chat] || {}).metadata; // || await this.groupMetadata(m.chat).catch(_ => null); // Evitamos async pesados aquí
                    if (groupMeta && groupMeta.participants) {
                        const p = groupMeta.participants.find(p => p.id === m.sender || p.id === m.sender.replace('@s.whatsapp.net', '@lid'));
                        if (p && p.phoneNumber) {
                            realJid = p.phoneNumber.includes('@') ? p.phoneNumber : p.phoneNumber + '@s.whatsapp.net';
                        }
                    }
                }
                
                // Si encontramos su número real, migramos la DB
                if (realJid) {
                    const oldUser = global.db.data.users[realJid];
                    const currentUser = global.db.data.users[m.sender];
                    
                    if (oldUser && oldUser.exp > 0) {
                        // Si el usuario viejo tiene experiencia y el nuevo no (o tiene menos), transferimos
                        if (!currentUser || (currentUser.exp || 0) < oldUser.exp) {
                            global.db.data.users[m.sender] = {
                                ...oldUser,
                                jidViejo: realJid, // Marca de migración
                                name: oldUser.name || await this.getName(m.sender)
                            };
                        }
                    }
                }
            } catch (e) {
                console.error("Error en migración LID:", e);
            }
        }
        // --- FIN MIGRACIÓN ---

        m.exp = 0
        m.coin = false
        try {
            let user = global.db.data.users[m.sender]
            if (!user || typeof user !== 'object') {
                user = global.db.data.users[m.sender] = {}
            }
            if (user) {
                if (typeof user.name === 'object' || user.name === '[object Object]') {
                    user.name = typeof m.name === 'string' ? m.name : (await m.name || m.pushName || '');
                }
                if (!isNumber(user.exp))
                    user.exp = 0
                if (!isNumber(user.coin))
                    user.coin = 10
                if (!isNumber(user.joincount))
                    user.joincount = 1
                if (!isNumber(user.diamond))
                    user.diamond = 3
                if (!isNumber(user.lastadventure))
                    user.lastadventure = 0
                if (!isNumber(user.lastclaim))
                    user.lastclaim = 0
                if (!isNumber(user.health))
                    user.health = 100
                if (!isNumber(user.crime))
                    user.crime = 0
                if (!isNumber(user.lastcofre))
                    user.lastcofre = 0
                if (!isNumber(user.lastdiamantes))
                    user.lastdiamantes = 0
                if (!isNumber(user.lastpago))
                    user.lastpago = 0
                if (!isNumber(user.lastcode))
                    user.lastcode = 0
                if (!isNumber(user.lastcodereg))
                    user.lastcodereg = 0
                if (!isNumber(user.lastduel))
                    user.lastduel = 0
                if (!isNumber(user.lastmining))
                    user.lastmining = 0
                if (!('muto' in user))
                    user.muto = false
                if (!('premium' in user))
                    user.premium = false
                if (!user.premium)
                    user.premiumTime = 0
                if (!('registered' in user))
                    user.registered = false
                if (!('genre' in user))
                    user.genre = ''
                if (!('birth' in user))
                    user.birth = ''
                if (!('marry' in user))
                    user.marry = ''
                if (!('description' in user))
                    user.description = ''
                if (!('packstickers' in user))
                    user.packstickers = null
                if (!user.registered) {
                    if (!('name' in user))
                        user.name = typeof m.name === 'string' ? m.name : (await m.name || m.pushName || '');
                    if (!('wa_username' in user))
                        user.wa_username = ''
                    if (!isNumber(user.age))
                        user.age = -1
                    if (!isNumber(user.regTime))
                        user.regTime = -1
                }
                if (!isNumber(user.afk))
                    user.afk = -1
                if (!('afkReason' in user))
                    user.afkReason = ''
                if (!('role' in user))
                    user.role = 'Nuv'
                if (!('banned' in user))
                    user.banned = false
                if (!('useDocument' in user))
                    user.useDocument = false
                if (!isNumber(user.level))
                    user.level = 0
                if (!isNumber(user.bank))
                    user.bank = 0
                if (!isNumber(user.warn))
                    user.warn = 0
            } else
                global.db.data.users[m.sender] = {
                    exp: 0,
                    coin: 10,
                    joincount: 1,
                    diamond: 3,
                    lastadventure: 0,
                    health: 100,
                    lastclaim: 0,
                    lastcofre: 0,
                    lastdiamantes: 0,
                    lastcode: 0,
                    lastduel: 0,
                    lastpago: 0,
                    lastmining: 0,
                    lastcodereg: 0,
                    muto: false,
                    registered: false,
                    genre: '',
                    birth: '',
                    marry: '',
                    description: '',
                    packstickers: null,
                    name: typeof m.name === 'string' ? m.name : (await m.name || m.pushName || ''),
                    wa_username: '',
                    age: -1,
                    regTime: -1,
                    afk: -1,
                    afkReason: '',
                    banned: false,
                    useDocument: false,
                    bank: 0,
                    level: 0,
                    role: 'Nuv',
                    premium: false,
                    premiumTime: 0,
                }
            let chat = global.db.data.chats[m.chat]
            if (!chat || typeof chat !== 'object') {
                chat = global.db.data.chats[m.chat] = {}
            }
            if (chat) {
                if (!('isBanned' in chat))
                    chat.isBanned = false
                if (!('sAutoresponder' in chat))
                    chat.sAutoresponder = ''
                if (!('welcome' in chat))
                    chat.welcome = true
                if (!('autolevelup' in chat))
                    chat.autolevelup = false
                if (!('autoAceptar' in chat))
                    chat.autoAceptar = false
                if (!('autosticker' in chat))
                    chat.autosticker = false
                if (!('autoRechazar' in chat))
                    chat.autoRechazar = false
                if (!('autoresponder' in chat))
                    chat.autoresponder = false
                if (!('detect' in chat))
                    chat.detect = true
                if (!('antiBot' in chat))
                    chat.antiBot = false
                if (!('antiBot2' in chat))
                    chat.antiBot2 = false
                if (!('modoadmin' in chat))
                    chat.modoadmin = false
                if (!('antiLink' in chat))
                    chat.antiLink = false
                if (!('reaction' in chat))
                    chat.reaction = false
                if (!('nsfw' in chat))
                    chat.nsfw = false
                if (!('antifake' in chat))
                    chat.antifake = false
                if (!('delete' in chat))
                    chat.delete = false
                if (!isNumber(chat.expired))
                    chat.expired = 0
                if (!('antiLag' in chat))
                    chat.antiLag = false
                if (!('per' in chat))
                    chat.per = []
            } else
                global.db.data.chats[m.chat] = {
                    isBanned: false,
                    sAutoresponder: '',
                    welcome: true,
                    autolevelup: false,
                    autoresponder: false,
                    delete: false,
                    autoAceptar: false,
                    autoRechazar: false,
                    detect: true,
                    antiBot: false,
                    antiBot2: false,
                    modoadmin: false,
                    antiLink: false,
                    antifake: false,
                    reaction: false,
                    nsfw: false,
                    expired: 0,
                    antiLag: false,
                    per: [],
                }
            let settings = global.db.data.settings[botJid]
            if (!settings || typeof settings !== 'object') {
                settings = global.db.data.settings[botJid] = {}
            }
            if (settings) {
                if (!('self' in settings)) settings.self = false
                if (!('restrict' in settings)) settings.restrict = true
                if (!('jadibotmd' in settings)) settings.jadibotmd = true
                if (!('antiPrivate' in settings)) settings.antiPrivate = false
                if (!('welcome' in settings)) settings.welcome = ""
                if (!('bye' in settings)) settings.bye = ""
                if (!('botName' in settings)) settings.botName = ""
                if (!('autoread' in settings)) settings.autoread = false
                if (!('logo' in settings)) settings.logo = { banner: '', welcome: '' }
            } else global.db.data.settings[botJid] = {
                self: false,
                restrict: true,
                jadibotmd: true,
                antiPrivate: false,
                autoread: false,
                status: 0,
                botName: "",
                welcome: "",
                bye: "",
                logo: { banner: '', welcome: '' },
            }
        } catch (e) {
            console.error(e)
        }
        // Guard: durante reconexión/vinculación, el bot principal puede no estar listo.
        const mainBot = getSocketJid(global.conn)
        if (!mainBot) return

        const chat = global.db.data.chats[m.chat] || {}
        const isSubbs = chat.antiLag === true
        const allowedBots = new Set(
            (Array.isArray(chat.per) ? chat.per : [])
                .map(stripDevice)
        )

        allowedBots.add(mainBot)

        if (isSubbs && !allowedBots.has(botJid)) return

        if (m.isBaileys) return
        // FIX: Filtrar mensajes vacíos (fallos de descifrado / ecos de protocolo)
        // Llegan como Conversation de 0 bytes de cualquier sender (incluidos subbots)
        // Preserva: reacciones (2B), media, stubs de grupo, mensajes con texto real
        if (!m.text && !m.messageStubType && 
            !m.message?.imageMessage && !m.message?.videoMessage && 
            !m.message?.documentMessage && !m.message?.audioMessage && 
            !m.message?.stickerMessage && !m.message?.reactionMessage &&
            !m.message?.contactMessage && !m.message?.contactsArrayMessage &&
            !m.message?.locationMessage && !m.message?.liveLocationMessage &&
            !m.message?.listResponseMessage && !m.message?.buttonsResponseMessage &&
            !m.message?.templateButtonReplyMessage && !m.message?.pollCreationMessage &&
            !m.message?.pollUpdateMessage && !m.message?.stickerPackMessage) return
        if (opts['nyimak']) return
        if (!m.fromMe && opts['self']) return
        if (opts['swonly'] && m.chat !== 'status@broadcast') return
        if ((opts['pconly'] || global.db.data.settings?.[botJid]?.pconly) && m.chat.endsWith('@g.us')) return
        if ((opts['gconly'] || global.db.data.settings?.[botJid]?.gconly) && !m.chat.endsWith('@g.us') && m.chat !== 'status@broadcast') return
        if (typeof m.text !== 'string') m.text = ''

        // ── Auto-React en grupos configurados ────────────────────────────
        // FIX: Solo bot principal, 15% probabilidad, delay exponencial humano.
        // Antes: TODOS los bots reaccionaban a CADA mensaje → patrón de spam.
        try {
            // Cargar desde archivo JSON si global está vacío
            if (!global.autoReactChannels || global.autoReactChannels.length === 0) {
                try {
                    const _file = join(process.cwd(), 'autoreact-channels.json')
                    if (existsSync(_file)) {
                        const _data = JSON.parse(readFileSync(_file, 'utf-8'))
                        global.autoReactChannels = Array.isArray(_data) ? _data : []
                    }
                } catch {}
            }
            const _arChannels = global.autoReactChannels
            // FIX: Solo el bot principal reacciona + solo 15% de mensajes
            const _isMainBot = this === global.conn
            if (_isMainBot && _arChannels.includes(m.chat) && !m.fromMe && !m.message?.reactionMessage && !m.messageStubType && m.key) {
                if (Math.random() < 0.15) {
                    const _arEmojis = ['❤️', '🔥', '👏', '😍', '🫶', '💯', '🎉', '⭐', '👍', '💖', '🥰', '✨', '💜', '🙌']
                    const _arEmoji = _arEmojis[Math.floor(Math.random() * _arEmojis.length)]
                    // FIX: Delay exponencial (más humano) — 10-45s en vez de 2-15s
                    const _arDelay = 10000 + Math.floor(-Math.log(Math.random()) * 12000)
                    const _arConn = this
                    const _arKey = { ...m.key }
                    setTimeout(() => {
                        _arConn.sendMessage(m.chat, { react: { text: _arEmoji, key: _arKey } }).catch(() => {})
                    }, Math.min(_arDelay, 45000))
                }
            }
        } catch {}
        // ─────────────────────────────────────────────────────────────────

        let _user = global.db.data && global.db.data.users && global.db.data.users[m.sender]

        // --- Detección de owner/mods/prems compatible con LID ---
        // Cache LID: evita lookups repetidos al Signal Repository (5 min TTL)
        const _lidCacheMap = global._lidResolveCache ??= new Map()
        const _LID_CACHE_TTL = 300_000 // 5 minutos
        async function _areJidsSameCached(jid1, jid2, conn) {
            const key = `${jid1}|${jid2}`
            const cached = _lidCacheMap.get(key)
            if (cached && Date.now() - cached.ts < _LID_CACHE_TTL) return cached.val
            const result = await areJidsSameUserLid(jid1, jid2, conn)
            _lidCacheMap.set(key, { val: result, ts: Date.now() })
            // Limpiar cache si crece demasiado (> 500 entradas)
            if (_lidCacheMap.size > 500) {
                const now = Date.now()
                for (const [k, v] of _lidCacheMap) {
                    if (now - v.ts > _LID_CACHE_TTL) _lidCacheMap.delete(k)
                }
            }
            return result
        }

        const senderJid = stripDevice(m.sender)
        const ownerJids = normalizeAuthList(global.owner)
        let isROwner = ownerJids.includes(senderJid)
        if (!isROwner && m.sender.endsWith('@lid')) {
            for (const oj of ownerJids) {
                if (await _areJidsSameCached(m.sender, oj, this)) { isROwner = true; break }
            }
        }
        const isOwner = isROwner || m.fromMe
        let isMods = isROwner
        if (!isMods) {
            const modJids = normalizeAuthList(global.mods)
            isMods = modJids.includes(senderJid)
            if (!isMods && m.sender.endsWith('@lid')) {
                for (const mj of modJids) {
                    if (await _areJidsSameCached(m.sender, mj, this)) { isMods = true; break }
                }
            }
        }
        let isPrems = isROwner
        if (!isPrems) {
            const premJids = normalizeAuthList(global.prems)
            isPrems = premJids.includes(senderJid) || _user?.premium == true
            if (!isPrems && m.sender.endsWith('@lid')) {
                for (const pj of premJids) {
                    if (await _areJidsSameCached(m.sender, pj, this)) { isPrems = true; break }
                }
            }
        }

        // ── Throttle diferenciado por tipo de comando ───────────────────
        // Comandos normales: 3s | Descargas: 15s | Descargas pesadas: 45s
        // Mods/premium sin límite.
        if (m.text && !(isMods || isPrems)) {
            const _throttleMap = global._cmdThrottle ??= new Map()
            const _lastCmd = _throttleMap.get(m.sender) || 0
            const _cooldown = 3000
            const _wait = _cooldown - (Date.now() - _lastCmd)
            if (_wait > 0) await delay(_wait)
            _throttleMap.set(m.sender, Date.now())
            // GC: limpiar entradas antiguas cada 1000 comandos
            if (_throttleMap.size > 1000) {
                const now = Date.now()
                for (const [k, v] of _throttleMap) {
                    if (now - v > 60000) _throttleMap.delete(k)
                }
            }
        }

        // ── Sistema de XP diferenciado ─────────────────────────────────
        // Cooldown anti-spam: solo otorgar XP una vez cada 30 segundos por usuario
        const _xpNow = Date.now()
        const _xpUser = global.db.data.users[m.sender]
        const _lastXp = (_xpUser && _xpUser._lastXpAt) || 0
        const _xpCooldown = 30_000 // 30 segundos

        if (_xpNow - _lastXp >= _xpCooldown) {
            // Detectar si el mensaje usa un prefijo de comando (es un comando del bot)
            const _prefix = conn.prefix ? conn.prefix : global.prefix
            const _prefixArr = Array.isArray(_prefix) ? _prefix : [_prefix]
            const _isCmd = _prefixArr.some(prefix =>
                (prefix instanceof RegExp || typeof prefix === 'string') &&
                Boolean(matchPrefix(prefix, m.text)[0])
            )

            if (_isCmd) {
                // Comando del bot → XP alto: 25–60
                m.exp += Math.floor(Math.random() * 36) + 25
            } else {
                // Mensaje normal → XP moderado: 8–20
                m.exp += Math.floor(Math.random() * 13) + 8
            }

            // Registrar timestamp del último XP ganado
            if (_xpUser) _xpUser._lastXpAt = _xpNow
        }

        let usedPrefix

        // --- Resolución de participantes compatible con LID (Baileys v7) ---
        // FIX: cache-first → conn.chats fallback → background refresh (sin await)
        // Elimina queries síncronas a WA que causaban rate-overlimit en 200 grupos
        let groupMetadata = { participants: [] }
        if (m.isGroup) {
            // 1) NodeCache (TTL 12min, más fresco)
            groupMetadata = global.groupMetadataCache?.get(m.chat) || null
            // 2) store en memoria
            if (!groupMetadata) groupMetadata = conn.chats?.[m.chat]?.metadata || null
            // 3) Solo si ambos están vacíos: refresh en background (sin bloquear)
            if (!groupMetadata) {
                groupMetadata = { participants: [] }
                if (isSocketOpen(this)) {
                    global.pendingGroupMetadata ??= new Map()
                    if (!global.pendingGroupMetadata.has(m.chat)) {
                        const fetchPromise = this.groupMetadata(m.chat).then(meta => {
                            if (meta) {
                                global.groupMetadataCache?.set(m.chat, meta)
                                if (conn.chats?.[m.chat]) conn.chats[m.chat].metadata = meta
                            }
                        }).catch(() => {}).finally(() => {
                            global.pendingGroupMetadata.delete(m.chat)
                        })
                        global.pendingGroupMetadata.set(m.chat, fetchPromise)
                    }
                }
            }
            groupMetadata ??= { participants: [] }
        }
        const participants = Array.isArray(groupMetadata.participants) ? groupMetadata.participants : []
        
        // Buscar participante del sender y del bot usando resolución LID-aware
        const user = (m.isGroup ? await findParticipant(participants, m.sender, this) : null) || {}
        const bot = (m.isGroup ? await findParticipant(participants, botJid, this) : null) || {}

        // ── Auto-registro con username de WhatsApp (Baileys v7) ─────────
        // El campo `username` (el @ de WA) es único, limpio y estable.
        // Si el usuario no está registrado y tiene username, se registra
        // automáticamente sin necesidad de usar .name manualmente.
        {
            const dbUser = global.db.data.users[m.sender]
            if (dbUser) {
                // Guardar el username de WA en una categoria propia siempre que exista
                if (user?.username && dbUser.wa_username !== user.username) {
                    dbUser.wa_username = user.username
                }
                // Fuentes de nombre, en orden de prioridad:
                // 1) username del participante (único, limpio, sin emojis)
                // 2) notify del participante (nombre de perfil WA)
                // 3) pushName del mensaje (puede tener emojis/caracteres raros)
                const autoName = user?.username || user?.notify || m.pushName || ''
                if (autoName && autoName.length >= 2) {
                    // Sanitizar: solo letras, números, espacios y acentos
                    const clean = autoName.replace(/[^\w\sáéíóúÁÉÍÓÚñÑüÜ.\-]/gi, '').trim()
                    if (clean.length >= 2) {
                        // Actualizar nombre si cambió
                        if (dbUser.name !== clean.substring(0, 20)) {
                            dbUser.name = clean.substring(0, 20)
                        }
                        if (!dbUser.registered) {
                            dbUser.registered = true
                            dbUser.regTime = Date.now()
                            dbUser.age = -1 // sin edad, la puede poner después
                        }
                    }
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────

        const isRAdmin = user?.admin === "superadmin"
        const isAdmin = isRAdmin || user?.admin === "admin" || false
        const isBotAdmin = !!bot?.admin || false

        const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './plugins')
        
        // --- EVALUACIÓN ASÍNCRONA NO-BLOQUEANTE (Fire and Forget para .all) ---
        // NOTA: plugin.before NO se ejecuta aquí. Se ejecuta en el bucle
        // principal de comandos (~L818) donde su valor de retorno sí importa
        // (puede detener el procesamiento con `continue`).
        const passivePromises = [];
        for (let name in global.plugins) {
            let plugin = global.plugins[name]
            if (!plugin || plugin.disabled) continue
            const __filename = join(___dirname, name)
            
            if (typeof plugin.all === 'function') {
                passivePromises.push(
                    plugin.all.call(this, m, {
                        conn: this, participants, groupMetadata, user, bot,
                        isROwner, isOwner, isRAdmin, isAdmin, isBotAdmin,
                        isPrems, chatUpdate, __dirname: ___dirname, __filename
                    }).catch(e => console.error(`[Plugin:all error en ${name}]:`, e))
                );
            }
        }
        
        if (passivePromises.length > 0) {
            await Promise.allSettled(passivePromises);
        }
        // --------------------------------------------------------------------------------

        for (let name in global.plugins) {
            let plugin = global.plugins[name]
            if (!plugin)
                continue
            if (plugin.disabled)
                continue
            const __filename = join(___dirname, name)

            if (!opts['restrict'])
                if (plugin.tags && plugin.tags.includes('admin')) {
                    continue
                }
            const _prefix = plugin.customPrefix
                ? plugin.customPrefix
                : conn.prefix
                    ? conn.prefix
                    : global.prefix

            const prefixCandidates = Array.isArray(_prefix)
                ? _prefix
                : [_prefix]

            const match = prefixCandidates
                .filter(prefix => prefix instanceof RegExp || typeof prefix === 'string')
                .map(prefix => matchPrefix(prefix, m.text))
                .find(([result]) => result) || [null, null]
            if (typeof plugin.before === 'function') {
                if (await plugin.before.call(this, m, {
                    match,
                    conn: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isROwner,
                    isOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    isPrems,
                    chatUpdate,
                    __dirname: ___dirname,
                    __filename
                }))
                    continue
            }
            if (typeof plugin !== 'function')
                continue
            if ((usedPrefix = (match[0] || '')[0])) {
                let noPrefix = m.text.replace(usedPrefix, '')
                let [command, ...args] = noPrefix.trim().split` `.filter(v => v)
                args = args || []
                let _args = noPrefix.trim().split` `.slice(1)
                let text = _args.join` `
                command = (command || '').toLowerCase()
                let fail = plugin.fail || global.dfail
                const isAccept = commandMatches(
                    plugin.command,
                    command
                )

                global.comando = command

                const messageId = String(m.id || m.key?.id || '')
                if (
                    messageId.startsWith('NJX-') ||
                    (messageId.startsWith('BAE5') && messageId.length === 16) ||
                    (messageId.startsWith('B24E') && messageId.length === 20)
                ) return

                if (!isAccept) {
                    continue
                }
                m.plugin = name
                let currentChatData = global.db.data.chats[m.chat];
                
                // ── AUTO-ASIGNACIÓN: Si no hay primaryBot, asignar al bot actual automáticamente ──
                // Esto evita que TODOS los bots respondan al mismo comando
                if (!currentChatData?.primaryBot && m.isGroup && (global.conns?.length > 0)) {
                    const activeBots = [global.conn, ...(global.conns || [])].filter(c => {
                        const readyState = c?.ws?.socket?.readyState ?? c?.ws?.readyState
                        return c?.user && readyState === 1
                    })
                    if (activeBots.length > 1) {
                        // Auto-asignar el bot actual como primario (el primero en procesar gana)
                        if (!currentChatData) {
                            global.db.data.chats[m.chat] = {}
                            currentChatData = global.db.data.chats[m.chat]
                        }
                        currentChatData.primaryBot = botJid
                    }
                }
                
                if (currentChatData?.primaryBot) {
                    const primaryBot = stripDevice(currentChatData.primaryBot)

                    // Verificar si el bot primario tiene una conexión activa
                    const allBots = [global.conn, ...(global.conns || [])].filter(c =>
                        c?.user && (c?.ws?.socket?.readyState ?? c?.ws?.readyState) === 1
                    )
                    let primaryHasActiveConn = false
                    for (const c of allBots) {
                        const cJid = getSocketJid(c)
                        if (stripDevice(cJid) === primaryBot) {
                            primaryHasActiveConn = true
                            break
                        }
                        if (await areJidsSameUserLid(cJid, primaryBot, this)) {
                            primaryHasActiveConn = true
                            break
                        }
                    }

                    if (!primaryHasActiveConn) {
                        // El bot primario no tiene conexión activa → liberar para que todos respondan
                        delete currentChatData.primaryBot
                    } else {
                        // Verificar también que siga en el grupo (participantes)
                        const primaryStillInGroup = await findParticipant(participants, primaryBot, this)

                        // FIX: Solo invalidar si TENEMOS el array de participantes y confirmamos que NO está.
                        // Si el caché (participants) está vacío, asumimos que sigue adentro para evitar desvincular
                        // y que todos los bots respondan al mismo tiempo por error.
                        if (participants.length > 0 && !primaryStillInGroup) {
                            delete currentChatData.primaryBot
                        } else {
                            const isPrimary = await areJidsSameUserLid(
                                primaryBot,
                                botJid,
                                this
                            )

                            if (!isPrimary && stripDevice(botJid) !== primaryBot) {
                                continue
                            }
                        }
                    }
                }
                if (m.chat in global.db.data.chats || m.sender in global.db.data.users) {
                    let chat = global.db.data.chats[m.chat]
                    let user = global.db.data.users[m.sender]
                    
                    const isUnbanPlugin = name.endsWith('grupo-unbanchat.js');
                    const isOwnerExecPlugin = name.endsWith('owner-exec.js') || name.endsWith('owner-exec2.js');
                    const isDeletePlugin = name.endsWith('grupo-delete.js');
                    
                    if (!isUnbanPlugin && !isOwnerExecPlugin && !isDeletePlugin && chat?.isBanned && !isROwner) return
                    
                    if (user.antispam > 2) return
                    if (m.text && user.banned && !isROwner) {
                        m.reply(`《✦》Estas baneado/a, no puedes usar comandos en este bot!\n\n${user.bannedReason ? `✰ *Motivo:* ${user.bannedReason}` : '✰ *Motivo:* Sin Especificar'}\n\n> ✧ Si este Bot es cuenta oficial y tiene evidencia que respalde que este mensaje es un error, puedes exponer tu caso con un moderador.`)
                        user.antispam++
                        return
                    }

                    if (user.antispam2 && isROwner) return
                    const _spamTs = global.db.data.users[m.sender].spam || 0
                    if (Date.now() - _spamTs < 3000) return console.log(`[ SPAM ]`)
                    global.db.data.users[m.sender].spam = Date.now()

                    // El check de banned / isBanned de grupo y usuario ya se realizó 
                    // en las líneas superiores (L955-966) correctamente, por lo que
                    // se elimina el bloque redundante que causaba shadowing.
                }

                // ── 🎮 BLOQUEO DE JUEGOS Y APUESTAS POR GRUPO ───────────────────────────
                if (m.isGroup) {
                    const _chatGames = global.db.data.chats[m.chat]
                    const _usedPrefix = usedPrefix || '.'

                    const BETTING_CMDS = new Set([
                        'bj', 'blackjack', '21',
                        'slot', 'slots', 'tragamonedas',
                        'coinflip', 'flipbet', 'cfbet', 'caracruz', 'cc',
                        'ruleta', 'roulette', 'rlt',
                        'crash', 'crsh',
                        'mines', 'minas', 'mine', 'buscaminas', 'minesweeper',
                        'plinko', 'plk',
                        'dados', 'dice',
                        'highlow', 'hl', 'hol', 'mayormenor', 'mayoromenor',
                        'towers', 'tower', 'torre', 'torres',
                        'carrera', 'race',
                        'duelo', 'ppt', 'rps', 'piedrapapeltijera',
                        'robar', 'rob'
                    ])

                    const isGameTag = plugin.tags && (plugin.tags.includes('juegos') || plugin.tags.includes('game'))
                    const isBettingCmd = BETTING_CMDS.has(command) || (plugin.tags && plugin.tags.includes('apuestas'))

                    // .games off → bloquea TODOS los juegos del tag 'juegos' o apuestas
                    if (_chatGames && _chatGames.games === false && (isGameTag || isBettingCmd)) {
                        conn.reply(m.chat,
                            `《✧》 Los *Juegos* están desactivados en este grupo.\n\n> ✦ Un *administrador* puede activarlos con:\n> » *${_usedPrefix}games on*`,
                            m)
                        break
                    }

                    // .apuestas off → bloquea solo los juegos de apuesta
                    if (_chatGames && _chatGames.apuestas === false && isBettingCmd) {
                        conn.reply(m.chat,
                            `《✧》 Las *Apuestas* están desactivadas en este grupo.\n\n> ✦ Un *administrador* puede activarlas con:\n> » *${_usedPrefix}apuestas on*\n> ✦ Los juegos sin apuesta siguen disponibles.`,
                            m)
                        break
                    }
                }
                // ────────────────────────────────────────────────────────────────────────

                const adminMode = global.db.data.chats[m.chat]?.modoadmin === true
                if (adminMode && m.isGroup && !isAdmin && !isOwner && !isROwner) {
                    await fail('admin', m, usedPrefix, command, this)
                    continue
                }
                if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) {
                    await fail('owner', m, usedPrefix, command, this)
                    continue
                }
                if (plugin.rowner && !isROwner) {
                    await fail('rowner', m, usedPrefix, command, this)
                    continue
                }
                if (plugin.owner && !isOwner) {
                    await fail('owner', m, usedPrefix, command, this)
                    continue
                }
                if (plugin.mods && !isMods) {
                    await fail('mods', m, usedPrefix, command, this)
                    continue
                }
                if (plugin.premium && !isPrems) {
                    await fail('premium', m, usedPrefix, command, this)
                    continue
                }
                if (plugin.group && !m.isGroup) {
                    await fail('group', m, usedPrefix, command, this)
                    continue
                } else if (plugin.botAdmin && !isBotAdmin) {
                    let realBotAdmin = false;
                    try {
                        const freshMeta = await this.groupMetadata(m.chat);
                        global.groupMetadataCache?.set(m.chat, freshMeta);
                        if (this.chats?.[m.chat]) this.chats[m.chat].metadata = freshMeta;
                        const botJidRaw = this.user?.jid || this.user?.id || '';
                        const botParticipant = await findParticipant(freshMeta.participants, botJidRaw, this);
                        realBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
                    } catch (e) {
                        console.error('[handler] Error en doble comprobación botAdmin:', e?.message);
                    }

                    if (!realBotAdmin) {
                        await fail('botAdmin', m, usedPrefix, command, this)
                        continue
                    }
                    isBotAdmin = true; 
                } else if (plugin.admin && !isAdmin) {
                    // Doble comprobación para admin de usuario (vital para grupos LID o cachés sucios)
                    let realUserAdmin = false;
                    try {
                        const freshMeta = await this.groupMetadata(m.chat);
                        global.groupMetadataCache?.set(m.chat, freshMeta);
                        if (this.chats?.[m.chat]) this.chats[m.chat].metadata = freshMeta;
                        const userParticipant = await findParticipant(freshMeta.participants, m.sender, this);
                        realUserAdmin = userParticipant?.admin === 'admin' || userParticipant?.admin === 'superadmin';
                    } catch (e) {
                        console.error('[handler] Error en doble comprobación isAdmin:', e?.message);
                    }

                    if (!realUserAdmin && !isOwner) {
                        await fail('admin', m, usedPrefix, command, this)
                        continue
                    }
                    isAdmin = true;
                }
                if (plugin.private && m.isGroup) {
                    await fail('private', m, usedPrefix, command, this)
                    continue
                }
                if (plugin.register == true && _user.registered == false) {
                    await fail('unreg', m, usedPrefix, command, this)
                    continue
                }
                m.isCommand = true
                let xp = 'exp' in plugin ? parseInt(plugin.exp) : 17
                if (xp > 200)
                    m.reply('chirrido -_-')
                else
                    m.exp += xp
                if (!isPrems && plugin.coin && global.db.data.users[m.sender].coin < plugin.coin * 1) {
                    conn.reply(m.chat, `❮✦❯ Se agotaron tus ${moneda}`, m)
                    continue
                }
                if (plugin.level > _user.level) {
                    conn.reply(m.chat, `❮✦❯ Se requiere el nivel: *${plugin.level}*\n\n• Tu nivel actual es: *${_user.level}*\n\n• Usa este comando para subir de nivel:\n*${usedPrefix}levelup*`, m)
                    continue
                }
                let extra = {
                    match,
                    usedPrefix,
                    noPrefix,
                    _args,
                    args,
                    command,
                    text,
                    conn: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isROwner,
                    isOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    isPrems,
                    chatUpdate,
                    __dirname: ___dirname,
                    __filename
                }
                // ──────────────────────────────────────────────────────────────
                // FIX: Reacciones/presencia eliminadas para ahorrar cuota WA
                // Antes: 5 msgs de protocolo por comando → ahora 0
                // Se mantiene react ❌ en error (ver catch abajo)
                // ──────────────────────────────────────────────────────────────
                // ── Semáforo de descargas + Límite subbots ──────────────────
                const _isMainBot = this === global.conn
                const _isDownload = name.startsWith('descargas-') ||
                    name === 'ai-musica.js' ||
                    name.startsWith('Spotify')
                const _isHeavyDownload = _isDownload && (
                    name.includes('video2') ||
                    name.includes('mediafire') ||
                    name.includes('apk') ||
                    name.includes('anime') ||
                    name.includes('drive')
                )

                let _releaseSlot = null
                try {
                    // Adquirir slot del semáforo para descargas
                    if (_isDownload && !(isMods || isPrems)) {
                        _releaseSlot = downloadSemaphore.acquire(
                            botJid, m.sender, _isMainBot, _isHeavyDownload
                        )
                    }

                    await plugin.call(this, m, extra)

                    if (!isPrems && !m.isCommandError)
                        m.coin = m.coin || plugin.coin || false
                } catch (e) {
                    // Si el error es del semáforo (cooldown/límite), notificar sin ❌
                    if (e?.name === 'DownloadLimitError') {
                        m.reply(e.message)
                    } else {
                        m.error = e
                        console.error(e)
                        try { await this.sendMessage(m.chat, { react: { text: '❌', key: m.key } }) } catch (_) {}
                        if (e) {
                            let text = format(e)
                            if (global.APIKeys) {
                                for (let key of Object.values(global.APIKeys))
                                    text = text.replace(new RegExp(key, 'g'), 'Administrador')
                            }
                            m.reply(text)
                        }
                    }
                } finally {
                    // Liberar slot del semáforo
                    if (_releaseSlot) {
                        try { _releaseSlot() } catch (_) {}
                    }
                    if (typeof plugin.after === 'function') {
                        try {
                            await plugin.after.call(this, m, extra)
                        } catch (e) {
                            console.error(e)
                        }
                    }
                    if (m.coin)
                        conn.reply(m.chat, `❮✦❯ Utilizaste ${+m.coin} ${moneda}`, m)
                }
                break
            }
        }
    } catch (e) {
        console.error(e)
    } finally {
        if (opts['queque'] && m.text) {
            const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id)
            if (quequeIndex !== -1)
                this.msgqueque.splice(quequeIndex, 1)
        }
        let user, stats = global.db.data.stats ||= {}
        if (m) {
            let utente = global.db.data.users[m.sender]
            if (utente && utente.muto == true) {
                let bang = m.key.id
                let cancellazzione = m.key.participant
                await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: bang, participant: cancellazzione } })
            }
            if (m.sender && (user = global.db.data.users[m.sender])) {
                user.exp += m.exp
                user.coin -= m.coin * 1
            }

            let stat
            if (m.plugin) {
                let now = +new Date
                if (m.plugin in stats) {
                    stat = stats[m.plugin]
                    if (!isNumber(stat.total))
                        stat.total = 1
                    if (!isNumber(stat.success))
                        stat.success = m.error != null ? 0 : 1
                    if (!isNumber(stat.last))
                        stat.last = now
                    if (!isNumber(stat.lastSuccess))
                        stat.lastSuccess = m.error != null ? 0 : now
                } else
                    stat = stats[m.plugin] = {
                        total: 1,
                        success: m.error != null ? 0 : 1,
                        last: now,
                        lastSuccess: m.error != null ? 0 : now
                    }
                stat.total += 1
                stat.last = now
                if (m.error == null) {
                    stat.success += 1
                    stat.lastSuccess = now
                }
            }
        }
        try {
            if (!opts['noprint']) await printMessage(m, this)
        } catch (e) {
            console.log(m, m.quoted, e)
        }
        const settingsREAD =
            botJid
                ? global.db.data.settings?.[botJid] || {}
                : {}

        if (
            (opts['autoread'] || settingsREAD.autoread) &&
            m?.key
        ) {
            await this.readMessages([m.key]).catch(() => {})
        }

        const chatData = db.data.chats?.[m.chat]
        // FIX: Regex corregida — se eliminó |a|s que coincidía con CUALQUIER palabra.
        // FIX: Solo bot principal + 20% probabilidad para no spamear reacciones.
        if (chatData?.reaction && this === global.conn && Math.random() < 0.20 && m.text?.match(/(ción|dad|aje|oso|izar|mente|tion|age|ous|ify)/gi)) {
            let emot = pickRandom(["🍟", "😃", "😄", "😁", "😆", "🍓", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "🌺", "🌸", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🌟", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "💫", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😶‍🌫️", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🫣", "🤭", "🤖", "🍭", "🤫", "🫠", "🤥", "😶", "📇", "😐", "💧", "😑", "🫨", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😮‍💨", "😵", "😵‍💫", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👺", "🧿", "🌩", "👻", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🫶", "👍", "✌️", "🙏", "🫵", "🤏", "🤌", "☝️", "🖕", "🙏", "🫵", "🫂", "🐱", "🤹‍♀️", "🤹‍♂️", "🗿", "✨", "⚡", "🔥", "🌈", "🩷", "❤️", "🧡", "💛", "💚", "🩵", "💙", "💜", "🖤", "🩶", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "🚩", "👊", "⚡️", "💋", "🫰", "💅", "👑", "🐣", "🐤", "🐈"])
            if (!m.fromMe) return this.sendMessage(m.chat, { react: { text: emot, key: m.key } })
        }
        function pickRandom(list) { return list[Math.floor(Math.random() * list.length)] }
    }
}

global.dfail = (type, m, usedPrefix, command, conn) => {

    let edadaleatoria = ['10', '28', '20', '40', '18', '21', '15', '11', '9', '17', '25'].getRandom()
    let user2 = m.pushName || 'Anónimo'
    let verifyaleatorio = ['registrar', 'reg', 'verificar', 'verify', 'register'].getRandom()

    const msg = {
        rowner: `Comando disponible solo para el creador del bot.`,
        owner: `Comando disponible solo para desarrolladores del bot.`,
        mods: `Comamdo disponible solo para desarradores del bot.`,
        premium: `Comando disponible solo para los usuarios premium.`,
        group: `Comando disposable solo en grupos.`,
        private: `Comando disponible solo al chat privado del bot.`,
        admin: `Comando disponible solo para admins.`,
        botAdmin: `Nesesito ser admin del grupo.`,
        unreg: `No estas registrado, registrate usando:\n> » #${verifyaleatorio} ${user2}.${edadaleatoria}`,
        restrict: `Esta caracteristica está desactivada.`
    }[type];
    if (msg) return m.reply(msg).then(_ => m.react('✖️'))
}

let file = global.__filename(import.meta.url, true)
unwatchFile(file)
watchFile(file, async () => {
    unwatchFile(file)
    console.log(chalk.magenta("Se actualizo 'handler.js'"))

    if (global.conns && global.conns.length > 0) {
        const users = [...new Set(
            global.conns.filter(conn => {
                const readyState =
                    conn?.ws?.socket?.readyState ??
                    conn?.ws?.readyState

                return conn?.user && readyState === 1
            })
        )]
        for (const userr of users) {
            userr.subreloadHandler(false)
        }
    }
});
