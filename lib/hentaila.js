/**
 * HentaiLA Scraper - Librería para buscar, obtener detalles y descargar desde hentaila.com
 * Funciona sin navegador (puro HTTP) - compatible con cualquier VPS
 * Extrae datos del SSR de SvelteKit embebido en el HTML
 */

const BASE_URL = 'https://hentaila.com';
const CDN_URL = 'https://cdn.hentaila.com';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-419,es;q=0.9',
    'Referer': BASE_URL + '/'
};

/**
 * Extrae los datos de SvelteKit embebidos en el HTML de la página
 * HentaiLA usa SvelteKit con SSR, los datos vienen en el script de arranque
 */
function extractSvelteData(html) {
    // El patrón del data de SvelteKit: data: [null, {...}, {...}, ...],
    const match = html.match(/data:\s*(\[null[\s\S]*?\]),\s*\n?\s*form:/);
    if (!match) return null;

    let dataStr = match[1];

    // SvelteKit a veces usa IIFEs como (function(a){a.id=1;...return {...}})({}),
    // Necesitamos evaluar esto de forma segura
    try {
        // Reemplazar void 0 por null para JSON compatibility
        dataStr = dataStr.replace(/void 0/g, 'null');

        // Evaluar el array (contiene funciones IIFE que JSON.parse no puede manejar)
        const fn = new Function(`return ${dataStr}`);
        return fn();
    } catch (e) {
        // Fallback: intentar extraer solo la parte que necesitamos con regex
        console.error('[hentaila] Error parsing SvelteKit data:', e.message);
        return null;
    }
}

/**
 * Busca hentai por nombre en el catálogo
 * @param {string} query - Término de búsqueda
 * @returns {Promise<Array>} - Lista de resultados [{title, slug, synopsis, category}]
 */
async function search(query) {
    try {
        const res = await fetch(`${BASE_URL}/catalogo?search=${encodeURIComponent(query)}`, { headers: HEADERS });
        const html = await res.text();

        const svelteData = extractSvelteData(html);
        if (!svelteData) return [];

        // Los resultados están en el tercer elemento del array de datos (index 2)
        let results = null;
        for (const item of svelteData) {
            if (item && item.type === 'data' && item.data?.results) {
                results = item.data.results;
                break;
            }
        }

        if (!results) return [];

        return results.map(r => ({
            id: r.id,
            title: (r.title || '').trim(),
            slug: r.slug,
            synopsis: r.synopsis || '',
            category: r.category?.name || 'OVA',
            link: `${BASE_URL}/media/${r.slug}`,
            cover: `${CDN_URL}/covers/${r.id}.jpg`
        }));
    } catch (err) {
        console.error('[hentaila] Error en búsqueda:', err.message);
        return [];
    }
}

/**
 * Obtiene los detalles de un hentai (título, géneros, episodios)
 * @param {string} slugOrUrl - Slug del hentai o URL completa
 * @returns {Promise<Object>} - Detalles del hentai
 */
async function detail(slugOrUrl) {
    try {
        let slug = slugOrUrl;
        if (slugOrUrl.includes('hentaila.com/media/')) {
            // Extraer slug de la URL: /media/SLUG o /media/SLUG/N
            slug = slugOrUrl.split('/media/')[1].split('/')[0];
        }

        const res = await fetch(`${BASE_URL}/media/${slug}`, { headers: HEADERS });
        const html = await res.text();

        const svelteData = extractSvelteData(html);
        if (!svelteData) return { error: 'No se pudieron extraer los datos de la página' };

        // Buscar el objeto media en los datos
        let media = null;
        for (const item of svelteData) {
            if (item && item.type === 'data' && item.data?.media) {
                media = item.data.media;
                break;
            }
        }

        if (!media) return { error: 'No se encontraron detalles del hentai' };

        const genres = (media.genres || []).map(g => g.name);
        const episodes = (media.episodes || []).map(ep => ({
            id: ep.id,
            ep: String(ep.number),
            link: `${BASE_URL}/media/${slug}/${ep.number}`
        })).sort((a, b) => parseInt(a.ep) - parseInt(b.ep));

        return {
            title: (media.title || '').trim(),
            slug: media.slug || slug,
            synopsis: media.synopsis || '',
            genres,
            category: media.category?.name || 'OVA',
            status: media.status === 2 ? 'En emisión' : media.status === 1 ? 'Finalizado' : 'Desconocido',
            episodesCount: media.episodesCount || episodes.length,
            score: media.score || 0,
            cover: `${CDN_URL}/covers/${media.id}.jpg`,
            episodes,
            total: episodes.length
        };
    } catch (err) {
        return { error: err.message };
    }
}

