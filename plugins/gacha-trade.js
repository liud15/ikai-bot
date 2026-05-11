import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveClaimedChar } from '../src/lib/gacha-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

const TRADE_TIMEOUT = 2 * 60 * 1000 // 2 minutos para aceptar

// Almacén temporal de trades pendientes
if (!global.pendingTrades) global.pendingTrades = {}

/**
 * Normaliza un JID para que siempre sea número@s.whatsapp.net
 * Resuelve LIDs, elimina formatos inconsistentes
 */
function normalizeJid(jid) {
    if (!jid) return jid
    const num = global.getJidNum ? global.getJidNum(jid) : jid.split('@')[0]
    return `${num}@s.whatsapp.net`
}

let handler = async (m, { conn, args, command }) => {
    const chat = global.db.data.chats[m.chat]
    if (!chat.gacha) chat.gacha = { claimed: {}, activeRolls: {} }
    if (!chat.gacha.claimed) chat.gacha.claimed = {}

    const cmd = command.toLowerCase()

    // Normalizar sender siempre
    const senderNorm = normalizeJid(m.sender)

    // Leer personajes (necesario para búsqueda por nombre)
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
        characters = JSON.parse(clean)
    } catch (e) {
        characters = []
    }

    // --- ACEPTAR INTERCAMBIO ---
    if (cmd === 'tradeaccept' || cmd === 'aceptartrade') {
        // Buscar trade pendiente para este usuario (como receiver)
        const tradeKey = findTradeKeyForReceiver(m.chat, senderNorm)

        if (!tradeKey) {
            return m.reply('❌ No tienes solicitudes de intercambio pendientes.')
        }

        const trade = global.pendingTrades[tradeKey]

        if (Date.now() - trade.timestamp > TRADE_TIMEOUT) {
            delete global.pendingTrades[tradeKey]
            return m.reply('⏰ La solicitud de intercambio ha expirado.')
        }

        // Verificar que ambos personajes siguen perteneciendo a sus dueños
        const char1Data = chat.gacha.claimed[trade.charId1]
        const char2Data = chat.gacha.claimed[trade.charId2]

        if (!char1Data || normalizeJid(char1Data.owner) !== trade.senderNorm) {
            delete global.pendingTrades[tradeKey]
            return m.reply('❌ El personaje ofrecido ya no pertenece al usuario que lo ofreció.')
        }
        if (!char2Data || normalizeJid(char2Data.owner) !== trade.receiverNorm) {
            delete global.pendingTrades[tradeKey]
            return m.reply('❌ Tu personaje ya no está en tu harem.')
        }

        // Intercambiar propietarios
        chat.gacha.claimed[trade.charId1].owner = trade.receiverNorm
        chat.gacha.claimed[trade.charId1].claimMsg = ''
        chat.gacha.claimed[trade.charId1].fav = false
        chat.gacha.claimed[trade.charId2].owner = trade.senderNorm
        chat.gacha.claimed[trade.charId2].claimMsg = ''
        chat.gacha.claimed[trade.charId2].fav = false

        delete global.pendingTrades[tradeKey]

        const c1 = characters.find(c => String(c.id) === trade.charId1)
        const c2 = characters.find(c => String(c.id) === trade.charId2)
        const name1 = conn.getName(trade.senderNorm) || 'Usuario 1'
        const name2 = conn.getName(trade.receiverNorm) || 'Usuario 2'

        await conn.sendMessage(m.chat, {
            text: `
╭─⬣「 🔄 INTERCAMBIO EXITOSO 」⬣
│
│ 👤 @${global.getJidNum(trade.senderNorm)} recibe: *${c2?.name || trade.charId2}*
│ 👤 @${global.getJidNum(trade.receiverNorm)} recibe: *${c1?.name || trade.charId1}*
│
╰─⬣ ¡Intercambio completado! ⬣
    `.trim(),
            mentions: [trade.senderNorm, trade.receiverNorm]
        }, { quoted: m })
        return
    }

    // --- RECHAZAR INTERCAMBIO ---
    if (cmd === 'tradereject' || cmd === 'rechazartrade') {
        const tradeKey = findTradeKeyForReceiver(m.chat, senderNorm)
        if (tradeKey) {
            delete global.pendingTrades[tradeKey]
            return m.reply('❌ Intercambio rechazado.')
        }
        return m.reply('❌ No tienes solicitudes de intercambio pendientes.')
    }

    // --- CANCELAR INTERCAMBIO (el que envió la solicitud) ---
    if (cmd === 'tradecancel' || cmd === 'cancelartrade') {
        const tradeKey = findTradeKeyForSender(m.chat, senderNorm)
        if (tradeKey) {
            delete global.pendingTrades[tradeKey]
            return m.reply('❌ Solicitud de intercambio cancelada.')
        }
        return m.reply('❌ No tienes solicitudes de intercambio enviadas.')
    }

    // --- SOLICITAR INTERCAMBIO ---
    // Detectar usuario objetivo: mención o mensaje citado
    let rawTargetUser = m.mentionedJid?.[0] || m.quoted?.sender
    
    if (!rawTargetUser) {
        // Intentar extraer número del texto
        const fullText = args.join(' ')
        const numMatch = fullText.match(/@?([0-9]{7,20})/)
        if (numMatch) {
            rawTargetUser = numMatch[1] + '@s.whatsapp.net'
        }
    }

    if (!rawTargetUser) {
        return m.reply(`📋 *Uso:* #trade <tu personaje> @usuario <su personaje>

*Ejemplo:* #trade 15 @usuario 42
*Ejemplo:* #trade Makima @usuario Power

Puede usar IDs o nombres de personajes.
También puedes *responder* el mensaje del usuario.

El otro usuario debe aceptar con *#tradeaccept* o rechazar con *#tradereject*
Puedes cancelar con *#tradecancel*`)
    }

    const targetNorm = normalizeJid(rawTargetUser)

    if (targetNorm === senderNorm) {
        return m.reply('❌ No puedes intercambiar contigo mismo.')
    }

    // Verificar que no haya un trade pendiente del mismo sender
    const existingKey = findTradeKeyForSender(m.chat, senderNorm)
    if (existingKey) {
        return m.reply('❌ Ya tienes una solicitud de intercambio pendiente.\nUsa *#tradecancel* para cancelarla primero.')
    }

    // Separar args: <mi personaje> @mention/número <su personaje>
    const fullText = args.join(' ')
    
    // Buscar la posición de la mención o número para separar los dos personajes
    // Eliminamos la mención/@número del texto para obtener las dos partes
    let myCharInput = ''
    let theirCharInput = ''
    
    // Buscar por @número o número de teléfono en el texto
    const mentionRegex = /@[0-9]{7,20}/g
    const mentionMatch = fullText.match(mentionRegex)
    
    if (mentionMatch) {
        // Separar por la primera mención encontrada
        const idx = fullText.indexOf(mentionMatch[0])
        const len = mentionMatch[0].length
        myCharInput = fullText.substring(0, idx).trim()
        theirCharInput = fullText.substring(idx + len).trim()
    } else if (m.quoted?.sender) {
        // Si usó quote, todo el texto son los dos personajes separados por espacio
        // Formato: #trade <mi personaje> <su personaje>  (respondiendo al mensaje)
        const parts = fullText.trim().split(/\s+/)
        if (parts.length >= 2) {
            // Intentar dividir inteligentemente: asumir que cada "personaje" puede ser un ID (1 arg) o un nombre (1+ args)
            // Estrategia: si el primer arg es un número, el primer personaje es ese ID
            if (/^\d+$/.test(parts[0])) {
                myCharInput = parts[0]
                theirCharInput = parts.slice(1).join(' ')
            } else if (/^\d+$/.test(parts[parts.length - 1])) {
                myCharInput = parts.slice(0, -1).join(' ')
                theirCharInput = parts[parts.length - 1]
            } else {
                // Ambos son nombres: dividir por la mitad
                const mid = Math.ceil(parts.length / 2)
                myCharInput = parts.slice(0, mid).join(' ')
                theirCharInput = parts.slice(mid).join(' ')
            }
        } else if (parts.length === 1) {
            // Solo un argumento
            return m.reply('❌ Debes especificar ambos personajes.\n\n*Uso respondiendo mensaje:* #trade <tu personaje> <su personaje>')
        }
    } else {
        return m.reply('❌ Formato incorrecto. Usa: #trade <tu personaje> @usuario <su personaje>\nO responde el mensaje de un usuario: #trade <tu personaje> <su personaje>')
    }

    if (!myCharInput || !theirCharInput) {
        return m.reply('❌ Debes especificar ambos personajes.\n\n*Uso:* #trade <tu personaje> @usuario <su personaje>')
    }

    // Resolver mi personaje (verificar que está en mi harem)
    const myResult = resolveClaimedChar(chat.gacha.claimed, characters, myCharInput, senderNorm)
    if (!myResult.char) {
        return m.reply(`❌ No se encontró ningún personaje con "*${myCharInput}*".`)
    }
    if (!myResult.owned) {
        // Intentar verificar con el JID sin normalizar por si el owner fue guardado con otro formato
        const myResult2 = resolveClaimedChar(chat.gacha.claimed, characters, myCharInput, m.sender)
        if (!myResult2.owned) {
            return m.reply(`❌ El personaje *${myResult.char.name}* (ID: ${myResult.charId}) no está en tu harem.`)
        }
        // Si el owner original coincide con m.sender sin normalizar, actualizar para consistencia
        Object.assign(myResult, myResult2)
    }

    // Resolver su personaje (verificar que está en el harem del target)
    const theirResult = resolveClaimedChar(chat.gacha.claimed, characters, theirCharInput, targetNorm)
    if (!theirResult.char) {
        return m.reply(`❌ No se encontró ningún personaje con "*${theirCharInput}*".`)
    }
    if (!theirResult.owned) {
        // Intentar con el JID raw
        const theirResult2 = resolveClaimedChar(chat.gacha.claimed, characters, theirCharInput, rawTargetUser)
        if (!theirResult2.owned) {
            return m.reply(`❌ El personaje *${theirResult.char.name}* (ID: ${theirResult.charId}) no pertenece a ese usuario.`)
        }
        Object.assign(theirResult, theirResult2)
    }

    // Crear solicitud de trade
    const tradeKey = `trade_${m.chat}_${Date.now()}`
    global.pendingTrades[tradeKey] = {
        sender: m.sender,
        senderNorm: senderNorm,
        receiver: rawTargetUser,
        receiverNorm: targetNorm,
        charId1: myResult.charId,
        charId2: theirResult.charId,
        timestamp: Date.now(),
        chatId: m.chat
    }

    const senderName = conn.getName(m.sender) || 'Usuario'
    const receiverName = conn.getName(rawTargetUser) || 'Usuario'
    const targetNum = global.getJidNum(rawTargetUser)

    await conn.sendMessage(m.chat, {
        text: `
╭─⬣「 🔄 SOLICITUD DE INTERCAMBIO 」⬣
│
│ 👤 *${senderName}* ofrece:
│   🎴 *${myResult.char.name}* (💰${myResult.char.value})
│
│ 👤 *${receiverName}* daría:
│   🎴 *${theirResult.char.name}* (💰${theirResult.char.value})
│
│ ⏳ Expira en 2 minutos
│
╰─⬣ @${targetNum} usa *#tradeaccept* o *#tradereject* ⬣
  `.trim(),
        mentions: [`${targetNum}@s.whatsapp.net`]
    }, { quoted: m })

    // Auto-expirar
    const currentTs = global.pendingTrades[tradeKey]?.timestamp
    setTimeout(() => {
        if (global.pendingTrades[tradeKey]?.timestamp === currentTs) {
            delete global.pendingTrades[tradeKey]
        }
    }, TRADE_TIMEOUT)
}

/**
 * Busca un trade pendiente donde el usuario es el receiver
 */
function findTradeKeyForReceiver(chatId, receiverNorm) {
    for (const [key, trade] of Object.entries(global.pendingTrades)) {
        if (trade.chatId === chatId && trade.receiverNorm === receiverNorm) {
            return key
        }
    }
    return null
}

/**
 * Busca un trade pendiente donde el usuario es el sender
 */
function findTradeKeyForSender(chatId, senderNorm) {
    for (const [key, trade] of Object.entries(global.pendingTrades)) {
        if (trade.chatId === chatId && trade.senderNorm === senderNorm) {
            return key
        }
    }
    return null
}

handler.help = ['trade <personaje> @usuario <personaje>', 'tradeaccept', 'tradereject', 'tradecancel']
handler.tags = ['gacha']
handler.command = ['trade', 'intercambiar', 'tradeaccept', 'aceptartrade', 'tradereject', 'rechazartrade', 'tradecancel', 'cancelartrade']
handler.group = true

export default handler
