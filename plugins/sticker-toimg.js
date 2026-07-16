import fs from 'fs'
import fluent_ffmpeg from 'fluent-ffmpeg'
import { fileTypeFromBuffer } from 'file-type'
import { tmpPath } from '../lib/tmp.js'

// Convierte webp (estático o animado) → PNG usando ffmpeg local
// Sin depender de ezgif.com ni servicios externos
function webpToPng(buffer) {
    return new Promise(async (resolve, reject) => {
        const id  = `toimg_${Date.now()}`
        const tmp = tmpPath(`${id}.webp`)
        const out = tmpPath(`${id}.png`)

        await fs.promises.writeFile(tmp, buffer)

        fluent_ffmpeg(tmp)
            .outputOptions(['-vframes', '1'])   // solo el primer frame
            .on('error', async (err) => {
                await fs.promises.unlink(tmp).catch(() => {})
                reject(err)
            })
            .on('end', async () => {
                await fs.promises.unlink(tmp).catch(() => {})
                try {
                    const result = await fs.promises.readFile(out)
                    await fs.promises.unlink(out).catch(() => {})
                    resolve(result)
                } catch (e) {
                    reject(e)
                }
            })
            .save(out)
    })
}

let handler = async (m, { conn, usedPrefix, command }) => {
    const q    = m.quoted || m
    const mime = q.mediaType || ''

    if (!/sticker/.test(mime)) {
        return m.reply(`🖼️ Responde a un *sticker* con el comando: *${usedPrefix + command}*`)
    }

    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

    try {
        const media  = await q.download()
        const imgBuf = await webpToPng(media)

        if (!imgBuf || imgBuf.length < 100) {
            throw new Error('No se pudo convertir el sticker')
        }

        await conn.sendMessage(m.chat, {
            image: imgBuf,
            mimetype: 'image/png',
            caption: ''
        }, { quoted: m })

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

    } catch (e) {
        console.error('[toimg] Error:', e.message)
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        m.reply(`❌ *No se pudo convertir el sticker:*\n_${e.message}_`)
    }
}

handler.help = ['toimg (reply a sticker)']
handler.tags = ['sticker']
handler.command = ['toimg', 'img', 'jpg']

export default handler
