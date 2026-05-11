import fetch from 'node-fetch';
import axios from 'axios';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import FormData from "form-data";

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

    const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: body,
        headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": body.length,
        },
    });

    const json = await response.json();
    if (!json.success) throw new Error(json.error?.message || 'Error al subir imagen a ImgBB');
    return json.data.url;
}

async function freeimage(content) {
    const { ext, mime } = (await fileTypeFromBuffer(content)) || { ext: 'bin', mime: 'application/octet-stream' };
    const randomName = crypto.randomBytes(5).toString("hex") + "." + ext;

    const form = new FormData();
    form.append('key', '6d207e02198a847aa98d0a2a901485a5');
    form.append('action', 'upload');
    form.append('format', 'json');
    form.append('source', content, { filename: randomName, contentType: mime });

    const response = await axios.post("https://freeimage.host/api/1/upload", form, {
        headers: {
            ...form.getHeaders()
        }
    });

    const responseData = response.data;
    console.log("[ia-toreal Fallback] Respuesta de Freeimage.host:", JSON.stringify(responseData));
    if (responseData && responseData.status_code === 200 && responseData.image && responseData.image.url) {
        return responseData.image.url;
    }
    throw new Error("Respuesta inválida de Freeimage.host");
}

async function uploadToEvogb(buffer, mimeType) {
    const ext = mimeType.split('/')[1] || 'jpg';
    const randomName = crypto.randomBytes(5).toString("hex") + "." + ext;
    
    const form = new FormData();
    // Asumimos 'file' como la llave del input principal. Se puede cambiar si la API de EvoGB requiere otra llave.
    form.append('file', buffer, { filename: randomName, contentType: mimeType });

    const response = await axios.post("https://api.evogb.org/api/cdn/upload", form, {
        headers: {
            ...form.getHeaders(),
            // Reemplazar 'TU_UPLOAD_TOKEN' por el token asignado en Dashboard o añadir global.evogbToken al config.
            'x-upload-token': global.evogbToken || 'TU_UPLOAD_TOKEN'
        }
    });

    const data = response.data;
    console.log("[ia-toreal Evogb CDN] Respuesta:", JSON.stringify(data));
    
    // Tratamos de obtener la URL en base a estructuras JSON comunes para responder APIs
    if (data && data.url) return data.url;
    if (data && data.data && data.data.url) return data.data.url;
    if (data && data.file && data.file.url) return data.file.url;
    if (data && data.link) return data.link;

    throw new Error("Respuesta de Evogb CDN sin identificar URL (quizá cambió formato): " + JSON.stringify(data));
}

let handler = async (m, { conn, usedPrefix, command }) => {
    const q = m.quoted ? m.quoted : m;
    const mime = (q.msg || q).mimetype || q.mediaType || '';

    if (!/image\/(jpe?g|png)/.test(mime)) {
        return conn.reply(m.chat, `Por favor, escríbeme *${usedPrefix + command}* respondiendo a la imagen que deseas convertir a estilo real.`, m);
    }

    await m.react('⏳');
    conn.reply(m.chat, `Enviando imagen, el proceso de conversión a realista suele tardar algunos minutos. Por favor espera pacientemente...`, m);

    try {
        const imgBuffer = await q.download();

        let url;
        try {
            console.log("Intentando subir a Evogb CDN...");
            url = await uploadToEvogb(imgBuffer, mime);
        } catch (evogbError) {
            console.log("Evogb CDN falló (¿posible error 401 por falta de token?), intentando con ImgBB...", evogbError.message);
            try {
                url = await uploadToImgBB(imgBuffer);
            } catch (imgbbError) {
                console.log("ImgBB falló, intentando con Freeimage.host...", imgbbError.message);
                url = await freeimage(imgBuffer);
            }
        }

        if (!url || !url.startsWith('http')) {
            throw new Error(`Error al subir la imagen en ambos servicios: ${url}`);
        }

        console.log(`[ia-toreal] URL subida con éxito: ${url}`);

        const apiEndpoint = `https://api.evogb.org/ai/toreal?method=url&url=${encodeURIComponent(url)}&key=liu-ofc`;

        // Hacemos el request manual usando Axios con un tiempo de espera muy largo (3 minutos)
        // para dar tiempo suficiente a la API a procesar e intentar evitar el error 504 de la red.
        const res = await axios.get(apiEndpoint, {
            responseType: 'arraybuffer',
            timeout: 180000 // 3 minutos máximo
        });

        // Convertir la respuesta a buffer compatible
        const finalImageBuffer = Buffer.from(res.data, 'utf-8');

        await conn.sendMessage(m.chat, {
            image: finalImageBuffer,
            caption: `✅ ¡Conversión a realista completada!\n⪛✰ IKAIBOT - By LIU ✰⪜`
        }, { quoted: m });

        await m.react('✅');
    } catch (error) {
        console.error("Error toReal:", error.message || error);
        if (error.response && error.response.data) {
            console.error("Detalles de EvoGB:", error.response.data.toString('utf-8'));
        }
        m.reply("Ocurrió un error (Timeout/Fallo de API) al convertir la imagen. Esto pasa si el modelo IA se satura, intenta de nuevo más tarde.");
    }
};

handler.help = ['toreal'];
handler.tags = ['ai'];
handler.command = ['toreal', 'real', 'realista'];

export default handler;
