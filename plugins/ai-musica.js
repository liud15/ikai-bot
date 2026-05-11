import { google } from 'googleapis'
import fetch from 'node-fetch'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import ffmpeg from 'fluent-ffmpeg'
import { Readable, PassThrough } from 'stream'

// ══════════════════════════════════════════════════════════
//  GENERACIÓN DE MÚSICA — Vertex AI
//  Lyria 2  → /v1/.../lyria-002:predict      (WAV, estable)
//  Lyria 3  → VertexAI SDK / generateContent (MP3, preview)
//  Auth: Service Account JSON (vertex-key.json)
// ══════════════════════════════════════════════════════════

const LOCATION    = 'us-central1'
const REGION_HOST = `https://${LOCATION}-aiplatform.googleapis.com`
const SCOPES      = ['https://www.googleapis.com/auth/cloud-platform']

const __dirname = dirname(fileURLToPath(import.meta.url))
const KEY_PATH  = join(__dirname, '..', 'vertex-key.json')

// Modelos
const LYRIA2  = { id: 'lyria-002', label: 'Lyria 2',    type: 'predict' }
const LYRIA3C = { id: 'lyria-3-clip', label: 'Lyria 3 Clip', type: 'genai' }
const LYRIA3P = { id: 'lyria-3-pro',  label: 'Lyria 3 Pro',  type: 'genai' }

// ── WAV → MP3 (solo para Lyria 2) ─────────────────────────
function wavToMp3(wavBuffer) {
    return new Promise((resolve, reject) => {
        const chunks = []
        const input  = new Readable()
        input.push(wavBuffer)
        input.push(null)
        const output = new PassThrough()
        output.on('data', c => chunks.push(c))
        output.on('end', () => resolve(Buffer.concat(chunks)))
        output.on('error', reject)
        ffmpeg(input)
            .inputFormat('wav')
            .audioCodec('libmp3lame')
            .audioBitrate('192k')
            .format('mp3')
            .on('error', reject)
            .pipe(output)
    })
}

// ── Auth JWT para Lyria 2 (predict) ───────────────────────
let _cachedToken = null
let _tokenExpiry = 0

async function getAccessToken() {
    if (!existsSync(KEY_PATH)) throw new Error('No se encontró vertex-key.json en la raíz del bot.')
    if (_cachedToken && Date.now() < _tokenExpiry - 300000) return _cachedToken
    const keyData   = JSON.parse(readFileSync(KEY_PATH, 'utf8'))
    const jwtClient = new google.auth.JWT({ email: keyData.client_email, key: keyData.private_key, scopes: SCOPES })
    const tokenRes  = await jwtClient.authorize()
    if (!tokenRes.access_token) throw new Error('No se pudo obtener el access token')
    _cachedToken = tokenRes.access_token
    _tokenExpiry = tokenRes.expiry_date || (Date.now() + 3600000)
    console.log('[ai-musica] Token OAuth2 ✅')
    return _cachedToken
}

// ── Lyria 2: predict endpoint ──────────────────────────────
async function generarLyria2(text, projectId) {
    const accessToken = await getAccessToken()
    const url = `${REGION_HOST}/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${LYRIA2.id}:predict`
    console.log('[ai-musica] [Lyria 2] →', url)
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ instances: [{ prompt: text }], parameters: { sample_count: 1 } })
    })
    if (!res.ok) {
        const err = await res.text()
        let msg = err
        try { msg = JSON.parse(err).error?.message || err } catch {}
        if (res.status === 429) throw new Error('⏳ Límite de uso alcanzado. Intenta en un minuto.')
        throw new Error(`${res.status}: ${msg}`)
    }
    const data = await res.json()
    const pred = data.predictions?.[0]
    const b64  = pred?.bytesBase64Encoded || pred?.audio || pred?.encodedAudio
    if (!b64) throw new Error('No se recibió audio de Lyria 2.')
    const wav = Buffer.from(b64, 'base64')
    console.log('[ai-musica] [Lyria 2] Convirtiendo WAV → MP3...')
    return await wavToMp3(wav)
}

// ── Lyria 3: Gemini Developer API (REST) ────────────────
const GEMINI_API_KEY = 'AQ.Ab8RN6Kkcfde4-HzwaZyBXWSJcrq5896kpoESS9fQbhRx019tA'

