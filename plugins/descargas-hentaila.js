// Plugin de HentaiLA para buscar y descargar hentai
// Usa la misma lógica que TioAnime: búsqueda -> detalle -> descarga por Mega
import { download, detail, search } from "../lib/hentaila.js";
import { File } from "megajs";

const delay = ms => new Promise(r => setTimeout(r, ms));

/** Envía un mensaje de forma segura, sin crashear si la conexión se cerró */
async function safeSend(conn, chat, content, opts = {}) {
    try {
        return await conn.sendMessage(chat, content, opts);
    } catch (e) {
        console.error('[hentaila] safeSend falló:', e.message);
        return null;
    }
}

/** Envía imagen con caption; si falla, reintenta como texto plano */
async function sendWithCover(conn, chat, coverUrl, caption, quoted) {
    // Intentar descargar el cover
    let coverBuffer = null;
    try {
        const res = await fetch(coverUrl, {
            headers: { 'Referer': 'https://hentaila.com/', 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(10000) // 10s timeout
        });
        if (res.ok) coverBuffer = Buffer.from(await res.arrayBuffer());
    } catch (e) { /* sin cover */ }

    // Intentar enviar con imagen
    if (coverBuffer) {
        const sent = await safeSend(conn, chat, {
            image: coverBuffer,
            caption,
            mimetype: 'image/jpeg'
        }, { quoted });
        if (sent) return sent;
    }

    // Fallback: enviar solo texto
    return await safeSend(conn, chat, { text: caption }, { quoted });
}

let handler = async (m, { command, usedPrefix, conn, text, args }) => {
    if (!text) return m.reply(`\`Ingresa el título o la URL de HentaiLA. Ejemplo:\`\n\n • ${usedPrefix + command} Honey Blonde\n • ${usedPrefix + command} https://hentaila.com/media/honey-blonde-2`);

    try {
        // Si el texto es una URL de hentaila, mostrar detalles
        if (text.includes('hentaila.com/media/')) {
            m.react("⌛");

            // Extraer el slug de la URL (quitar número de episodio si existe)
            let slug = text.split('/media/')[1].split('/')[0];
            let info = await detail(slug);

            if (info.error) return m.reply('❌ Error al obtener los detalles: ' + info.error);

            let epsDisplay = info.episodes.slice(0, 40).map(e => `• Episodio ${e.ep}`).join('\n');
            let epsAbbrev = info.episodes.length > 40 ? `\n... y ${info.episodes.length - 40} episodios más.` : '';

            let cap = `
乂 \`\`\`HENTAILA - DOWNLOAD\`\`\`

「✦」 \`Título :\` ${info.title}
> ✰ \`Sinopsis :\` ${info.synopsis ? info.synopsis.substring(0, 250) + (info.synopsis.length > 250 ? '...' : '') : 'Sin sinopsis'}
> ☁︎ \`Géneros :\` ${info.genres.join(', ') || 'N/A'}
> ✿ \`Categoría :\` ${info.category}
> 📊 \`Estado :\` ${info.status}
> 🍿 \`Episodios :\` ${info.total}

${epsDisplay}${epsAbbrev}

> ⏳ Descargando todos los episodios automáticamente...
`.trim();

            // Enviar con imagen del cover (fallback a texto si falla)
            await sendWithCover(conn, m.chat, info.cover, cap, m);

            let sortedEpisodes = info.episodes.sort((a, b) => parseInt(a.ep) - parseInt(b.ep));
            for (const episode of sortedEpisodes) {
                try {
                    const inf = await download(episode.link);

                    if (inf.error) {
                        await safeSend(conn, m.chat, { text: `❌ Error: No se pudieron obtener los links de descarga para el episodio ${episode.ep}.\nDetalles: ${inf.error}` }, { quoted: m });
                        continue;
                    }

                    if (!inf.dl.mega) {
                        await safeSend(conn, m.chat, { text: `❌ No se encontró link de Mega para el episodio ${episode.ep}.` }, { quoted: m });
                        continue;
                    }

                    const megaUrl = inf.dl.mega;
                    const file = File.fromURL(megaUrl);
                    await file.loadAttributes();
                    const videoBuffer = await file.downloadBuffer();

                    if (!videoBuffer || videoBuffer.length < 1000) {
                        await safeSend(conn, m.chat, { text: `❌ El archivo descargado está vacío o corrupto para el episodio ${episode.ep}.` }, { quoted: m });
                        continue;
                    }

                    const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(1);
                    await conn.sendFile(m.chat, videoBuffer, `${info.title} - ep ${episode.ep}.mp4`, `✅ *${info.title} - Episodio ${episode.ep}*\n> 📦 Tamaño: ${sizeMB} MB\n> 🌐 Fuente: Mega`, m, false, {
                        mimetype: 'video/mp4',
                        asDocument: true
                    });

                    // Pequeña pausa entre episodios para no saturar la conexión
                    await delay(2000);
                } catch (err) {
                    console.error('[hentaila] Error al descargar ep:', episode.ep, err);
                    await safeSend(conn, m.chat, { text: `❌ Error al descargar el episodio ${episode.ep}: ${err.message}` }, { quoted: m });
                }
            }
            m.react("✅");
        } else {
            // Búsqueda por nombre
            m.react('🔍');
            const results = await search(text);
            if (results.length === 0) {
                return await safeSend(conn, m.chat, { text: '❌ No se encontraron resultados en HentaiLA.' }, { quoted: m });
            }

            let cap = `◢ HentaiLA - Search ◤\n`;
            const displayResults = results.slice(0, 15);
            displayResults.forEach((res, index) => {
                cap += `\n\`${index + 1}\`\n「✦」\`Title :\` ${res.title}\n> 🏷️ \`Categoría :\` ${res.category}\n> 🔗 \`Link :\` ${res.link}\n`;
            });

            // Enviar con imagen del primer resultado (fallback a texto si falla)
            await sendWithCover(conn, m.chat, displayResults[0].cover, cap, m);
            m.react("✅");
        }
    } catch (error) {
        console.error('Error en handler hentaila:', error);
        await safeSend(conn, m.chat, { text: '❌ Error al procesar la solicitud: ' + error.message }, { quoted: m });
    }
};

handler.command = ["hentaila", "hentailadl", "htla"];
handler.tags = ['download'];
handler.help = ["hentaila"];

export default handler;
