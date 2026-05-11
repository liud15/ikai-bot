import fetch from 'node-fetch';

let handler = async (m, { text, usedPrefix, command, conn }) => {
    if (!text) {
        return m.reply(
            `🖥️ *Screenshot de Web*\n\n` +
            `*Uso:*\n` +
            `${usedPrefix + command} <url>\n\n` +
            `*Ejemplos:*\n` +
            `${usedPrefix}ss google.com\n` +
            `${usedPrefix}screenshot https://github.com\n` +
            `${usedPrefix}captura wikipedia.org`
        );
    }

    let url = text.trim();

    // Agregar https:// si no tiene protocolo
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    // Validar que sea una URL válida
    try {
        new URL(url);
    } catch {
        return m.reply('❌ URL inválida. Proporciona una URL válida.\n\n*Ejemplo:* ' + usedPrefix + command + ' google.com');
    }

    await conn.sendMessage(m.chat, { react: { text: '📸', key: m.key } });
    await conn.reply(m.chat, `📸 Capturando screenshot de:\n*${url}*\n\n⏳ Espera unos segundos...`, m);

    try {
        let screenshotBuffer = null;

        // API 1: screenshot-api (alta calidad)
        try {
            screenshotBuffer = await captureWithApi1(url);
        } catch (e) {
            console.log('[screenshot] API 1 falló:', e.message);
        }

        // API 2: thum.io fallback
        if (!screenshotBuffer) {
            try {
                screenshotBuffer = await captureWithApi2(url);
            } catch (e) {
                console.log('[screenshot] API 2 falló:', e.message);
            }
        }

        // API 3: microlink fallback
        if (!screenshotBuffer) {
            try {
                screenshotBuffer = await captureWithApi3(url);
            } catch (e) {
                console.log('[screenshot] API 3 falló:', e.message);
            }
        }

        if (!screenshotBuffer) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply('❌ No se pudo capturar el screenshot. La URL puede ser inválida o el servicio no está disponible.');
        }

        await conn.sendMessage(m.chat, {
            image: screenshotBuffer,
            caption: `🖥️ *Screenshot capturado*\n🔗 ${url}\n\n⪛✰ IKAIBOT - Screenshot ✰⪜`,
            mimetype: 'image/png'
        }, { quoted: m });

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error('[screenshot] Error:', e.message);
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        m.reply('⚠️ Error al capturar el screenshot. Inténtalo más tarde.');
    }
};

async function captureWithApi1(url) {
    const apiUrl = `https://shot.screenshotapi.net/screenshot?url=${encodeURIComponent(url)}&full_page=false&fresh=true&output=image&file_type=png&wait_for_event=load`;

    const res = await fetch(apiUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 30000
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('image')) throw new Error('Not an image response');

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) throw new Error('Image too small');

    return buffer;
}

async function captureWithApi2(url) {
    const apiUrl = `https://image.thum.io/get/width/1280/crop/900/noanimate/${encodeURIComponent(url)}`;

    const res = await fetch(apiUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 30000
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) throw new Error('Image too small');

    return buffer;
}

async function captureWithApi3(url) {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;

    const res = await fetch(apiUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';

    // Si devuelve JSON, hay que extraer la URL de la imagen
    if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data?.status === 'success' && data?.data?.screenshot?.url) {
            const imgRes = await fetch(data.data.screenshot.url, { timeout: 15000 });
            if (!imgRes.ok) throw new Error('Failed to download screenshot');
            return Buffer.from(await imgRes.arrayBuffer());
        }
        throw new Error('No screenshot URL in response');
    }

    // Si devuelve imagen directamente
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) throw new Error('Image too small');
    return buffer;
}

handler.help = ['ss <url>', 'screenshot <url>', 'captura <url>'];
handler.tags = ['tools'];
handler.command = /^(ss|screenshot|captura|webshot)$/i;
handler.limit = true;

export default handler;