async function generarLyria3(text, projectId, modelId) {
    // Usamos la API Key proporcionada para conectarnos directo a los modelos de Google AI Studio
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}-preview:generateContent?key=${GEMINI_API_KEY}`
    console.log(`[ai-musica] [${modelId}] Generando con Gemini API...`)

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }] })
    })

    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Error de API Gemini (${res.status}): ${errText}`)
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts || []
    
    // Buscar la parte que contiene el audio
    const audioPart = parts.find(p => p.inlineData && p.inlineData.mimeType.startsWith('audio/'))
    
    if (!audioPart) {
        console.error('[ai-musica] Respuesta sin audio:', JSON.stringify(data).slice(0, 400))
        throw new Error('El modelo respondió correctamente pero no generó ningún audio. (Quizás el prompt fue bloqueado)')
    }

    return Buffer.from(audioPart.inlineData.data, 'base64')
}

// ── Handler principal ──────────────────────────────────────
let handler = async (m, { conn, usedPrefix, command, text }) => {
    const _rwait = global.rwait || '🕒'
    const _done  = global.done  || '✅'
    const _error = global.error || '✖️'
    const _emoji = global.emoji || '❀'

    const projectId = global.VERTEX_PROJECT_ID || 'drive-api-490903'

    // Seleccionar modelo según comando
    const isLyria3Pro  = ['musicapro', 'musicpro', 'cancion', 'song', 'lyria3pro'].includes(command)
    const isLyria3Clip = ['lyria3', 'musica3', 'lyria3clip'].includes(command)
    const model = isLyria3Pro ? LYRIA3P : isLyria3Clip ? LYRIA3C : LYRIA2

    if (!text) {
        return conn.reply(m.chat,
            `${_emoji} Describe the music you want to generate *(in English)*.\n\n` +
            `*Usage:* ${usedPrefix}${command} <description>\n\n` +
            `*Examples:*\n` +
            `• ${usedPrefix}${command} electronic cumbia with futuristic synth\n` +
            `• ${usedPrefix}${command} epic rock guitar with fast tempo\n` +
            `• ${usedPrefix}${command} lofi chill hop for studying with soft piano\n` +
            `• ${usedPrefix}${command} reggaeton with aggressive bass\n\n` +
            `*Commands:*\n` +
            `• *${usedPrefix}musica* → Lyria 2 (stable, 30s)\n` +
            `• *${usedPrefix}lyria3* → Lyria 3 Clip (preview, 30s)\n` +
            `• *${usedPrefix}musicapro* → Lyria 3 Pro (preview, up to 3 min)\n\n` +
            `_⚠️ Lyria only supports English prompts_`, m)
    }

    await m.react(_rwait)

    try {
        const { key } = await conn.sendMessage(m.chat, {
            text: `🎵 Generando música con *${model.label}*, esto puede tardar hasta ${model === LYRIA3P ? '2 minutos' : '30 segundos'}...`
        }, { quoted: m })

        let mp3Buffer

        if (model.type === 'predict') {
            mp3Buffer = await generarLyria2(text, projectId)
        } else {
            mp3Buffer = await generarLyria3(text, projectId, model.id)
        }

        console.log(`[ai-musica] Audio listo (${(mp3Buffer.length / 1024).toFixed(0)} KB)`)

        await conn.sendMessage(m.chat, {
            audio:    mp3Buffer,
            mimetype: 'audio/mpeg',
            ptt:      false,
            fileName: `ikai_music_${Date.now()}.mp3`
        }, { quoted: m })

        await conn.sendMessage(m.chat, { delete: key })
        await m.react(_done)

    } catch (e) {
        console.error('[ai-musica] Error:', e.message)
        await m.react(_error)
        await conn.reply(m.chat, `✘ No se pudo generar la música.\n${e.message || 'Error desconocido'}`, m)
    }
}

handler.help    = ['musica', 'lyria3', 'musicapro']
handler.tags    = ['ai']
handler.command = ['musica', 'music', 'lyria', 'lyria2', 'lyria3', 'musica3', 'lyria3clip', 'lyria3pro', 'musicapro', 'musicpro', 'cancion', 'song']
handler.group   = true

export default handler
