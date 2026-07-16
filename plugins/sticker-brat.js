import fetch from 'node-fetch'
import { sticker, addExif } from '../lib/sticker.js'

// ╔══════════════════════════════════════════════╗
// ║         BRAT — EVOGB API                    ║
// ║  Texto → GIF animado → Sticker WebP         ║
// ╚══════════════════════════════════════════════╝

const BRAT_API_URL = 'https://api.evogb.org/tools/brat'
const EVOGB_API_KEY = 'sasuke'

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const texto = args.join(' ').trim()

    if (!texto) {
        return m.reply(
            `╭──────────────────────────╮\n` +
            `│   🤍  *BRAT STICKER*        │\n` +
            `╰──────────────────────────╯\n\n` +
            `❌ Debes escribir un texto.\n\n` +
            `📌 *Uso:* ${usedPrefix + command} <texto>\n` +
            `📌 *Ejemplo:* ${usedPrefix + command} quedé mínimo común múltiplo`
        )
    }

    if (texto.length > 150) {
        return m.reply(`❌ El texto es muy largo. Máximo *150 caracteres* (tienes ${texto.length}).`)
    }

    await conn.sendMessage(m.chat, { react: { text: '🤍', key: m.key } })

    try {
        // 1️⃣ Obtener GIF animado de la API
        const url = `${BRAT_API_URL}?text=${encodeURIComponent(texto)}&animated=true&key=${EVOGB_API_KEY}`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'IkaiBot/2.0' },
            timeout: 30000
        })

        if (!res.ok) throw new Error(`API respondió con status ${res.status}`)

        const gifBuffer = Buffer.from(await res.buffer())
        if (gifBuffer.length < 500) throw new Error('Respuesta inválida de la API')

        // 2️⃣ Convertir GIF → WebP animado (sticker)
        const packname  = global.packsticker  || 'IkaiBot'
        const authorname = global.packsticker2 || 'By LIU'

        let stickerBuf = await sticker(gifBuffer, false, packname, authorname)

        // 3️⃣ Enviar como sticker
        await conn.sendFile(m.chat, stickerBuf, 'brat.webp', '', m)
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

    } catch (e) {
        console.error('[brat] Error:', e.message)
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        m.reply(`❌ *Error al generar el sticker brat:*\n_${e.message}_`)
    }
}

handler.help = ['brat <texto>']
handler.tags = ['sticker']
handler.command = ['brat']
handler.limit = true

export default handler
