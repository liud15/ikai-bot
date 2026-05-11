import axios from 'axios';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) {
        return m.reply(`⚠️ *Escribe un texto (prompt) para generar una imagen.*\nEjemplo: ${usedPrefix + command} un perro cibernético en marte`);
    }

    try {
        await m.reply(`⏳ *Generando imagen con inteligencia artificial, espera un momento...*`);
        await m.react('🎨');

        // La API devuelve la imagen en formato binario directamente
        let imageUrl = `https://api.evogb.org/ai/nanobanana?prompt=${encodeURIComponent(text)}&key=liu-ofc`;

        // Le damos un tiempo límite de 2 minutos (120000 ms) para que no se corte la conexión
        // Descargamos la imagen como buffer porque las imágenes son ligeras y no saturan la RAM
        let response = await axios.get(imageUrl, { 
            responseType: 'arraybuffer',
            timeout: 120000 
        });

        await conn.sendMessage(m.chat, {
            image: Buffer.from(response.data),
            caption: `✨ *Resultado Generado*\n📝 *Prompt:* ${text}\n⪛✰ Nano Banana AI ✰⪜`
        }, { quoted: m });

        await m.react('✅');
    } catch (error) {
        console.error(error);
        await m.react('❌');
        m.reply(`❌ *Error al generar la imagen. Inténtalo más tarde.*`);
    }
};

handler.help = ['nano <prompt>', 'banana <prompt>'];
handler.tags = ['ai'];
handler.command = ['nano', 'banana'];
handler.limit = true;

export default handler;