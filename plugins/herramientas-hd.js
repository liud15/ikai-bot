import axios from 'axios';
import fetch from 'node-fetch';
import crypto from 'crypto';
import FormData from 'form-data';
import { fileTypeFromBuffer } from 'file-type';

const UPSCALE_ENDPOINT = 'https://api.evogb.org/tools/upscale';
const API_KEY = 'liu-ofc';
const IMGBB_API_KEY = '61821b3046b1b570b2257434ad48d97c';

async function uploadToImgBB(buffer) {
    const base64 = buffer.toString('base64');
    const boundary = '----ImgBBMitaBot' + crypto.randomBytes(8).toString('hex');

    const part1 = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="key"\r\n\r\n` +
        `${IMGBB_API_KEY}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="image"\r\n\r\n` +
        `${base64}\r\n`,
        'utf-8'
    );
    const part2 = Buffer.from(`--${boundary}--\r\n`, 'utf-8');
    const body = Buffer.concat([part1, part2]);

    const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body,
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        },
    });

    const json = await response.json();
    if (!json.success) throw new Error(json.error?.message || 'Error al subir imagen a ImgBB');
    return json.data.url;
}

async function uploadToFreeimage(buffer) {
    const { ext, mime } = (await fileTypeFromBuffer(buffer)) || { ext: 'jpg', mime: 'image/jpeg' };
    const randomName = crypto.randomBytes(5).toString('hex') + '.' + ext;

    const form = new FormData();
    form.append('key', '6d207e02198a847aa98d0a2a901485a5');
    form.append('action', 'upload');
    form.append('format', 'json');
    form.append('source', buffer, { filename: randomName, contentType: mime });

    const response = await axios.post('https://freeimage.host/api/1/upload', form, {
        headers: { ...form.getHeaders() }
    });
    const d = response.data;
    if (d?.status_code === 200 && d?.image?.url) return d.image.url;
    throw new Error('Respuesta inválida de Freeimage.host');
}

async function handler(m, { conn, usedPrefix, command }) {
    try {
        const q = m.quoted ? m.quoted : m;
        const mime = (q.msg || q).mimetype || q.mediaType || '';

        if (!/^image\/(jpe?g|png)/.test(mime)) {
            return m.reply(`${emoji} Envía una imagen con *${usedPrefix + command}* o responde a una imagen ya enviada.`);
        }

        await m.react('⏳');
        conn.reply(m.chat, `🔍 Subiendo imagen y procesando HD, espera unos segundos...`, m);

        const imgBuffer = await q.download();

        // Subir imagen: ImgBB primero, freeimage.host como fallback
        let imageUrl;
        try {
            imageUrl = await uploadToImgBB(imgBuffer);
            console.log(`[hd] URL subida (ImgBB): ${imageUrl}`);
        } catch (uploadErr) {
            console.log(`[hd] ImgBB falló (${uploadErr.message}), usando freeimage.host...`);
            imageUrl = await uploadToFreeimage(imgBuffer);
            console.log(`[hd] URL subida (Freeimage): ${imageUrl}`);
        }

        // Llamar a la API de upscale de evogb
        const { data } = await axios.get(UPSCALE_ENDPOINT, {
            params: {
                method: 'url',
                url: imageUrl,
                key: API_KEY
            },
            responseType: 'arraybuffer',
            timeout: 60000
        });

        const resultBuffer = Buffer.from(data);

        await conn.sendMessage(m.chat, {
            image: resultBuffer,
            caption: `✅ ¡Imagen mejorada a HD con éxito!\n⪛✰ IKAIBOT - By LIU ✰⪜`,
            mimetype: 'image/jpeg'
        }, { quoted: m });

        await m.react('✅');

    } catch (e) {
        console.error('[hd] Error:', e.message);
        await m.react('❌');
        m.reply(`❌ Error al mejorar la imagen: ${e.message}`);
    }
}

handler.help = ['hd'];
handler.tags = ['ai'];
handler.command = ['upscale', 'hd', 'remini'];
handler.limit = true;

export default handler;
