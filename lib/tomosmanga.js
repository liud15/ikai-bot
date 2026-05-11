/**
 * TomosManga Scraper - Librería para buscar y obtener detalles de manga desde tomosmanga.com
 * Funciona sin navegador (puro HTTP + Cheerio) - compatible con cualquier VPS
 * Extrae datos del WordPress estándar (entradas, búsqueda, botones de descarga)
 * Incluye resolución de links TeraBox via API para descarga directa
 */
import * as cheerio from 'cheerio';

const BASE_URL = 'https://tomosmanga.com';
const TERABOX_API = 'https://api.evogb.org/dl/terabox';
const TERABOX_KEY = 'liu-ofc';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-419,es;q=0.9',
    'Referer': BASE_URL + '/'
};

/**
 * Convierte una URL de share de TeraBox al formato que espera la API
 * Ejemplo: https://terabox.com/s/1YlEU73rBgvuX8HPXh3CMtw
 *       -> https://www.terabox.com/spanish/sharing/link?surl=YlEU73rBgvuX8HPXh3CMtw
 */
function convertTeraboxUrl(shareUrl) {
    const match = shareUrl.match(/terabox\.com\/s\/1?(.+)/);
    if (!match) return null;
    return `https://www.terabox.com/spanish/sharing/link?surl=${match[1]}`;
}

/**
 * Resuelve un link de TeraBox a links de descarga directa via API
 * @param {string} shareUrl - URL de share de TeraBox (ej: https://terabox.com/s/1XXX)
 * @returns {Promise<Object>} - {status, files: [{filename, size, dlink, path}]}
 */
async function resolveTerabox(shareUrl) {
    try {
        const convertedUrl = convertTeraboxUrl(shareUrl);
        if (!convertedUrl) return { status: false, error: 'URL de TeraBox no válida', files: [] };

        const apiUrl = `${TERABOX_API}?url=${encodeURIComponent(convertedUrl)}&key=${TERABOX_KEY}`;
        const res = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const json = await res.json();

        if (!json.status || !json.data || json.data.length === 0) {
            return { status: false, error: json.message || 'No se encontraron archivos', files: [] };
        }

        const files = json.data.map(file => ({
            filename: file.server_filename,
            size: file.size,
            bytes: parseInt(file.bytes) || 0,
            dlink: file.dlink,
            path: file.path
        }));

        return { status: true, files };
    } catch (err) {
        console.error('[tomosmanga] Error resolviendo TeraBox:', err.message);
        return { status: false, error: err.message, files: [] };
    }
}

/**
 * Busca manga por nombre en tomosmanga.com
 * @param {string} query - Término de búsqueda
 * @returns {Promise<Array>} - Lista de resultados [{title, link, cover, snippet}]
 */
