
import axios from 'axios';
import FormData from 'form-data';
import { fileTypeFromBuffer } from 'file-type';

// ─────────────────────────────────────────────
//  PLUGIN: Quitar fondo – Photoroom scraping
//  Comandos: .photoroom / .quitarfondo / .nobg
// ─────────────────────────────────────────────

let handler = async (m, { conn, usedPrefix, command }) => {
    let q = m.quoted ? m.quoted : m;
    let mime = (q.msg || q).mimetype || '';

    if (!/^image\/(jpe?g|png|webp)/.test(mime)) {
        return m.reply(
            `🖼️ *Eliminador de fondo – Photoroom*\n\n` +
            `Envía o responde a una imagen con el comando:\n` +
            `*${usedPrefix + command}*\n\n` +
            `> Soporta JPEG, PNG y WebP.`
        );
    }

    if (mime === 'image/webp') {
        if (q.isAnimated) return m.reply('❌ Los stickers GIF no son compatibles.');
    }

    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
    await conn.reply(m.chat, '🎨 Procesando imagen con Photoroom AI... espera un momento.', m);

    let media = await q.download();

    // Intentar cada API en orden
    let result = null;
    let usedAPI = '';

    // ── API 1: Photoroom (web scraping sin key) ──
    try {
        result = await removeWithPhotoroom(media);
        if (result) usedAPI = 'Photoroom';
    } catch (e) {
        console.log('[photoroom] API 1 falló:', e.message);
    }

    // ── API 2: removebg.one (fallback) ──
    if (!result) {
        try {
            result = await removeWithRemoveBgOne(media);
            if (result) usedAPI = 'RemoveBG';
        } catch (e) {
            console.log('[photoroom] API 2 falló:', e.message);
        }
    }

    // ── API 3: Pixian.ai (fallback) ──
    if (!result) {
        try {
            result = await removeWithPixian(media);
            if (result) usedAPI = 'Pixian';
        } catch (e) {
            console.log('[photoroom] API 3 falló:', e.message);
        }
    }

    if (!result) {
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        return m.reply(
            '❌ No se pudo eliminar el fondo. Inténtalo más tarde.\n\n' +
            '> Tip: Asegúrate de que la imagen sea clara y con un sujeto bien definido.'
        );
    }

    await conn.sendMessage(m.chat, { react: { text: '✔️', key: m.key } });

    await conn.sendMessage(
        m.chat,
        {
            image: result,
            caption: `✨ *Fondo eliminado exitosamente!*\n> ⚙️ Procesado con ${usedAPI} AI\n> 🤍 ${global.packname || 'IKAIBOT'} - Photoroom 🤍`,
            mimetype: 'image/png'
        },
        { quoted: m }
    );
};

handler.help = ['photoroom', 'quitarfondo', 'nobg'];
handler.tags = ['tools'];
handler.command = ['photoroom', 'quitarfondo', 'nobg', 'removefondo'];
handler.limit = true;

export default handler;

// ─────────────────────────────────────────────
//  API 1 — Photoroom (scraping web)
//  Usa el mismo endpoint que utiliza la web
//  https://www.photoroom.com/es/tools/background-remover
// ─────────────────────────────────────────────
async function removeWithPhotoroom(buffer) {
    const { ext, mime } = (await fileTypeFromBuffer(buffer)) || { ext: 'jpg', mime: 'image/jpeg' };
    const filename = `image.${ext}`;

    const form = new FormData();
    form.append('image_file', buffer, { filename, contentType: mime });
    form.append('format', 'png');
    form.append('channels', 'rgba');
    form.append('bg_color', '');
    form.append('size', 'preview');

    const { data } = await axios.post(
        'https://sdk.photoroom.com/v1/segment',
        form,
        {
            headers: {
                ...form.getHeaders(),
                'x-api-key': 'sandbox_00000000000000000000000000000000',
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'origin': 'https://www.photoroom.com',
                'referer': 'https://www.photoroom.com/es/tools/background-remover',
                'accept-language': 'es-ES,es;q=0.9,en;q=0.8'
            },
            responseType: 'arraybuffer',
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 30000
        }
    );

    const buf = Buffer.from(data);
    if (buf.length < 1000) throw new Error('Respuesta demasiado pequeña');
    return buf;
}

// ─────────────────────────────────────────────
//  API 2 — removebg.one (sin key)
// ─────────────────────────────────────────────
async function removeWithRemoveBgOne(buffer) {
    const form = new FormData();
    form.append('file', buffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg'
    });

    const { data } = await axios.post(
        'https://removebg.one/api/predict/v2',
        form,
        {
            headers: {
                ...form.getHeaders(),
                'user-agent': 'Mozilla/5.0 (Linux; Android 10)',
                'accept': 'application/json, text/plain, */*',
                'origin': 'https://removebg.one',
                'referer': 'https://removebg.one/upload'
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 30000
        }
    );

    if (!data?.data?.cutoutUrl) throw new Error('Sin URL de resultado');

    // Descargar la imagen resultante
    const imgRes = await axios.get(data.data.cutoutUrl, {
        responseType: 'arraybuffer',
        timeout: 15000
    });

    const buf = Buffer.from(imgRes.data);
    if (buf.length < 1000) throw new Error('Imagen vacía');
    return buf;
}

// ─────────────────────────────────────────────
//  API 3 — Pixian.AI (demo gratuita)
//  100 imágenes gratis sin key en modo demo
// ─────────────────────────────────────────────
async function removeWithPixian(buffer) {
    const { ext, mime } = (await fileTypeFromBuffer(buffer)) || { ext: 'jpg', mime: 'image/jpeg' };

    const form = new FormData();
    form.append('image', buffer, {
        filename: `image.${ext}`,
        contentType: mime
    });
    form.append('output.background.color', 'transparent');

    const { data } = await axios.post(
        'https://pixian.ai/api/v2/remove-background',
        form,
        {
            auth: {
                username: 'demo',
                password: 'demo'
            },
            headers: {
                ...form.getHeaders(),
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            responseType: 'arraybuffer',
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 45000
        }
    );

    const buf = Buffer.from(data);
    if (buf.length < 1000) throw new Error('Imagen vacía de Pixian');
    return buf;
}
