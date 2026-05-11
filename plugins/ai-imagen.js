import fetch from 'node-fetch'
import { google } from 'googleapis'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ══════════════════════════════════════════════════════════
//  GENERACIÓN DE IMÁGENES — Vertex AI (Imagen 3)
//  Modelo: imagen-3.0-generate-001
//  Auth: Service Account JSON (vertex-key.json)
// ══════════════════════════════════════════════════════════

const MODEL_ID = 'imagen-3.0-generate-001'
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
    console.log('[ai-imagen] Nuevo token generado.')
    return _cachedToken
}

let handler = async (m, { conn, usedPrefix, command, text }) => {
    const _rwait = global.rwait || '🕒'
    const _done = global.done || '✅'
    const _error = global.error || '✖️'
    const _emoji = global.emoji || '❀'

    const projectId = global.VERTEX_PROJECT_ID || 'drive-api-490903'

    if (!text) {
        return conn.reply(m.chat,
            `${_emoji} Describe la imagen que quieres generar.\n\n` +
            `*Uso:* ${usedPrefix}${command} <descripción>\n\n` +
            `*Ejemplos:*\n` +
            `• ${usedPrefix}${command} un gato samurái en estilo anime\n` +
            `• ${usedPrefix}${command} paisaje de montañas al atardecer estilo acuarela\n` +
            `• ${usedPrefix}${command} logo futurista para un bot de WhatsApp`, m)
    }

    await m.react(_rwait)

    try {
        const { key } = await conn.sendMessage(m.chat, {
            text: `🎨 Generando imagen con Imagen 3, esto puede tardar unos segundos...`
        }, { quoted: m })

        const accessToken = await getAccessToken()
        
        const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predict`

        const requestBody = {
            instances: [
                { prompt: text }
            ],
            parameters: {
                sampleCount: 1,
                aspectRatio: "1:1",
                outputOptions: {
                    mimeType: "image/jpeg"
                }
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
            console.error('[ai-imagen] API Error:', response.status, err)
            let errorDetail = ''
            try {
                const errJson = JSON.parse(err)
                errorDetail = errJson.error?.message || err.slice(0, 300)
            } catch { errorDetail = err.slice(0, 300) }
            throw new Error(`${response.status}: ${errorDetail}`)
        }

        const data = await response.json()
        const b64Image = data.predictions?.[0]?.bytesBase64Encoded
        
        if (!b64Image) {
            throw new Error('No se pudo generar la imagen. Intenta con otra descripción o idioma.')
        }

        const imgBuffer = Buffer.from(b64Image, 'base64')

        await conn.sendMessage(m.chat, {
            image: imgBuffer,
            caption: `🎨 *Imagen generada*\n\n_Prompt: ${text}_`
        }, { quoted: m })

        await conn.sendMessage(m.chat, { delete: key })
        await m.react(_done)

    } catch (e) {
        console.error('[ai-imagen] Error:', e.message)
        await m.react(_error)
        await conn.reply(m.chat, `✘ No se pudo generar la imagen.\n${e.message || 'Error desconocido'}`, m)
    }
}

handler.help = ['imagen']
handler.tags = ['ai']
handler.command = ['imagen', 'img', 'dibujar', 'imaginar']
handler.group = true

export default handler