async function search(query) {
    try {
        const res = await fetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`, { headers: HEADERS });
        const html = await res.text();
        const $ = cheerio.load(html);

        const results = [];

        $('article.type-post, article.post').each((i, el) => {
            const $el = $(el);

            // Título y link
            const titleEl = $el.find('h2.entry-title a');
            const title = titleEl.text().trim();
            const link = titleEl.attr('href') || '';

            // Thumbnail
            const img = $el.find('img.wp-post-image');
            let cover = img.attr('src') || '';
            // Intentar obtener la imagen grande en lugar del thumb
            const srcset = img.attr('srcset');
            if (srcset) {
                const parts = srcset.split(',').map(s => s.trim());
                const largest = parts[parts.length - 1];
                if (largest) cover = largest.split(' ')[0];
            }

            // Snippet/sinopsis
            const snippet = $el.find('.entry-content p, .entry-summary p').first().text().trim()
                .replace(/^SINOPSIS\s*/i, '')
                .substring(0, 300);

            if (title && link) {
                results.push({ title, link, cover, snippet });
            }
        });

        return results;
    } catch (err) {
        console.error('[tomosmanga] Error en búsqueda:', err.message);
        return [];
    }
}

/**
 * Obtiene los detalles de un manga (título, sinopsis, datos técnicos, links de descarga)
 * @param {string} url - URL de la página del manga
 * @returns {Promise<Object>} - Detalles del manga
 */
async function detail(url) {
    try {
        // Normalizar URL
        if (!url.startsWith('http')) {
            url = `${BASE_URL}/${url.replace(/^\//, '')}`;
        }

        const res = await fetch(url, { headers: HEADERS });
        const html = await res.text();
        const $ = cheerio.load(html);

        // Título
        const title = $('h1.entry-title').text().trim() || $('h1').first().text().trim();

        // Cover - intentar wp-post-image primero, luego og:image como fallback
        const coverImg = $('img.wp-post-image').first();
        let cover = coverImg.attr('src') || '';
        const srcset = coverImg.attr('srcset');
        if (srcset) {
            const parts = srcset.split(',').map(s => s.trim());
            const largest = parts[parts.length - 1];
            if (largest) cover = largest.split(' ')[0];
        }
        // Fallback: og:image meta tag
        if (!cover) {
            cover = $('meta[property="og:image"]').attr('content') || '';
        }

        // Contenido principal
        const content = $('div.entry-content');

        // Sinopsis - primer bloque de texto largo que no sea datos técnicos ni headers
        let synopsis = '';
        content.find('p').each((i, el) => {
            const text = $(el).text().trim();
            // Saltar párrafos de datos técnicos, headers de descarga, y botones
            if (text.includes('Idioma:') || text.includes('Formato:') || text.includes('Tamaño:')) return;
            if (text.includes('DESCARGAR POR') || text.includes('DATOS TÉCNICOS') || text.includes('SINOPSIS')) return;
            if ($(el).find('a.fasc-button').length > 0) return;
            if (text.length > 30 && !synopsis) {
                synopsis = text.replace(/^SINOPSIS\s*/i, '');
            }
        });

        // Datos técnicos
        let techData = { idioma: '', formato: '', size: '', estado: '', version: '' };
        content.find('p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Idioma:') || text.includes('Formato:')) {
                // Parsear datos técnicos
                const idiomaMatch = text.match(/Idioma:\s*([^|]+)/);
                const formatoMatch = text.match(/Formato:\s*([^|]+)/);
                const sizeMatch = text.match(/Tamaño:\s*([^|]+)/);
                const estadoMatch = text.match(/Estado:\s*([^|]+)/);
                const versionMatch = text.match(/Versión:\s*(.+)/);

                if (idiomaMatch) techData.idioma = idiomaMatch[1].trim();
                if (formatoMatch) techData.formato = formatoMatch[1].trim();
                if (sizeMatch) techData.size = sizeMatch[1].trim();
                if (estadoMatch) techData.estado = estadoMatch[1].trim();
                if (versionMatch) techData.version = versionMatch[1].trim();
            }
        });

        // Links de descarga - organizados por servidor
        const downloads = {};
        let currentServer = '';

        // Buscar headers de descarga y los botones que les siguen
        content.children().each((i, el) => {
            const tag = el.tagName?.toLowerCase();
            const $el = $(el);
            const text = $el.text().trim().toUpperCase();

            // Detectar header de servidor (h2, h3, o p con texto DESCARGAR POR)
            if ((tag === 'h2' || tag === 'h3' || tag === 'p') && text.includes('DESCARGAR POR')) {
                const serverMatch = text.match(/DESCARGAR POR\s+(.+)/);
                if (serverMatch) {
                    currentServer = serverMatch[1].trim();
                    downloads[currentServer] = [];
                }
            }

            // Detectar botones de descarga
            if (currentServer) {
                $el.find('a.fasc-button').each((j, btn) => {
                    const href = $(btn).attr('href');
                    const label = $(btn).text().trim();
                    if (href && label) {
                        downloads[currentServer].push({ label, url: href });
                    }
                });

                // También buscar links directos en párrafos (sin clase fasc-button)
                if (tag === 'p' && !$el.find('a.fasc-button').length) {
                    $el.find('a[href]').each((j, btn) => {
                        const href = $(btn).attr('href');
                        const label = $(btn).text().trim();
                        // Filtrar links que no son de navegación del sitio
                        if (href && label && !href.includes('tomosmanga.com') && !href.includes('#')) {
                            downloads[currentServer].push({ label, url: href });
                        }
                    });
                }
            }
        });

        // Si no encontramos downloads con el método anterior, buscar todos los fasc-button
        if (Object.keys(downloads).length === 0) {
            const allButtons = content.find('a.fasc-button');
            if (allButtons.length > 0) {
                downloads['LINKS'] = [];
                allButtons.each((i, btn) => {
                    const href = $(btn).attr('href');
                    const label = $(btn).text().trim();
                    if (href && label) {
                        downloads['LINKS'].push({ label, url: href });
                    }
                });
            }
        }

        // Extraer solo los links de TeraBox para descarga directa
        const teraboxLinks = [];
        for (const [server, links] of Object.entries(downloads)) {
            if (server.toUpperCase().includes('TERABOX')) {
                links.forEach(link => {
                    if (link.url.includes('terabox.com')) {
                        teraboxLinks.push(link);
                    }
                });
            }
        }

        // Categorías del post
        const categories = [];
        $('a[rel="category tag"]').each((i, el) => {
            categories.push($(el).text().trim());
        });

        return {
            title,
            synopsis,
            cover,
            techData,
            downloads,
            teraboxLinks,
            categories,
            url,
            totalLinks: Object.values(downloads).reduce((sum, arr) => sum + arr.length, 0)
        };
    } catch (err) {
        console.error('[tomosmanga] Error en detail:', err.message);
        return { error: err.message };
    }
}

export { search, detail, resolveTerabox, convertTeraboxUrl, BASE_URL };
