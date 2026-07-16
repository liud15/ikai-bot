var handler = async (m, { conn, text, usedPrefix, command }) => {
    // Verificar si ingresó el texto para la etiqueta
    if (!text) {
        return conn.reply(m.chat, `🎌 *Uso correcto:* ${usedPrefix + command} <texto de la etiqueta>\n\nEjemplo:\n${usedPrefix + command} Bot Oficial`, m);
    }

    // 1. Límite de longitud (Máximo 30 caracteres)
    if (text.length > 30) {
        return conn.reply(m.chat, `🎌 El texto de la etiqueta es demasiado largo. WhatsApp permite un máximo de 30 caracteres.`, m);
    }

    // 2. Límite de caracteres (Sin emojis ni símbolos especiales)
    // Permitimos: Letras (incluidas ñ y tildes), números, espacios y guiones/puntos.
    const validRegex = /^[a-zA-Z0-9\sñÑáéíóúÁÉÍÓÚüÜ.,_-]+$/;
    if (!validRegex.test(text)) {
        return conn.reply(m.chat, `🎌 *Caracteres inválidos:*\nWhatsApp no permite emojis ni símbolos especiales en las insignias de grupo. Por favor, usa solo letras, números y espacios.\n\nEjemplo válido: *Bot Moderador*`, m);
    }

    try {
        // Enviar la petición a los servidores de WhatsApp para cambiar la insignia del propio bot
        if (typeof conn.updateMemberLabel === 'function') {
            // Usar la función nativa de Baileys si está disponible
            await conn.updateMemberLabel(m.chat, text);
        } else {
            // Fallback enviando el protocolo directamente
            await conn.relayMessage(
                m.chat, 
                {
                    protocolMessage: {
                        type: 30, // GROUP_MEMBER_LABEL_CHANGE
                        memberLabel: {
                            label: text,
                            labelTimestamp: Math.floor(Date.now() / 1000)
                        }
                    }
                }, 
                {
                    additionalNodes: [{
                        tag: 'meta',
                        attrs: { tag_reason: 'user_update', appdata: 'member_tag' },
                        content: undefined
                    }]
                }
            );
        }

        conn.reply(m.chat, `✅ *¡Insignia actualizada!*\nAhora mi etiqueta en este grupo es: *"${text}"*`, m);
        
    } catch (e) {
        console.error(e);
        conn.reply(m.chat, `❌ Ocurrió un error al intentar cambiar mi etiqueta. Asegúrate de que tengo el rango de administrador en el grupo.`, m);
    }
}

handler.help = ['botlabel <texto>'];
handler.tags = ['grupo'];
handler.command = ['botlabel', 'setbotlabel', 'mietiqueta'];
handler.group = true;
handler.admin = true;    // Solo admins pueden usar el comando
handler.botAdmin = true; // El bot necesita ser admin obligatoriamente

export default handler;