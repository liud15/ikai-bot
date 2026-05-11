import axios from 'axios';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) return conn.reply(m.chat, `✨ Por favor, ingresa un enlace de un TikTok de imágenes (carrusel).`, m);

    try {
        await m.react("⏳");
        conn.reply(m.chat, `⏳ Descargando imágenes de TikTok, espere un momento...`, m);

        let response = await axios.get(`https://api.evogb.org/dl/tiktok?url=${encodeURIComponent(text)}&key=liu-ofc`);
        let resData = response.data;

        if (!resData || !resData.status || !resData.data) {
            return conn.reply(m.chat, `❌ No se pudo obtener información de este enlace. Verifica que sea válido.`, m);
        }

        // Verificamos que sea de tipo "image" y que "dl" contenga un array de imágenes
        if (resData.data.type !== 'image' || !Array.isArray(resData.data.dl)) {
            return conn.reply(m.chat, `⚠️ Este enlace no es un carrusel de imágenes. Si es un video normal, usa el comando de descargar videos de TikTok.`, m);
        }

        let images = resData.data.dl;
        let title = resData.data.title || 'TikTok Imágenes';

        // 1. Crear el Mensaje Padre (El Álbum de Imágenes)
        const albumMessage = await conn.sendMessage(m.chat, {
            album: {
                expectedImageCount: images.length,
                expectedVideoCount: 0
            }
        }, { quoted: m });

        // 2. Enviar las imágenes agrupadas en el álbum
        for (let i = 0; i < images.length; i++) {
            await conn.sendMessage(m.chat, {
                image: { url: images[i] },
                caption: `📸 Imagen ${i + 1}/${images.length} — *${title}*\n⪛✰ TikTok Imágenes ✰⪜`,
                albumParentKey: albumMessage.key
            });
        }

        await m.react("✅");
    } catch (error) {
        console.error(error);
        return conn.reply(m.chat, "❌ Ocurrió un error al intentar descargar las imágenes.", m);
    }
};

handler.help = ["tiktokimg <link>"];
handler.tags = ["descargas"];
handler.command = ['tiktokimg', 'ttimg', 'ttfoto', 'tiktokfoto'];
handler.limit = true;

export default handler;
