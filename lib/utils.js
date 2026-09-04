import { fileTypeFromBuffer } from 'file-type'
import { jidDecode } from '@whiskeysockets/baileys'

/**
 * Decode a JID removing the device suffix (e.g., :0, :1)
 * Extracted from String.prototype.decodeJid
 * @param {string} jid
 * @returns {string}
 */
export function decodeJid(jid) {
    const raw = String(jid || '').trim()
    if (!raw) return ''
    
    // Si contiene un ID de dispositivo (ej: 123456:1 o 123456:1@s.whatsapp.net)
    if (/:\d+/.test(raw)) {
        const decoded = jidDecode(raw) || {}
        if (decoded.user) {
            return `${decoded.user}@${decoded.server || 's.whatsapp.net'}`
        }
    }
    
    // Si no tiene dominio pero es numérico, agregar el default
    if (/^\d+$/.test(raw)) {
        return `${raw}@s.whatsapp.net`
    }
    
    return raw
}

/**
 * Convert milliseconds to human-readable time string
 * Extracted from Number.prototype.toTimeString
 * @param {number} ms
 * @returns {string}
 */
export function toTimeString(ms) {
    const num = Number(ms) || 0
    const seconds = Math.floor((num / 1000) % 60)
    const minutes = Math.floor((num / (60 * 1000)) % 60)
    const hours = Math.floor((num / (60 * 60 * 1000)) % 24)
    const days = Math.floor(num / (24 * 60 * 60 * 1000))
    return (
        (days ? `${days} day(s) ` : '') +
        (hours ? `${hours} hour(s) ` : '') +
        (minutes ? `${minutes} minute(s) ` : '') +
        (seconds ? `${seconds} second(s)` : '')
    ).trim()
}

/**
 * Capitalize first letter
 * Extracted from String.prototype.capitalize
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
    const s = String(str || '')
    return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Capitalize first letter of each word
 * Extracted from String.prototype.capitalizeV2
 * @param {string} str
 * @returns {string}
 */
export function capitalizeV2(str) {
    return String(str || '').split(' ').map(v => capitalize(v)).join(' ')
}

/**
 * Check if value is a valid number
 * Extracted from String/Number.prototype.isNumber
 * @param {*} val
 * @returns {boolean}
 */
export function isNumber(val) {
    const int = parseInt(val)
    return typeof int === 'number' && !isNaN(int)
}

/**
 * Get random element from array/string, or random int from number
 * Extracted from Array/String/Number.prototype.getRandom
 * @param {Array|string|number} val
 * @returns {*}
 */
export function getRandom(val) {
    if (Array.isArray(val) || typeof val === 'string') {
        return val[Math.floor(Math.random() * val.length)]
    }
    return Math.floor(Math.random() * Number(val))
}

/**
 * Convert Buffer to ArrayBuffer
 * Extracted from Buffer.prototype.toArrayBuffer
 * @param {Buffer} buf
 * @returns {ArrayBuffer}
 */
export function toArrayBuffer(buf) {
    const ab = new ArrayBuffer(buf.length)
    const view = new Uint8Array(ab)
    for (let i = 0; i < buf.length; ++i) {
        view[i] = buf[i]
    }
    return ab
}

/**
 * Convert Buffer to ArrayBuffer (zero-copy when possible)
 * Extracted from Buffer.prototype.toArrayBufferV2
 * @param {Buffer} buf
 * @returns {ArrayBuffer}
 */
export function toArrayBufferV2(buf) {
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

/**
 * Convert ArrayBuffer to Buffer
 * Extracted from ArrayBuffer.prototype.toBuffer
 * @param {ArrayBuffer} ab
 * @returns {Buffer}
 */
export function arrayBufferToBuffer(ab) {
    return Buffer.from(new Uint8Array(ab))
}

/**
 * Detect file type from buffer
 * Extracted from Buffer/Uint8Array/ArrayBuffer.prototype.getFileType
 * @param {Buffer|Uint8Array|ArrayBuffer} data
 * @returns {Promise<{ext: string, mime: string}|undefined>}
 */
export async function getFileType(data) {
    return await fileTypeFromBuffer(data)
}

/**
 * Resolve a LID (@lid) to a real phone JID (@s.whatsapp.net)
 * Uses global.db.data.lidmap and signalRepository as primary sources.
 * Extracted from String.prototype.resolveLidToRealJid — O(n) onWhatsApp removed.
 * @param {string} inputJid - The JID to resolve
 * @param {string} groupChatId - The group chat JID (for context)
 * @param {object} conn - The Baileys socket connection
 * @returns {Promise<string>}
 */
export async function resolveLidToRealJid(inputJid, groupChatId, conn) {
    const jid = String(inputJid || '')
    if (!jid.endsWith('@lid')) {
        return jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
    }

    const lidKey = jid.split('@')[0]

    // 1. Check global lidmap (synced by store.js via messaging-history.set and lid-mapping.update)
    try {
        const mapped = global.db?.data?.lidmap?.[lidKey] || global.db?.data?.lidmap?.[jid]
        if (mapped) {
            const result = String(mapped)
            return result.includes('@') ? result : `${result}@s.whatsapp.net`
        }
    } catch {}

    // 2. Try signalRepository.lidMapping (Baileys v7 native)
    try {
        const pn = await conn?.signalRepository?.lidMapping?.getPNForLID?.(jid)
        if (pn) {
            const result = String(pn)
            return result.includes('@') ? result : `${result}@s.whatsapp.net`
        }
    } catch {}

    // 3. Fallback: return original LID (no O(n) onWhatsApp iteration)
    return jid
}

/**
 * @deprecated Use ?? operator instead
 */
export function nullish(args) {
    return !(args !== null && args !== undefined)
}
