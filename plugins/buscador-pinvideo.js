import axios from 'axios';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) return conn.reply(m.chat, `${emoji} Por favor, ingresa lo que deseas buscar en Pinterest Video.`, m);
    let query = text;
    await m.react("⏳");
    conn.reply(m.chat, `${emoji2} Descargando videos, espere un momento...`, m);
    try {
        let response = await axios.get(`https://api.evogb.org/search/pinterestvideo?query=${encodeURIComponent(query)}&key=liu-ofc`);
        let resData = response.data;

        // Verificar si la respuesta es válida y contiene videos
        if (!resData || !resData.status || !resData.data || !resData.data.videos || resData.data.videos.length === 0) {
            return conn.reply(m.chat, `No se encontraron resultados de videos para tu búsqueda.`, m);
        }

        // Tomar solo los primeros 5 resultados y extraer sus enlaces .dl (mp4) y títulos
        let videos = resData.data.videos.slice(0, 8);

        // 1. Crear el Mensaje Padre (El Álbum de videos)
        const albumMessage = await conn.sendMessage(m.chat, {
            album: {
                expectedImageCount: 0,
                expectedVideoCount: videos.length
            }
        }, { quoted: m });

        // 2. Enviar los videos agrupados en el álbum
        for (let i = 0; i < videos.length; i++) {
            let videoUrl = videos[i].dl;
            let videoTitle = videos[i].title ? videos[i].title.trim() : text;

            await conn.sendMessage(m.chat, {
                video: { url: videoUrl },
                caption: `${typeof emoji3 !== 'undefined' ? emoji3 : '✨'} Video ${i + 1}/${videos.length} — *${videoTitle}*\n⪛✰ Pinterest Video ✰⪜`,
                albumParentKey: albumMessage.key
            });
        }

        await m.react("✅");
    } catch (error) {
        console.error(error);
        return conn.reply(m.chat, "Ocurrió un error al buscar los videos.", m);
    }
};

handler.help = ["pinvideo"];
handler.tags = ["descargas"];
handler.command = ['pinvideo', 'pinterestvideo'];

export default handler;
