// Plugin de lectura de Manga desde lectortmo.vip
// Uso: #manga <nombre-manga> [cap-N] → busca capítulo y envía imágenes como álbum
// Uso: #manga <URL-lectortmo> → extrae imágenes del capítulo directamente
import axios from 'axios';

const BASE_URL = 'https://lectortmo.vip';

/** Headers de navegador real para evitar bloqueos básicos */
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://lectortmo.vip/',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
};

/**
 * Extrae las URLs de las imágenes del HTML de un capítulo de LectorTMO.
 * LectorTMO embebe las páginas en un inline <script> como:
 *   var slides_pags = ["url1","url2",...];
 * También se intenta con data-src en elementos img.
 */
function extractImagesFromHtml(html) {
    const images = [];

    // Método 1: variable JS inline slides_pags (patrón original de TMO)
    const slidesMatch = html.match(/(?:slides_pags|pags_chapter|chapter_pages|pages_images)\s*=\s*(\[[\s\S]*?\])/);
    if (slidesMatch) {
        try {
            const parsed = JSON.parse(slidesMatch[1]);
            if (Array.isArray(parsed) && parsed.length > 0) {
                images.push(...parsed.filter(u => typeof u === 'string' && u.startsWith('http')));
                if (images.length > 0) return images;
            }
        } catch {}
    }

    // Método 2: JSON dentro de window.__NUXT__ o __INITIAL_STATE__ o similar
    const nuxtMatch = html.match(/window\.__(?:NUXT|INITIAL_STATE|DATA)__\s*=\s*({[\s\S]*?});/);
    if (nuxtMatch) {
        try {
            const obj = JSON.parse(nuxtMatch[1]);
            const found = findImages(obj);
            if (found.length > 0) {
                images.push(...found);
                return images;
            }
        } catch {}
    }

    // Método 3: img tags con data-src o src que contengan imagen de capítulo
    const imgRegex = /<img[^>]+(?:data-src|src)\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
        const src = m[1];
        if (
            src.includes('lectortmo') ||
            src.includes('img.manga') ||
            src.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)
        ) {
            if (!src.includes('logo') && !src.includes('avatar') && !src.includes('icon') && !src.includes('banner')) {
                images.push(src);
            }
        }
    }

    // Método 4: buscar URLs en JSON inline genérico
    if (images.length === 0) {
        const urlRegex = /"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
        while ((m = urlRegex.exec(html)) !== null) {
            const url = m[1];
            if (!url.includes('logo') && !url.includes('avatar') && !url.includes('icon')) {
                images.push(url);
            }
        }
    }

    return [...new Set(images)]; // deduplicar
}

/** Busca recursivamente arrays de URLs de imagen en un objeto JSON */
function findImages(obj, depth = 0) {
    if (depth > 10) return [];
    const found = [];
    if (Array.isArray(obj)) {
        for (const item of obj) {
            if (typeof item === 'string' && item.match(/\.(jpg|jpeg|png|webp)/i)) {
                found.push(item);
            } else if (typeof item === 'object' && item) {
                found.push(...findImages(item, depth + 1));
            }
        }
    } else if (typeof obj === 'object' && obj) {
        for (const val of Object.values(obj)) {
            found.push(...findImages(val, depth + 1));
        }
    }
    return found;
}

/**
 * Construye la URL de LectorTMO para un capítulo dado.
 * Ejemplo: "kimetsu no yaiba cap 206" → https://lectortmo.vip/manga-chapter/kimetsu-no-yaiba-cap-206/
 */
function buildChapterUrl(input) {
    // Si ya es URL de lectortmo, devolverla tal cual
    if (input.includes('lectortmo.vip/manga-chapter/')) {
        return input.trim().endsWith('/') ? input.trim() : input.trim() + '/';
    }

    // Convertir texto a slug de URL
    const slug = input
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
        .replace(/[^a-z0-9\s-]/g, '')                    // solo alfanumérico
        .trim()
        .replace(/\s+/g, '-')                             // espacios a guiones
        .replace(/-+/g, '-');                             // guiones múltiples

    return `${BASE_URL}/manga-chapter/${slug}/`;
}

/**
 * Scrapea el capítulo y devuelve { title, images[], url }
 */
