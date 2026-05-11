// Plugin de HentaiLA para buscar y descargar hentai
// Usa la misma lógica que TioAnime: búsqueda -> detalle -> descarga por Mega
import { download, detail, search } from "../lib/hentaila.js";
import { File } from "megajs";

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

            await conn.sendMessage(m.chat, {
                text: cap,
                contextInfo: {
                    externalAdReply: {
                        title: info.title,
                        body: 'HentaiLA - Descarga',
                        thumbnailUrl: info.cover,
                        sourceUrl: text,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: m });

            let sortedEpisodes = info.episodes.sort((a, b) => parseInt(a.ep) - parseInt(b.ep));
            for (const episode of sortedEpisodes) {
                try {
                    const inf = await download(episode.link);

                    if (inf.error) {
                        await conn.reply(m.chat, `❌ Error: No se pudieron obtener los links de descarga para el episodio ${episode.ep}.\nDetalles: ${inf.error}`, m);
                        continue;
                    }

                    if (!inf.dl.mega) {
                        await conn.reply(m.chat, `❌ No se encontró link de Mega para el episodio ${episode.ep}.`, m);
                        continue;
                    }

                    const megaUrl = inf.dl.mega;
                    const file = File.fromURL(megaUrl);
                    await file.loadAttributes();
                    const videoBuffer = await file.downloadBuffer();

                    if (!videoBuffer || videoBuffer.length < 1000) {
                        await conn.reply(m.chat, `❌ El archivo descargado está vacío o corrupto para el episodio ${episode.ep}.`, m);
                        continue;
                    }

                    const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(1);
                    await conn.sendFile(m.chat, videoBuffer, `${info.title} - ep ${episode.ep}.mp4`, `✅ *${info.title} - Episodio ${episode.ep}*\n> 📦 Tamaño: ${sizeMB} MB\n> 🌐 Fuente: Mega`, m, false, {
                        mimetype: 'video/mp4',
                        asDocument: true
                    });
                } catch (err) {
                    console.error('[hentaila] Error al descargar ep:', episode.ep, err);
                    await conn.reply(m.chat, `❌ Error al descargar el episodio ${episode.ep}: ${err.message}`, m);
                }
            }
            m.react("✅");
        } else {
            // Búsqueda por nombre
            m.react('🔍');
            const results = await search(text);
            if (results.length === 0) {
                return conn.reply(m.chat, '❌ No se encontraron resultados en HentaiLA.', m);
            }

            let cap = `◢ HentaiLA - Search ◤\n`;
            results.slice(0, 15).forEach((res, index) => {
                cap += `\n\`${index + 1}\`\n「✦」\`Title :\` ${res.title}\n> 🏷️ \`Categoría :\` ${res.category}\n> 🔗 \`Link :\` ${res.link}\n`;
            });

            await conn.sendMessage(m.chat, {
                text: cap,
                contextInfo: {
                    mentionedJid: [m.sender],
                    externalAdReply: {
                        title: 'Búsqueda HentaiLA',
                        body: 'Resultados',
                        thumbnailUrl: results[0].cover,
                        sourceUrl: results[0].link,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: m });
            m.react("✅");
        }
    } catch (error) {
        console.error('Error en handler hentaila:', error);
        conn.reply(m.chat, '❌ Error al procesar la solicitud: ' + error.message, m);
    }
};

handler.command = ["hentaila", "hentailadl", "htla"];
handler.tags = ['download'];
handler.help = ["hentaila"];

export default handler;
