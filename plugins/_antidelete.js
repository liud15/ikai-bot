import { getContentType, generateForwardMessageContent, generateWAMessageFromContent } from '@whiskeysockets/baileys';

global.delete = global.delete || [];

export async function before(m, { conn, isAdmin, isBotAdmin }) {
    if (isAdmin) return;
    if (!m.isGroup) return;
    if (m.key.fromMe) return;

    let chat = global.db.data.chats[m.chat];

    if (chat.delete) {
        if (global.delete.length > 500) global.delete = [];
        if (m.type !== 'protocolMessage' && m.key && m.message) global.delete.push({ key: m.key, message: m.message });
        if (m?.message?.protocolMessage) {
            let msg = global.delete.find((index) => index.key.id === m.message.protocolMessage.key.id);

            if (msg) {
                let quoted = {
                    key: msg.key,
                    message: {
                        extendedTextMessage: {
                            text: '《✧》Este usuario elimino un mensaje.'
                        }
                    }
                };

                await sendMessageForward(msg, {
                    client: conn,
                    from: m.chat,
                    isReadOneView: true,
                    viewOnce: false,
                    quoted: quoted
                });

                let index = global.delete.indexOf(msg);
                if (index !== -1) global.delete.splice(index, 1);
            }
        }
    }
}

/// FUNCION CREADA POR HIDEKI PARA YUKI-BOT USADA POR MITABOT

async function sendMessageForward(msg, options = {}) {
    let originalType = getContentType(msg.message);
    let forwardContent = await generateForwardMessageContent(msg, { forwardingScore: true });
    let forwardType = getContentType(forwardContent);

    // Si se proporcionó un caption/texto personalizado
    if (options.caption) {
        if (forwardType === 'conversation') {
            forwardContent[forwardType] = options.caption;
        } else if (forwardType === 'extendedTextMessage') {
            forwardContent[forwardType].text = options.caption;
        } else {
            forwardContent[forwardType].caption = options.caption;
        }
    }

    // Si se quiere leer mensajes de "ver una vez"
    if (options.isReadOneView) {
        forwardContent[forwardType].viewOnce = options.viewOnce;
    }

    // Configurar contextInfo (menciones, forward, remoteJid)
    forwardContent[forwardType].contextInfo = {
        ...(msg.message[originalType].contextInfo || {}),
        ...(options.mentions
            ? { mentionedJid: options.mentions }
            : forwardContent[forwardType].contextInfo || {}),
        isForwarded: options.forward || true,
        remoteJid: options.remote || null
    };

    // Generar y enviar el mensaje
    let generatedMessage = await generateWAMessageFromContent(options.from, forwardContent, {
        userJid: options.client.user.id,
        quoted: options.quoted || msg
    });

    await options.client.relayMessage(options.from, generatedMessage.message, {
        messageId: generatedMessage.key.id
    });

    return generatedMessage;
}
