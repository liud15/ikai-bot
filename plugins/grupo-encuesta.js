var handler = async (m, { conn, text, usedPrefix, command }) => {
    // Si no escribe nada, le damos un ejemplo claro con 5 opciones
    if (!text) {
        return conn.reply(m.chat, `🎌 *Uso correcto:* ${usedPrefix + command} Pregunta | Opción 1 | Opción 2 | Opción 3...\n\n*Ejemplo con 5 opciones:*\n${usedPrefix + command} ¿Cuál es el mejor personaje? | Mita | Senku | Naruto | Goku | Ninguno`, m);
    }

    // Dividimos el texto usando la barra vertical "|"
    let parts = text.split('|').map(v => v.trim());
    
    // La primera parte es la pregunta
    let question = parts[0];
    // El resto de las partes son las opciones de respuesta
    let options = parts.slice(1);

    // Verificamos que al menos haya puesto la pregunta y 2 opciones
    if (options.length < 2) {
        return conn.reply(m.chat, `🎌 Debes poner la pregunta y al menos 2 opciones separadas por la barra vertical " | ".\n\nEjemplo: ${usedPrefix + command} ¿Día o Noche? | Día | Noche`, m);
    }

    // WhatsApp permite un máximo de 12 opciones por encuesta nativa
    if (options.length > 12) {
        return conn.reply(m.chat, `🎌 WhatsApp solo permite un máximo de 12 opciones por encuesta.`, m);
    }

    try {
        // Usamos la función nativa de Baileys para crear la encuesta
        await conn.sendMessage(m.chat, {
            poll: {
                name: question,
                values: options,
                selectableCount: 1 // Configurado en 1 para que los usuarios solo puedan votar por UNA opción (no múltiples)
            }
        }, { quoted: m });

    } catch (e) {
        console.error(e);
        conn.reply(m.chat, `❌ Ocurrió un error al crear la encuesta. Asegúrate de tener tu bot actualizado.`, m);
    }
}

handler.help = ['encuesta <pregunta | op1 | op2>'];
handler.tags = ['grupo'];
handler.command = ['encuesta', 'poll', 'votar'];
handler.group = true; // Solo funciona en grupos

export default handler;