/**
 * Obtiene los links de descarga de un episodio
 * @param {string} url - URL del episodio (ej: https://hentaila.com/media/honey-blonde-2/1)
 * @returns {Promise<Object>} - Links de descarga y embed
 */
async function download(url) {
    try {
        const res = await fetch(url, { headers: HEADERS });
        const html = await res.text();

        const svelteData = extractSvelteData(html);
        if (!svelteData) return { error: 'No se pudieron extraer los datos del episodio' };

        // Buscar el objeto con episode/embeds/downloads
        let episodeData = null;
        for (const item of svelteData) {
            if (item && item.type === 'data' && item.data?.episode) {
                episodeData = item.data;
                break;
            }
        }

        if (!episodeData) return { error: 'No se encontraron datos del episodio' };

        const episode = episodeData.episode;
        const downloads = episodeData.downloads || {};
        const embeds = episodeData.embeds || {};

        // Extraer links de descarga SUB (prioridad: Mega > MediaFire > otros)
        const dlSub = downloads.SUB || downloads.sub || [];
        const embedSub = embeds.SUB || embeds.sub || [];

        // Buscar link de Mega en descargas
        const megaDl = dlSub.find(d => d.server === 'Mega' || d.server?.toLowerCase() === 'mega');
        const mediafireDl = dlSub.find(d => d.server === 'MediaFire' || d.server?.toLowerCase() === 'mediafire');
        const mp4uploadDl = dlSub.find(d => d.server === 'MP4Upload' || d.server?.toLowerCase() === 'mp4upload');

        // Buscar link de Mega en embeds (formato embed -> convertir a descarga directa)
        const megaEmbed = embedSub.find(e => e.server === 'Mega' || e.server?.toLowerCase() === 'mega');

        // Construir URL de Mega para descarga directa
        let megaUrl = null;
        if (megaDl) {
            megaUrl = megaDl.url;
        } else if (megaEmbed) {
            megaUrl = megaEmbed.url;
        }

        // Normalizar URL de Mega para que megajs la acepte
        // Hentaila usa formatos con ! que megajs no entiende
        if (megaUrl) {
            megaUrl = megaUrl.replace(/\\\//g, '/'); // Limpiar barras escapadas
            // Formato: /embed/!ID!KEY o /file/!ID!KEY -> /file/ID#KEY
            if (megaUrl.includes('!')) {
                const parts = megaUrl.split('!').filter(Boolean);
                // parts[0] = "https://mega.nz/file/" o "https://mega.nz/embed/"
                // parts[1] = ID, parts[2] = KEY
                if (parts.length >= 3) {
                    megaUrl = `https://mega.nz/file/${parts[1]}#${parts[2]}`;
                }
            }
            // Si tiene /embed/ sin !, convertir a /file/
            if (megaUrl.includes('/embed/') && !megaUrl.includes('!')) {
                megaUrl = megaUrl.replace('/embed/', '/file/');
            }
        }

        return {
            title: `Episodio ${episode.number}`,
            episodeNumber: episode.number,
            episodeId: episode.id,
            // Link prioritario para descarga (Mega)
            dl: {
                mega: megaUrl,
                mediafire: mediafireDl?.url || null,
                mp4upload: mp4uploadDl?.url || null
            },
            // Todos los links de descarga
            allDownloads: dlSub,
            // Todos los embeds (para streaming)
            allEmbeds: embedSub,
            type: megaUrl ? 'mega' : (mediafireDl ? 'mediafire' : 'other')
        };
    } catch (err) {
        return { error: err.message };
    }
}

export { search, detail, download, BASE_URL, CDN_URL };
