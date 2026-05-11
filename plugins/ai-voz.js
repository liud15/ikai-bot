import fetch from 'node-fetch'
import { google } from 'googleapis'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ══════════════════════════════════════════════════════════
//  TEXT-TO-SPEECH — Google Cloud API
//  Auth: Service Account JSON (vertex-key.json)
// ══════════════════════════════════════════════════════════

const SCOPES = ['https://www.googleapis.com/auth/cloud-platform']
const __dirname = dirname(fileURLToPath(import.meta.url))
const KEY_PATH  = join(__dirname, '..', 'vertex-key.json')

// Voces de alta calidad mapeadas a nombres simples
const VOICES = {
    'aurora': { name: 'es-US-Neural2-A', gender: 'FEMALE', lang: 'es-US', desc: 'Latino (Femenina)' },
    'zephyr': { name: 'es-US-Neural2-B', gender: 'MALE', lang: 'es-US', desc: 'Latino (Masculina)' },
    'nova':   { name: 'es-ES-Neural2-C', gender: 'FEMALE', lang: 'es-ES', desc: 'España (Femenina)' },
    'orion':  { name: 'es-ES-Neural2-B', gender: 'MALE', lang: 'es-ES', desc: 'España (Masculina)' },
    'cove':   { name: 'es-US-Journey-F', gender: 'FEMALE', lang: 'es-US', desc: 'Latino Journey (Femenina)' },
    'apex':   { name: 'es-US-Journey-D', gender: 'MALE', lang: 'es-US', desc: 'Latino Journey (Masculina)' }
}

const DEFAULT_VOICE = 'cove'

// ── Manejo de Auth JWT ────────────────────────────────────
let _cachedToken = null
let _tokenExpiry = 0

async function getAccessToken() {
    if (!existsSync(KEY_PATH)) throw new Error('No se encontró vertex-key.json en la raíz.')
    if (_cachedToken && Date.now() < _tokenExpiry - 300000) return _cachedToken
    const keyData   = JSON.parse(readFileSync(KEY_PATH, 'utf8'))
    const jwtClient = new google.auth.JWT({ email: keyData.client_email, key: keyData.private_key, scopes: SCOPES })
    const tokenRes  = await jwtClient.authorize()
    if (!tokenRes.access_token) throw new Error('No se pudo obtener el access token')
    _cachedToken = tokenRes.access_token
    _tokenExpiry = tokenRes.expiry_date || (Date.now() + 3600000)
    console.log('[ai-voz] Nuevo token generado.')
    return _cachedToken
}

let handler = async (m, { conn, usedPrefix, command, text }) => {
    const _rwait = global.rwait || '🕒'
    const _done = global.done || '✅'
    const _error = global.error || '✖️'
    const _emoji = global.emoji || '❀'

    if (text && ['lista', 'voces', 'voices', 'list'].includes(text.trim().toLowerCase())) {
        let voiceList = `🎙️ *Voces disponibles TTS:*\n\n`
        for (const [key, vInfo] of Object.entries(VOICES)) {
            voiceList += `• *${key}* → ${vInfo.desc}\n`
        }
        voiceList += `\n*Uso con voz:* ${usedPrefix}${command} <voz>:<texto>\n`
        voiceList += `*Ejemplo:* ${usedPrefix}${command} aurora:Hola grupo\n`
        return conn.reply(m.chat, voiceList, m)
    }

    if (!text) {
        return conn.reply(m.chat,
            `${_emoji} Escribe el texto que quieres convertir a voz.\n\n` +
            `*Uso básico:* ${usedPrefix}${command} <texto>\n` +
            `*Con voz:* ${usedPrefix}${command} <voz>:<texto>\n` +
            `*Ver voces:* ${usedPrefix}${command} lista\n\n` +
            `*Ejemplos:*\n` +
            `• ${usedPrefix}${command} Hola grupo, soy IkaiBot\n` +
            `• ${usedPrefix}${command} aurora:Buenos días a todos\n` +
            `• ${usedPrefix}${command} apex:Bienvenidos al canal\n\n` +
            `_Voz por defecto: ${DEFAULT_VOICE}_`, m)
    }

    await m.react(_rwait)

    try {
        let voiceKey = DEFAULT_VOICE
        let ttsText = text

        if (text.includes(':') && !text.startsWith('http')) {
            const colonIndex = text.indexOf(':')
            const possibleVoice = text.substring(0, colonIndex).trim().toLowerCase()
            if (VOICES[possibleVoice]) {
                voiceKey = possibleVoice
                ttsText = text.substring(colonIndex + 1).trim()
            }
        }

        if (!ttsText) {
            return conn.reply(m.chat, `${_emoji} Debes escribir un texto después de la voz.`, m)
        }

        const selectedVoice = VOICES[voiceKey]

        const { key } = await conn.sendMessage(m.chat, {
            text: `🎙️ Generando audio (${voiceKey})...`
        }, { quoted: m })

        const accessToken = await getAccessToken()

        const requestBody = {
            input: { text: ttsText },
            voice: {
                languageCode: selectedVoice.lang,
                name: selectedVoice.name
            },
            audioConfig: {
                audioEncoding: "MP3"
            }
        }

        const url = 'https://texttospeech.googleapis.com/v1/text:synthesize'
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            const err = await response.text()
            console.error('[ai-voz] API Error:', response.status, err)
            let errorDetail = ''
            try {
                const errJson = JSON.parse(err)
                errorDetail = errJson.error?.message || err.slice(0, 300)
            } catch { errorDetail = err.slice(0, 300) }
            throw new Error(`${response.status}: ${errorDetail}`)
        }

        const data = await response.json()
        const b64Audio = data.audioContent
        
        if (!b64Audio) throw new Error('No se recibió el audio desde la API.')

        const audioBuffer = Buffer.from(b64Audio, 'base64')

        await conn.sendMessage(m.chat, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: true
        }, { quoted: m })

        await conn.sendMessage(m.chat, { delete: key })
        await m.react(_done)

    } catch (e) {
        console.error('[ai-voz] Error:', e.message)
        await m.react(_error)
        await conn.reply(m.chat, `✘ No se pudo generar el audio.\n${e.message || ''}`, m)
    }
}

handler.help = ['voz']
handler.tags = ['ai']
handler.command = ['voz', 'tts', 'hablar', 'decir']
handler.group = true

export default handler
