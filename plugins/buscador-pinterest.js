import axios from 'axios';

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) return conn.reply(m.chat, `${emoji} Por favor, ingresa lo que deseas buscar en Pinterest.`, m);
  let query = text + " hd";
  await m.react("⏳");
  conn.reply(m.chat, `${emoji2} Descargando imágenes, espere un momento...`, m);
  try {
    let response = await axios.get(`https://api.evogb.org/search/pinterest?query=${encodeURIComponent(query)}&key=liu-ofc`);
    let resData = response.data;

    if (!resData || !resData.status || !resData.data || resData.data.length === 0) {
      return conn.reply(m.chat, `No se encontraron resultados para tu búsqueda.`, m);
    }

    let images = resData.data.slice(0, 5).map(item => item.hd || item.mini);

    // 1. Crear el "Mensaje Padre" (El Álbum)
    const albumMessage = await conn.sendMessage(m.chat, {
      album: {
        expectedImageCount: images.length,
        expectedVideoCount: 0
      }
    }, { quoted: m });

    // 2. Enviar los medios individuales asociados al álbum
    for (let i = 0; i < images.length; i++) {
      await conn.sendMessage(m.chat, {
        image: { url: images[i] },
        caption: `${emoji3 || '✨'} Imagen ${i + 1}/${images.length} — *${text}*\n⪛✰ Pinterest HD ✰⪜`,
        albumParentKey: albumMessage.key
      });
    }

    await m.react("✅");
  } catch (error) {
    console.error(error);
    return conn.reply(m.chat, "Ocurrió un error al buscar las imágenes.", m);
  }
};

handler.help = ["pinterest"];
handler.tags = ["descargas"];
handler.command = ['pinterest', 'pin'];

export default handler;
