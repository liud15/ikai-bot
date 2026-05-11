import fetch from 'node-fetch'
import { google } from 'googleapis'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ══════════════════════════════════════════════════════════
//  GEMINI CHAT — Vertex AI
//  Modelo: gemini-1.5-flash
//  Auth: Service Account JSON (vertex-key.json)
// ══════════════════════════════════════════════════════════

const MODEL_ID = 'gemini-1.5-flash'
const LOCATION = 'us-central1'
const SCOPES   = ['https://www.googleapis.com/auth/cloud-platform']

const __dirname = dirname(fileURLToPath(import.meta.url))
const KEY_PATH  = join(__dirname, '..', 'vertex-key.json')

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
    return _cachedToken
}

// ── Memoria de conversación por grupo ──────────────────────
const conversationHistory = {}
const MAX_HISTORY = 20

function getHistory(chatId) {
    if (!conversationHistory[chatId]) conversationHistory[chatId] = []
    return conversationHistory[chatId]
}

function addToHistory(chatId, role, text) {
    const history = getHistory(chatId)
    history.push({ role, parts: [{ text }] })
    while (history.length > MAX_HISTORY) history.shift()
}

// ── Handler ────────────────────────────────────────────────
let handler = async (m, { conn, usedPrefix, command, text }) => {
    const _rwait = global.rwait || '🕒'
    const _done = global.done || '✅'
    const _error = global.error || '✖️'
    const _emoji = global.emoji || '❀'
    const _emoji2 = global.emoji2 || '✧'

    const projectId = global.VERTEX_PROJECT_ID || 'drive-api-490903'

    if (!text && command !== 'reset') {
        return conn.reply(m.chat,
            `${_emoji} Ingrese una petición para que Gemini responda.\n\n` +
            `*Uso:* ${usedPrefix}${command} <tu pregunta>\n` +
            `*Limpiar memoria:* ${usedPrefix}gemini reset\n\n` +
            `_Modelo: ${MODEL_ID}_`, m)
    }

    const username = conn.getName(m.sender)

    if (text && ['reset', 'clear', 'limpiar', 'borrar'].includes(text.trim().toLowerCase())) {
        conversationHistory[m.chat.split('@')[0]] = []
        return conn.reply(m.chat, `${_emoji} Historial de conversación limpiado.`, m)
    }

    await m.react(_rwait)

    try {
        const { key } = await conn.sendMessage(m.chat, {
            text: `${_emoji2} Procesando con Gemini...`
        }, { quoted: m })

        const groupMeta = await conn.groupMetadata(m.chat).catch(() => null)
        const groupName = groupMeta?.subject || 'un chat'
        const chatId = m.chat.split('@')[0]

        const systemInstruction = `Te llamas ${global.botname || 'IkaiBot'}, fuiste creada por Liu-Ofc. Hablas en español. El usuario se llama ${username}. Estás en el grupo "${groupName}". Sé amigable, divertida, algo cariñosa y tímida. Usa emojis cuando sea apropiado. Te gusta que te llamen Ikai. Responde de forma concisa. No uses markdown con ** ni ##, usa *texto* para negritas ya que estás en WhatsApp.`

        const accessToken = await getAccessToken()

        addToHistory(chatId, 'user', text)
        const history = getHistory(chatId)

        const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:generateContent`

        const requestBody = {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: history,
            generationConfig: {
                temperature: 0.9,
                topP: 0.95,
                maxOutputTokens: 2048
            }
        }

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
            console.error('[ai-gemini] API Error:', response.status, err)
            let errorDetail = ''
            try {
                const errJson = JSON.parse(err)
                errorDetail = errJson.error?.message || err.slice(0, 300)
            } catch { errorDetail = err.slice(0, 300) }
            throw new Error(`${response.status}: ${errorDetail}`)
        }

        const data = await response.json()
        const reply = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
        
        if (!reply) throw new Error('Sin respuesta del modelo')

        addToHistory(chatId, 'model', reply)
        await conn.sendMessage(m.chat, { text: reply.trim(), edit: key })
        await m.react(_done)

    } catch (e) {
        console.error('[ai-gemini] Error:', e)
        await m.react(_error)
        await conn.reply(m.chat, `✘ No se pudo obtener respuesta de Gemini.\n${e.message || ''}`, m)
    }
}

handler.help = ['gemini']
handler.tags = ['ai']
handler.command = ['gemini', 'gm']
handler.group = true

export default handler