async function scrapeChapter(chapterUrl) {
    const response = await axios.get(chapterUrl, {
        headers: BROWSER_HEADERS,
        timeout: 20_000,
        maxRedirects: 5,
        decompress: true,
    });

    const html = response.data;

    // Extraer título de la página
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace('| LectorTmo', '').trim() : 'Capítulo';

    const images = extractImagesFromHtml(html);

    return { title, images, url: chapterUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
let handler = async (m, { command, usedPrefix, conn, text }) => {
    const prefix = usedPrefix + command;

    if (!text) {
        return m.reply(
            `📖 *Lector de Manga - LectorTMO*\n\n` +
            `Envía el nombre del capítulo o una URL directa:\n\n` +
            `▸ \`${prefix} kimetsu no yaiba cap 206\`\n` +
            `▸ \`${prefix} one piece cap 1100\`\n` +
            `▸ \`${prefix} https://lectortmo.vip/manga-chapter/kimetsu-no-yaiba-cap-206/\`\n\n` +
            `> 🌐 Fuente exclusiva: lectortmo.vip`
        );
    }

    await m.react('⏳');

    const chapterUrl = buildChapterUrl(text.trim());

    try {
        await conn.reply(m.chat, `🔍 Buscando capítulo en:\n> ${chapterUrl}`, m);

        const { title, images, url } = await scrapeChapter(chapterUrl);

        if (!images || images.length === 0) {
            await m.react('❌');
            return conn.reply(
                m.chat,
                `❌ *No se encontraron imágenes* en el capítulo.\n\n` +
                `> Puede que el sitio requiera JavaScript para cargar las páginas,\n` +
                `> o que el capítulo no exista en esa URL.\n\n` +
                `🔗 Verifica manualmente: ${url}`,
                m
            );
        }

        await conn.reply(
            m.chat,
            `📖 *${title}*\n` +
            `> 🖼️ ${images.length} página(s) encontradas\n` +
            `> 🌐 Fuente: lectortmo.vip\n\n` +
            `⏳ Enviando álbum de imágenes...`,
            m
        );

        // ── Enviar como álbum (mismo patrón que Pinterest) ──────────────────
        const albumMessage = await conn.sendMessage(m.chat, {
            album: {
                expectedImageCount: images.length,
                expectedVideoCount: 0
            }
        }, { quoted: m });

        let sent = 0;
        for (let i = 0; i < images.length; i++) {
            try {
                await conn.sendMessage(m.chat, {
                    image: { url: images[i] },
                    caption: `📖 *${title}*\n🖼️ Página ${i + 1}/${images.length}\n> 🌐 lectortmo.vip`,
                    albumParentKey: albumMessage.key
                });
                sent++;
                // Pequeña pausa para no saturar
                if (i < images.length - 1) await new Promise(r => setTimeout(r, 300));
            } catch (imgErr) {
                console.error(`[manga] Error enviando imagen ${i + 1}:`, imgErr.message);
            }
        }

        await m.react('✅');

        if (sent < images.length) {
            await conn.reply(
                m.chat,
                `⚠️ Se enviaron *${sent}/${images.length}* páginas.\n` +
                `> Algunas imágenes pueden no haber cargado correctamente.`,
                m
            );
        }

    } catch (error) {
        await m.react('❌');
        console.error('[manga] Error:', error.message);

        if (error.response?.status === 404) {
            return conn.reply(
                m.chat,
                `❌ *Capítulo no encontrado* (404)\n\n` +
                `> La URL generada fue:\n> ${chapterUrl}\n\n` +
                `💡 *Tip:* Verifica el nombre exacto del capítulo en lectortmo.vip\n` +
                `Ejemplo: \`${prefix} kimetsu no yaiba cap 206\``,
                m
            );
        }

        if (error.response?.status === 403 || error.response?.status === 429) {
            return conn.reply(
                m.chat,
                `🚫 *Acceso bloqueado por el sitio* (${error.response.status})\n\n` +
                `> LectorTMO puede tener protección anti-bots activa.\n` +
                `> Intenta de nuevo en unos minutos.`,
                m
            );
        }

        conn.reply(m.chat, `❌ Error al obtener el capítulo: ${error.message}`, m);
    }
};

handler.command = ['manga', 'mangalee', 'leer', 'tmo'];
handler.tags = ['download'];
handler.help = ['manga <nombre cap N> | <URL lectortmo>'];

export default handler;
