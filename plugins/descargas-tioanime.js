// Código creado para descargas de TioAnime de forma independiente
import { download, detail, search } from "../lib/tioanime.js";
import { File } from "megajs";

let handler = async (m, { command, usedPrefix, conn, text, args }) => {
    if (!text) return m.reply(`\`Ingresa el título de algún anime o la URL de TioAnime. Ejemplo:\`\n\n • ${usedPrefix + command} Mushoku Tensei\n • ${usedPrefix + command} https://tioanime.com/anime/mushoku-tensei`);

    try {
        if (text.includes('tioanime.com/anime/')) {
            m.react("⌛");
            let info = await detail(args[0]);
            let { title, description, cover, total, episodes } = info;
            
            if (info.error) return m.reply('Error al obtener los detalles del anime: ' + info.error);

            // Mostrar solo los últimos 40 para no saturar el mensaje, revirtiendo para mostrar los primeros
            let epsDisplay = episodes.slice(0, 40).map(e => `• Episodio ${e.ep}`).join('\n');
            let epsAbbrev = episodes.length > 40 ? `\n... y ${episodes.length - 40} episodios más.` : '';

            let cap = `
乂 \`\`\`TIOANIME - DOWNLOAD\`\`\`

「✦」 \`Título :\` ${title}
> ✰ \`Descripción :\` ${description ? description.substring(0, 250) + '...' : 'Sin descripción'}
> ☁︎ \`Episodios totales :\` ${total}
> ✿ \`Episodios disponibles :\`

${epsDisplay}${epsAbbrev}

> Responde a este mensaje citándolo con el número del episodio que quieres descargar. Ejemplo: 1
`.trim();

            let buffer = await (await fetch(cover)).arrayBuffer();
            let sent = await conn.sendMessage(m.chat, { image: Buffer.from(buffer), caption: cap }, m)

            conn.tioanime = conn.tioanime || {};
            conn.tioanime[m.sender] = {
                title,
                episodes,
                key: sent.key,
                downloading: false,
                timeout: setTimeout(() => delete conn.tioanime[m.sender], 600_000)
            };
        } else {
            m.react('🔍');
            const results = await search(text);
            if (results.length === 0) {
                return conn.reply(m.chat, 'No se encontraron resultados en tioanime.', m);
            }

            let cap = `◢TioAnime - Search◤\n`;
            results.slice(0, 15).forEach((res, index) => {
                cap += `\n\`${index + 1}\`\n「✦」\`Title :\` ${res.title}\n> 🜸 \`Link :\` ${res.link}\n`;
            });

            let buffer = await (await fetch(results[0].img)).arrayBuffer();
            conn.relayMessage(m.chat, {
                extendedTextMessage: {
                    text: cap,
                    contextInfo: {
                        externalAdReply: {
                            title: 'Búsqueda TioAnime',
                            mediaType: 1,
                            previewType: 0,
                            renderLargerThumbnail: true,
                            thumbnail: Buffer.from(buffer),
                            sourceUrl: ''
                        }
                    }, mentions: [m.sender]
                }
            }, {});
            m.react("✅");
        }
    } catch (error) {
        console.error('Error en handler tioanime:', error);
        conn.reply(m.chat, 'Error al procesar la solicitud: ' + error.message, m);
    }
};

handler.before = async (m, { conn }) => {
    conn.tioanime = conn.tioanime || {};
    const session = conn.tioanime[m.sender];
    if (!session || !m.quoted || m.quoted.id !== session.key.id) return;

    if (session.downloading) return m.reply('⏳ Ya estás descargando un episodio. Espera a que termine.');

    let epStr = m.text.trim().split(/\s+/)[0];
    const epi = parseInt(epStr);

    if (isNaN(epi)) return m.reply('Número de episodio no válido. Debes responder solo con el número del episodio (Ej. 1)');

    const episode = session.episodes.find(e => parseInt(e.ep) === epi);
    if (!episode) return m.reply(`Episodio ${epi} no encontrado.`);

    await m.reply(`Descargando ${session.title} - Episodio ${epi} ... ⌛\n\n_Esto puede tardar un poco debido al peso del video._`);
    m.react("📥");

    session.downloading = true;

    try {
        const inf = await download(episode.link);
        if (inf.error || !inf.dl || !inf.dl.sub) {
             m.react("❌");
             session.downloading = false;
             return m.reply(`Error: No se pudo obtener el video directo para el episodio ${epi}. Detalles: ${inf.error || 'Servidor (YourUpload) no disponible para este cap.'}`);
        }

        const videoUrl = inf.dl.sub;
        
        let videoBuffer;
        if (inf.type === 'mega') {
            const file = File.fromURL(videoUrl);
            await file.loadAttributes();
            videoBuffer = await file.downloadBuffer();
        } else {
            const res = await fetch(videoUrl);
            videoBuffer = Buffer.from(await res.arrayBuffer());
        }
        
        await conn.sendFile(m.chat, videoBuffer, `${session.title} - ep ${epi}.mp4`, '', m, false, {
            mimetype: 'video/mp4',
            asDocument: true
        });
        m.react("✅");
    } catch (err) {
        console.error('Error al descargar de tioanime:', err);
        m.reply(`Error al descargar el episodio: ${err.message}`);
        m.react("❌");
    }

    clearTimeout(session.timeout);
    delete conn.tioanime[m.sender];
};

handler.command = ["tioanime", "tioanimedl"];
handler.tags = ['download'];
handler.help = ["tioanime"];

export default handler;
