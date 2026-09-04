import fetch from 'node-fetch'
import { toPTT } from '../../lib/converter.js'

let handler = async (m, { conn, usedPrefix, command, text }) => {
    const _rwait = global.rwait || '🕒'
    const _done = global.done || '✅'
    const _error = global.error || '✖️'
    const _emoji = global.emoji || '❀'

    if (!text) {
        return conn.reply(m.chat,
            `${_emoji} Escribe el texto que quieres convertir a voz.\n\n` +
            `*Uso básico:* ${usedPrefix}${command} <texto>\n` +
            `*Con idioma:* ${usedPrefix}${command} <idioma>:<texto>\n\n` +
            `*Ejemplos:*\n` +
            `🔸 ${usedPrefix}${command} Hola grupo, soy ${global.botname || 'IkaiBot'}\n` +
            `🔸 ${usedPrefix}${command} en:Good morning everyone\n` +
            `🔸 ${usedPrefix}${command} ja:おはようございます\n\n` +
            `_Idioma por defecto: español (es)_`, m)
    }

    await m.react(_rwait)

    try {
        let lang = 'es'
        let ttsText = text

        if (text.includes(':') && !text.startsWith('http')) {
            const colonIndex = text.indexOf(':')
            const possibleLang = text.substring(0, colonIndex).trim().toLowerCase()
            if (possibleLang.length >= 2 && possibleLang.length <= 5) {
                lang = possibleLang
                ttsText = text.substring(colonIndex + 1).trim()
            }
        }

        if (!ttsText) {
            return conn.reply(m.chat, `${_emoji} Debes escribir un texto después del idioma.`, m)
        }

        const { key } = await conn.sendMessage(m.chat, {
            text: `🎙️ Generando audio (${lang})...`
        }, { quoted: m })

        // La API de Google Translate tiene un límite de unos 200 caracteres por petición
        if (ttsText.length > 200) {
            ttsText = ttsText.substring(0, 200)
        }

        const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${lang}&q=${encodeURIComponent(ttsText)}`

        const response = await fetch(url)
        
        if (!response.ok) {
            throw new Error(`Error en la API: ${response.statusText}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = Buffer.from(arrayBuffer)
        
        // Convertir el MP3 a formato OPUS/OGG nativo para notas de voz de WhatsApp
        const pttAudio = await toPTT(audioBuffer, 'mp3')

        await conn.sendMessage(m.chat, {
            audio: pttAudio.data,
            mimetype: 'audio/ogg; codecs=opus',
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
