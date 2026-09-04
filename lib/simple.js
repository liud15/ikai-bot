import path from 'path'
import { toAudio } from './converter.js'
import {
    decodeJid as _decodeJid, toTimeString as _toTimeString,
    capitalize as _capitalize, capitalizeV2 as _capitalizeV2,
    isNumber as _isNumber, getRandom as _getRandom,
    toArrayBuffer as _toArrayBuffer, toArrayBufferV2 as _toArrayBufferV2,
    arrayBufferToBuffer as _arrayBufferToBuffer, getFileType as _getFileType,
    resolveLidToRealJid as _resolveLidToRealJid
} from './utils.js'
import chalk from 'chalk'
import fetch from 'node-fetch'
import PhoneNumber from 'awesome-phonenumber'
import fs from 'fs'
import util from 'util'
import { fileTypeFromBuffer } from 'file-type'
import { format } from 'util'
import { fileURLToPath } from 'url'
import store from './store.js'
import { tmpPath } from './tmp.js'
import Jimp from 'jimp'
import pino from 'pino'
import { randomBytes } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ======================================================================
// COLA MULTICARRIL DE ENVÍO — protección contra rate-overlimit (429)
// Módulo externo: ./media-queue.js
// ======================================================================
import {
    MediaQueueManager,
    isRateOverlimitError,
    enqueueMediaUpload,
    enqueueTextSend,
    hasMediaPayload,
    classifyJid,
    getManagerForSocket
} from './media-queue.js'

export { isRateOverlimitError }


// ======================================================================
// 🛡️ SISTEMA ULTRA BLINDADO DE EXTRACCIÓN DE BAILEYS
// ======================================================================
const BaileysRaw = await import('@whiskeysockets/baileys');

// 1. Fusión de Capas: Juntamos la raíz y el "default" en un solo objeto masivo.
const BaileysModule = BaileysRaw.default ? { ...BaileysRaw, ...BaileysRaw.default } : { ...BaileysRaw };

// ✅ FIX: alias directo para evitar "baileys is not defined"
const baileys = BaileysModule;

// 2. Rastreador de Proto: Buscamos el objeto vital bajo todos sus alias conocidos.
export const proto = BaileysModule.proto || BaileysModule.WAProto || BaileysModule.WAproto;

if (!proto) {
    console.error("❌ ALERTA ROJA: Ningún objeto 'proto' fue encontrado en este fork de Baileys.");
}

// 3. Desestructuración con Paracaídas
const {
    downloadContentFromMessage = async () => ({}),
    jidDecode = (jid) => jid,
    areJidsSameUser = (a, b) => a === b,
    generateWAMessage = () => ({}),
    generateForwardMessageContent = () => ({}),
    generateWAMessageFromContent = () => ({}),
    WAMessageStubType = {},
    extractMessageContent = (msg) => msg,
    makeInMemoryStore = () => ({}),
    getAggregateVotesInPollMessage = () => ({}),
    prepareWAMessageMedia = async () => ({}),
    WA_DEFAULT_EPHEMERAL = 86400,
    PHONENUMBER_MCC = {},
    makeWALegacySocket = null
} = BaileysModule;

// 4. Aseguramos el creador del Socket
let _makeWaSocket = BaileysModule.makeWASocket;

function getInteractiveResponseId(msg = {}) {
    /*
     * Cuando smsg() ya resolvió el mtype como interactiveResponseMessage,
     * `msg` es directamente el contenido interno de ese mensaje.
     */
    const interactive =
        msg?.interactiveResponseMessage ||
        msg

    const nativeFlow =
        interactive?.nativeFlowResponseMessage ||
        msg?.nativeFlowResponseMessage

    const paramsJson = nativeFlow?.paramsJson

    if (!paramsJson) {
        return ''
    }

    try {
        const parsed =
            typeof paramsJson === 'string'
                ? JSON.parse(paramsJson)
                : paramsJson

        return String(
            parsed?.id ||
            parsed?.row_id ||
            parsed?.rowId ||
            parsed?.selected_id ||
            parsed?.selectedId ||
            parsed?.selected_row_id ||
            parsed?.selectedRowId ||
            parsed?.button_id ||
            parsed?.buttonId ||
            parsed?.command ||
            ''
        ).trim()
    } catch (error) {
        console.error(
            '[Native Flow] No se pudo interpretar paramsJson:',
            error
        )
        return ''
    }
}

function getMessageResponseText(msg = {}) {
    if (typeof msg === 'string') {
        return msg
    }

    /*
     * Compatibilidad con respuestas directas y envueltas.
     * En smsg(), this.msg normalmente ya es el contenido del mtype.
     */
    return String(
        msg?.selectedButtonId ||
        msg?.selectedId ||
        msg?.singleSelectReply?.selectedRowId ||
        msg?.buttonsResponseMessage?.selectedButtonId ||
        msg?.templateButtonReplyMessage?.selectedId ||
        msg?.listResponseMessage?.singleSelectReply?.selectedRowId ||
        getInteractiveResponseId(msg) ||
        msg?.text ||
        msg?.caption ||
        msg?.contentText ||
        ''
    ).trim()
}

async function sendNativeButtons(
    conn,
    jid,
    {
        text = '',
        title = '',
        subtitle = '',
        footer = '',
        buttons = [],
        image = null,
        video = null,
        mentions = []
    } = {},
    quoted = null,
    options = {}
) {
    if (!jid) {
        throw new TypeError('sendNativeButtons: falta el JID de destino.')
    }

    if (!Array.isArray(buttons) || buttons.length === 0) {
        throw new TypeError('sendNativeButtons: debes proporcionar al menos un botón.')
    }

    const userJid =
        conn.user?.jid ||
        conn.decodeJid?.(conn.user?.id) ||
        conn.user?.id

    if (!userJid) {
        throw new Error('sendNativeButtons: el socket todavía no tiene un usuario conectado.')
    }

    const NativeFlowButton =
        proto.Message
            ?.InteractiveMessage
            ?.NativeFlowMessage
            ?.NativeFlowButton

    const nativeButtons = buttons.map((button, index) => {
        if (!button || typeof button.name !== 'string') {
            throw new TypeError(`Botón inválido en la posición ${index}.`)
        }

        const params = button.params ?? button.buttonParams ?? {}
        const rawButton = {
            name: button.name,
            buttonParamsJson:
                typeof params === 'string'
                    ? params
                    : JSON.stringify(params)
        }

        return typeof NativeFlowButton?.create === 'function'
            ? NativeFlowButton.create(rawButton)
            : rawButton
    })

    const rawOptions =
        options && typeof options === 'object'
            ? { ...options }
            : {}

    const queueOptions = {
        label: 'sendButtons',
        minGapMs: 2_000,
        maxRetries: 2,
        ...(rawOptions.mediaQueue || {})
    }

    delete rawOptions.mediaQueue

    const sendTask = async () => {
        let preparedMedia = {}
        let hasMediaAttachment = false

        if (image) {
            preparedMedia = await prepareWAMessageMedia(
                { image },
                { upload: conn.waUploadToServer }
            )
            hasMediaAttachment = true
        } else if (video) {
            preparedMedia = await prepareWAMessageMedia(
                { video },
                { upload: conn.waUploadToServer }
            )
            hasMediaAttachment = true
        }

        const interactiveMessage = proto.Message.InteractiveMessage.create({
            header: proto.Message.InteractiveMessage.Header.create({
                title: String(title || ''),
                subtitle: String(subtitle || ''),
                hasMediaAttachment,
                ...preparedMedia
            }),
            body: proto.Message.InteractiveMessage.Body.create({
                text: String(text || '')
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
                text: String(footer || '')
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: nativeButtons,
                messageParamsJson: '{}',
                messageVersion: 1
            }),
            contextInfo: {
                mentionedJid: Array.isArray(mentions) ? mentions : []
            }
        })

        const generated = await generateWAMessageFromContent(
            jid,
            { interactiveMessage },
            {
                userJid,
                quoted,
                upload: conn.waUploadToServer,
                ...rawOptions
            }
        )

        if (!generated?.message || !generated?.key?.id) {
            throw new Error('sendNativeButtons: Baileys no generó un mensaje válido.')
        }

        const privacyModeTs = (
            Math.floor(Date.now() / 1000) - 77_980_457
        ).toString()

        const bizNode = {
            tag: 'biz',
            attrs: {
                actual_actors: '2',
                host_storage: '2',
                privacy_mode_ts: privacyModeTs
            },
            content: [
                {
                    tag: 'interactive',
                    attrs: {
                        type: 'native_flow',
                        v: '1'
                    },
                    content: [
                        {
                            tag: 'native_flow',
                            attrs: {
                                v: '9',
                                name: 'mixed'
                            }
                        }
                    ]
                },
                {
                    tag: 'quality_control',
                    attrs: {
                        source_type: 'third_party'
                    }
                }
            ]
        }

        const botNode = {
            tag: 'bot',
            attrs: {
                biz_bot: '1'
            }
        }

        const isGroup = String(jid).endsWith('@g.us')
        const additionalNodes = isGroup
            ? [bizNode]
            : [botNode, bizNode]

        await conn.relayMessage(
            jid,
            generated.message,
            {
                messageId: generated.key.id,
                additionalNodes
            }
        )

        console.log('[sendButtons] Native Flow enviado:', {
            jid,
            messageId: generated.key.id,
            buttons: nativeButtons.length,
            isGroup,
            additionalNodes: additionalNodes.map(node => node.tag)
        })

        return generated
    }

    if (image || video) {
        return enqueueMediaUpload(
            conn,
            jid,
            sendTask,
            queueOptions
        )
    }

    return enqueueTextSend(
        conn,
        jid,
        sendTask,
        queueOptions
    )
}

// ======================================================================

export function makeWASocket(connectionOptions, options = {}) {

    /**
     * @type {import("baileys").WASocket | import("baileys").WALegacySocket}
     */
    // Usamos _makeWaSocket asegurado
    const conn = (global.opts["legacy"] && makeWALegacySocket ? makeWALegacySocket : _makeWaSocket)(
        connectionOptions,
    );

    if (typeof conn?.sendMessage !== 'function') {
        throw new Error('Baileys no proporcionó conn.sendMessage().')
    }

    /*
     * Guardamos la implementación original antes de envolverla.
     * Así todos los plugins —incluidos los que no fueron modificados— pasan
     * por una cola por socket cuando envían multimedia.
     */
    const rawSendMessage = conn.sendMessage.bind(conn)

    conn.sendMessage = async function (
        jid,
        content = {},
        sendOptions = {}
    ) {
        // Multimedia → cola de medios (carril según JID)
        if (hasMediaPayload(content)) {
            let tmpFiles = [];
            
            // Offload de Buffer a Stream para evitar explosión de RAM (v7.0.0-rc14 optimiza streams)
            for (const key of ['image', 'video', 'audio', 'document', 'sticker']) {
                if (content[key] && Buffer.isBuffer(content[key])) {
                    // Escribimos el buffer a un temporal único
                    const tPath = tmpPath(`offload_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
                    await fs.promises.writeFile(tPath, content[key]);
                    
                    // Reemplazamos el Buffer con un ReadableStream
                    content[key] = { stream: fs.createReadStream(tPath) };
                    tmpFiles.push(tPath);
                }
            }

            return enqueueMediaUpload(
                conn,
                jid,
                async () => {
                    try {
                        return await rawSendMessage(jid, content, sendOptions);
                    } finally {
                        // Limpiamos los temporales una vez Baileys terminó la subida o falló
                        for (const f of tmpFiles) {
                            fs.unlink(f, () => {});
                        }
                    }
                },
                {
                    label: 'sendMessage:auto',
                    maxRetries: 2
                }
            )
        }

        // Reacciones, deletes, edits y otros mensajes de control -> cola de texto
        // En versiones anteriores iban directo sin cola, lo que causaba el 429
        // cuando los plugins hacían "react + texto + react_final" muy rápido.
        if (content?.edit || content?.delete || content?.react || content?.pollUpdates) {
            return enqueueTextSend(
                conn,
                jid,
                () => rawSendMessage(jid, content, sendOptions),
                {
                    label: 'sendMessage:control',
                    maxRetries: 1
                }
            )
        }

        // Texto plano -> cola de texto (carril liviano, alta concurrencia)
        if (content?.text != null) {
            return enqueueTextSend(
                conn,
                jid,
                async () => {
                    // FIX ANTI-BAN: Simular escritura humana antes de disparar el mensaje
                    try { await conn.sendPresenceUpdate('composing', jid) } catch (e) {}
                    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700))
                    return rawSendMessage(jid, content, sendOptions)
                },
                {
                    label: 'sendMessage:text',
                    maxRetries: 1
                }
            )
        }

        // Cualquier otro tipo de mensaje (contactos, ubicación, etc) -> cola de texto
        // Evitamos completamente el rawSendMessage directo para erradicar el 429.
        return enqueueTextSend(
            conn,
            jid,
            () => rawSendMessage(jid, content, sendOptions),
            {
                label: 'sendMessage:fallback',
                maxRetries: 1
            }
        )
    }

    const sock = Object.defineProperties(conn, {
        chats: {
            value: {
                ...(options.chats || {})
            },
            writable: true,
        },
        decodeJid: {
            value(jid) {
                if (!jid || typeof jid !== "string")
                    return (!nullish(jid) && jid) || null;
                return jid.decodeJid();
            },
        },
        logger: {
            get() {
                return {
                    info(...args) {
                        console.log(
                            chalk.bold.bgRgb(51, 204, 51)("INFO "),
                            `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
                            chalk.cyan(format(...args)),
                        );
                    },
                    error(...args) {
                        console.log(
                            chalk.bold.bgRgb(247, 38, 33)("ERROR "),
                            `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
                            chalk.rgb(255, 38, 0)(format(...args)),
                        );
                    },
                    warn(...args) {
                        console.log(
                            chalk.bold.bgRgb(255, 153, 0)("WARNING "),
                            `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
                            chalk.redBright(format(...args)),
                        );
                    },
                    trace(...args) {
                        console.log(
                            chalk.grey("TRACE "),
                            `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
                            chalk.white(format(...args)),
                        );
                    },
                    debug(...args) {
                        console.log(
                            chalk.bold.bgRgb(66, 167, 245)("DEBUG "),
                            `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
                            chalk.white(format(...args)),
                        );
                    },
                };
            },
            enumerable: true,
        },
        enqueueMediaUpload: {
            value(jid, task, options = {}) {
                return enqueueMediaUpload(this, jid, task, options)
            },
            enumerable: false,
            configurable: true
        },
        isRateOverlimit: {
            value(error) {
                return isRateOverlimitError(error)
            },
            enumerable: false,
            configurable: true
        },
        /**
         * Obtiene estadísticas de la cola multicarril.
         * Útil para monitoreo y diagnóstico en tiempo real.
         * @returns {{ lanes, semaphore, counters, blockedUntil }}
         */
        getMediaQueueStats: {
            value() {
                const manager = getManagerForSocket(this)
                return manager.getStats()
            },
            enumerable: false,
            configurable: true
        },
        /**
         * Función de conveniencia drop-in para reemplazar conn.sendMessage.
         * Rutea automáticamente al carril correcto según el tipo de JID y contenido.
         * Uso: conn.enviarMensajeOptimizado(jid, content, options)
         */
        enviarMensajeOptimizado: {
            async value(jid, content = {}, sendOptions = {}) {
                return conn.sendMessage(jid, content, sendOptions)
            },
            enumerable: false,
            configurable: true
        },
        sendMessageQueued: {
            async value(jid, content = {}, sendOptions = {}, queueOptions = {}) {
                // Reacciones, deletes, edits y otros mensajes de control -> directo (sin cola)
                if (content?.edit || content?.delete || content?.react || content?.pollUpdates) {
                    return rawSendMessage(jid, content, sendOptions)
                }

                if (!hasMediaPayload(content)) {
                    return enqueueTextSend(
                        this,
                        jid,
                        () => rawSendMessage(jid, content, sendOptions),
                        { label: 'sendMessageQueued:text', maxRetries: 1, ...queueOptions }
                    )
                }

                return enqueueMediaUpload(
                    this,
                    jid,
                    () => rawSendMessage(jid, content, sendOptions),
                    {
                        label: 'sendMessageQueued',
                        maxRetries: 2,
                        ...queueOptions
                    }
                )
            },
            enumerable: false,
            configurable: true
        },
        sendButtons: {
            async value(jid, content = {}, quoted = null, options = {}) {
                return sendNativeButtons(this, jid, content, quoted, options);
            },
            enumerable: true,
            configurable: true
        },
        sendSylph: {
            async value(jid, text = '', buffer, title, body, url, quoted, options) {
                if (buffer) try { (type = await conn.getFile(buffer), buffer = type.data) } catch { buffer = buffer }
                let prep = generateWAMessageFromContent(jid, { extendedTextMessage: { text: text, contextInfo: { externalAdReply: { title: title, body: body, thumbnail: buffer, sourceUrl: url }, mentionedJid: await conn.parseMention(text, jid) } } }, { quoted: quoted })
                return conn.relayMessage(jid, prep.message, { messageId: prep.key.id })
            }
        },
        sendSylphy: {
            async value(jid, medias, options = {}) {
                if (typeof jid !== "string") {
                    throw new TypeError(`jid must be string, received: ${jid} (${jid?.constructor?.name})`);
                }
                for (const media of medias) {
                    if (!media.type || (media.type !== "image" && media.type !== "video")) {
                        throw new TypeError(`media.type must be "image" or "video", received: ${media.type} (${media.type?.constructor?.name})`);
                    }
                    if (!media.data || (!media.data.url && !Buffer.isBuffer(media.data))) {
                        throw new TypeError(`media.data must be object with url or buffer, received: ${media.data} (${media.data?.constructor?.name})`);
                    }
                }
                if (medias.length < 2) {
                    throw new RangeError("Minimum 2 media");
                }
                const delay = !isNaN(options.delay) ? options.delay : 500;
                delete options.delay;
                const album = baileys.generateWAMessageFromContent(
                    jid,
                    {
                        messageContextInfo: {},
                        albumMessage: {
                            expectedImageCount: medias.filter(media => media.type === "image").length,
                            expectedVideoCount: medias.filter(media => media.type === "video").length,
                            ...(options.quoted
                                ? {
                                    contextInfo: {
                                        remoteJid: options.quoted.key.remoteJid,
                                        fromMe: options.quoted.key.fromMe,
                                        stanzaId: options.quoted.key.id,
                                        participant: options.quoted.key.participant || options.quoted.key.remoteJid,
                                        quotedMessage: options.quoted.message,
                                    },
                                }
                                : {}),
                        },
                    },
                    {}
                );
                await conn.relayMessage(album.key.remoteJid, album.message, { messageId: album.key.id });
                for (let i = 0; i < medias.length; i++) {
                    const { type, data, caption } = medias[i];
                    const message = await generateWAMessage(
                        album.key.remoteJid,
                        { [type]: data, caption: caption || "" },
                        { upload: conn.waUploadToServer }
                    );
                    message.message.messageContextInfo = {
                        messageAssociation: { associationType: 1, parentMessageKey: album.key },
                    };
                    await conn.relayMessage(message.key.remoteJid, message.message, { messageId: message.key.id });
                    await baileys.delay(delay);
                }
                return album
            }
        },
        sendNyanCat: {
            async value(jid, text = "", buffer, title, body, url, quoted, options) {
                if (buffer) {
                    try {
                        ((type = await conn.getFile(buffer)), (buffer = type.data));
                    } catch {
                        buffer = buffer;
                    }
                }
                const prep = generateWAMessageFromContent(
                    jid, {
                    extendedTextMessage: {
                        text: text,
                        contextInfo: {
                            externalAdReply: {
                                title: title,
                                body: body,
                                thumbnail: buffer,
                                sourceUrl: url,
                            },
                            mentionedJid: await conn.parseMention(text, jid),
                        },
                    },
                }, {
                    quoted: quoted
                },
                );
                return conn.relayMessage(jid, prep.message, {
                    messageId: prep.key.id
                });
            },
        },
        sendPayment: {
            async value(jid, amount, text, quoted, options) {
                conn.relayMessage(
                    jid, {
                    requestPaymentMessage: {
                        currencyCodeIso4217: "PEN",
                        amount1000: amount,
                        requestFrom: null,
                        noteMessage: {
                            extendedTextMessage: {
                                text: text,
                                contextInfo: {
                                    externalAdReply: {
                                        showAdAttribution: true,
                                    },
                                    mentionedJid: await conn.parseMention(text, jid),
                                },
                            },
                        },
                    },
                }, {},
                );
            },
        },
        getFile: {
            /**
             * getBuffer hehe
             * @param {fs.PathLike} PATH
             * @param {Boolean} saveToFile
             */
            async value(PATH, saveToFile = false) {
                let res;
                let filename;
                const data = Buffer.isBuffer(PATH) ?
                    PATH :
                    PATH instanceof ArrayBuffer ?
                        PATH.toBuffer() :
                        /^data:.*?\/.*?;base64,/i.test(PATH) ?
                            Buffer.from(PATH.split`,`[1], "base64") :
                            /^https?:\/\//.test(PATH) ?
                                Buffer.from(await (res = await fetch(PATH)).arrayBuffer()) :
                                fs.existsSync(PATH) ?
                                    ((filename = PATH), fs.readFileSync(PATH)) :
                                    typeof PATH === "string" ?
                                        PATH :
                                        Buffer.alloc(0);
                if (!Buffer.isBuffer(data))
                    throw new TypeError("Result is not a buffer");
                const type = (await fileTypeFromBuffer(data)) || {
                    mime: "application/octet-stream",
                    ext: ".bin",
                };
                if (data && saveToFile && !filename) {
                    filename = tmpPath(new Date() * 1 + "." + type.ext);
                    // Garantizar que el directorio tmp existe antes de escribir
                    const tmpDir = path.dirname(filename);
                    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
                    await fs.promises.writeFile(filename, data);
                }
                return {
                    res,
                    filename,
                    ...type,
                    data,
                    deleteFile() {
                        return filename && fs.promises.unlink(filename);
                    },
                };
            },
            enumerable: true,
        },

        waitEvent: {
            /**
             * waitEvent
             * @param {String} eventName
             * @param {Boolean} is
             * @param {Number} maxTries
             */
            value(eventName, is = () => true, maxTries = 25) {
                // Idk why this exist?
                return new Promise((resolve, reject) => {
                    let tries = 0;
                    const on = (...args) => {
                        if (++tries > maxTries) reject("Max tries reached");
                        else if (is()) {
                            conn.ev.off(eventName, on);
                            resolve(...args);
                        }
                    };
                    conn.ev.on(eventName, on);
                });
            },
        },
        relayWAMessage: {
            async value(pesanfull) {
                if (pesanfull.message.audioMessage) {
                    await conn.sendPresenceUpdate("recording", pesanfull.key.remoteJid);
                } else {
                    await conn.sendPresenceUpdate("composing", pesanfull.key.remoteJid);
                }
                const mekirim = await conn.relayMessage(
                    pesanfull.key.remoteJid,
                    pesanfull.message, {
                    messageId: pesanfull.key.id
                },
                );
                conn.ev.emit("messages.upsert", {
                    messages: [pesanfull],
                    type: "append",
                });
                return mekirim;
            },
        },
        sendFile: {
            /**
             * Send Media/File with Automatic Type Specifier
             * @param {String} jid
             * @param {String|Buffer} path
             * @param {String} filename
             * @param {String} caption
             * @param {import("baileys").proto.WebMessageInfo} quoted
             * @param {Boolean} ptt
             * @param {Object} options
             */
            async value(
                jid,
                path,
                filename = "",
                caption = "",
                quoted,
                ptt = false,
                options = {},
            ) {
                const type = await conn.getFile(path, true);
                let {
                    res,
                    data: file,
                    filename: pathFile
                } = type;
                if ((res && res.status !== 200) || file.length <= 65536) {
                    try {
                        throw {
                            json: JSON.parse(file.toString())
                        };
                    } catch (e) {
                        if (e.json) throw e.json;
                    }
                }
                const opt = {};
                if (quoted) opt.quoted = quoted;
                if (!type) options.asDocument = true;
                let mtype = "";
                let mimetype = options.mimetype || type.mime;
                let convert;
                if (
                    /webp/.test(type.mime) ||
                    (/image/.test(type.mime) && options.asSticker)
                )
                    mtype = "sticker";
                else if (
                    /image/.test(type.mime) ||
                    (/webp/.test(type.mime) && options.asImage)
                )
                    mtype = "image";
                else if (/video/.test(type.mime)) mtype = "video";
                else if (/audio/.test(type.mime)) {
                    ((convert = await toAudio(file, type.ext)),
                        (file = convert.data),
                        (pathFile = convert.filename),
                        (mtype = "audio"),
                        (mimetype = options.mimetype || "audio/ogg; codecs=opus"));
                } else mtype = "document";
                if (options.asDocument) mtype = "document";

                delete options.asSticker;
                delete options.asLocation;
                delete options.asVideo;
                delete options.asDocument;
                delete options.asImage;

                // Para archivos grandes: liberar el buffer de RAM después de
                // escribirlo a disco — evita tener 2-3 copias de 1 GB en memoria.
                const fileSizeMB = file ? file.length / (1024 * 1024) : 0;
                const isLargeFile = fileSizeMB > 50;
                if (isLargeFile && pathFile) {
                    file = null; // liberar buffer — Baileys leerá desde pathFile
                    if (global.gc) try { global.gc() } catch (_) {} // sugerir GC si --expose-gc
                }

                // ── Proteger archivo temporal contra clearTmp() ──────────────
                const activePath = pathFile
                    ? (await import('path')).default.resolve(pathFile)
                    : null;
                if (activePath) {
                    global.activeMediaFiles ??= new Set();
                    global.activeMediaFiles.add(activePath);
                }

                const message = {
                    ...options,
                    caption,
                    ptt,
                    [mtype]: {
                        url: pathFile
                    },
                    mimetype,
                    fileName: filename || pathFile.split("/").pop(),
                };
                /**
                 * @type {import("baileys").proto.WebMessageInfo}
                 */
                let m;

                try {
                    if (pathFile) {
                        const exists = fs.existsSync(pathFile)
                        if (!exists) {
                            throw new Error(
                                `El archivo temporal desapareció antes del envío: ${pathFile}`
                            )
                        }
                    }

                    /*
                     * Nunca se cambia una sesión de sub-bot por global.conn.
                     * Cada socket conserva su propia cola y su propia identidad.
                     */
                    const activeConn = conn
                    const readyState =
                        activeConn?.ws?.socket?.readyState ??
                        activeConn?.ws?.readyState

                    if (
                        typeof readyState === 'number' &&
                        readyState !== 1
                    ) {
                        throw new Error(
                            'El socket se cerró antes de iniciar la subida multimedia.'
                        )
                    }

                    console.log(
                        `[sendFile] Encolando ${mtype} de ` +
                        `${fileSizeMB.toFixed(2)} MB para ${jid}.`
                    )

                    const sendOptions = {
                        ...opt,
                        ...options
                    }

                    if (typeof activeConn.sendMessageQueued === 'function') {
                        m = await activeConn.sendMessageQueued(
                            jid,
                            message,
                            sendOptions,
                            {
                                label: `sendFile:${mtype}`,
                                maxRetries: 2
                            }
                        )
                    } else {
                        m = await activeConn.sendMessage(
                            jid,
                            message,
                            sendOptions
                        )
                    }
                } finally {
                    if (activePath) {
                        global.activeMediaFiles?.delete(activePath)
                    }
                }

                file = null; // releasing the memory
                return m;
            },
            enumerable: true,
        },

        sendContact: {
            /**
             * Send Contact
             * @param {String} jid
             * @param {String[][]|String[]} data
             * @param {import("baileys").proto.WebMessageInfo} quoted
             * @param {Object} options
             */
            async value(jid, data, quoted, options) {
                if (!Array.isArray(data[0]) && typeof data[0] === "string")
                    data = [data];
                const contacts = [];
                for (let [number, name] of data) {
                    number = number.replace(/[^0-9]/g, "");
                    const njid = number + "@s.whatsapp.net";
                    const biz =
                        (await conn.getBusinessProfile(njid).catch((_) => null)) || {};
                    const vcard = `
BEGIN:VCARD
VERSION:3.0
N:;${name.replace(/\n/g, "\\n")};;;
FN:${name.replace(/\n/g, "\\n")}
TEL;type=CELL;type=VOICE;waid=${number}:${PhoneNumber("+" + number).getNumber("international")}${biz.description
                            ? `
X-WA-BIZ-NAME:${(conn.chats[njid]?.vname || conn.getName(njid) || name).replace(/\n/, "\\n")}
X-WA-BIZ-DESCRIPTION:${biz.description.replace(/\n/g, "\\n")}
`.trim()
                            : ""
                        }
END:VCARD
        `.trim();
                    contacts.push({
                        vcard,
                        displayName: name
                    });
                }
                return await conn.sendMessage(
                    jid, {
                    ...options,
                    contacts: {
                        ...options,
                        displayName: (contacts.length >= 2 ?
                            `${contacts.length} kontak` :
                            contacts[0].displayName) || null,
                        contacts,
                    },
                }, {
                    quoted,
                    ...options
                },
                );
            },
            enumerable: true,
        },
        reply: {
            /**
             * Reply to a message
             * @param {String} jid
             * @param {String|Buffer} text
             * @param {import("baileys").proto.WebMessageInfo} quoted
             * @param {Object} options
             */
            value(jid, text = "", quoted, options) {
                return Buffer.isBuffer(text) ?
                    conn.sendFile(jid, text, "file", "", quoted, false, options) :
                    conn.sendMessage(jid, {
                        ...options,
                        text
                    }, {
                        quoted,
                        ...options
                    });
            },
        },

        /**
         * Send nativeFlowMessage
         * By: https://github.com/GataNina-Li
         */

        sendButtonMessages: {
            async value(jid, messages, quoted, options) {
                messages.length > 1 ?
                    await conn.sendCarousel(jid, messages, quoted, options) :
                    await conn.sendNCarousel(jid, ...messages[0], quoted, options);
            },
        },

        /**
         * Send nativeFlowMessage
         */

        sendNCarousel: {
            async value(
                jid,
                text = "",
                footer = "",
                buffer,
                buttons,
                copy,
                urls,
                list,
                quoted,
                options,
            ) {
                let img, video;
                if (buffer) {
                    if (/^https?:\/\//i.test(buffer)) {
                        try {
                            const response = await fetch(buffer);
                            const contentType = response.headers.get("content-type");
                            if (/^image\//i.test(contentType)) {
                                img = await prepareWAMessageMedia({
                                    image: {
                                        url: buffer,
                                    },
                                }, {
                                    upload: conn.waUploadToServer,
                                    ...options,
                                },);
                            } else if (/^video\//i.test(contentType)) {
                                video = await prepareWAMessageMedia({
                                    video: {
                                        url: buffer,
                                    },
                                }, {
                                    upload: conn.waUploadToServer,
                                    ...options,
                                },);
                            } else {
                                console.error("Incompatible MIME type:", contentType);
                            }
                        } catch (error) {
                            console.error("Failed to get MIME type:", error);
                        }
                    } else {
                        try {
                            const type = await conn.getFile(buffer);
                            if (/^image\//i.test(type.mime)) {
                                img = await prepareWAMessageMedia({
                                    image: /^https?:\/\//i.test(buffer) ?
                                        {
                                            url: buffer,
                                        } :
                                        type && type?.data,
                                }, {
                                    upload: conn.waUploadToServer,
                                    ...options,
                                },);
                            } else if (/^video\//i.test(type.mime)) {
                                video = await prepareWAMessageMedia({
                                    video: /^https?:\/\//i.test(buffer) ?
                                        {
                                            url: buffer,
                                        } :
                                        type && type?.data,
                                }, {
                                    upload: conn.waUploadToServer,
                                    ...options,
                                },);
                            }
                        } catch (error) {
                            console.error("Failed to get file type:", error);
                        }
                    }
                }
                const dynamicButtons = buttons.map((btn) => ({
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: btn[0],
                        id: btn[1],
                    }),
                }));
                dynamicButtons.push(
                    copy && (typeof copy === "string" || typeof copy === "number") ?
                        {
                            name: "cta_copy",
                            buttonParamsJson: JSON.stringify({
                                display_text: "Copy",
                                copy_code: copy,
                            }),
                        } :
                        null,
                );
                urls?.forEach((url) => {
                    dynamicButtons.push({
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                            display_text: url[0],
                            url: url[1],
                            merchant_url: url[1],
                        }),
                    });
                });
                list?.forEach((lister) => {
                    dynamicButtons.push({
                        name: "single_select",
                        buttonParamsJson: JSON.stringify({
                            title: lister[0],
                            sections: lister[1],
                        }),
                    });
                });
                const interactiveMessage = {
                    body: {
                        text: text || "",
                    },
                    footer: {
                        text: footer || wm,
                    },
                    header: {
                        hasMediaAttachment: img?.imageMessage || video?.videoMessage ? true : false,
                        imageMessage: img?.imageMessage || null,
                        videoMessage: video?.videoMessage || null,
                    },
                    nativeFlowMessage: {
                        buttons: dynamicButtons.filter(Boolean),
                        messageParamsJson: "",
                    },
                    // Fix: cachear parseMention (antes se llamaba 3 veces)
                    ...await (async () => {
                        const _mentions = typeof text === "string" ? await conn.parseMention(text || "@0", jid) : [];
                        return Object.assign({
                            mentions: _mentions,
                            contextInfo: {
                                mentionedJid: _mentions,
                                groupMentions: [],
                                mentions: _mentions,
                            },
                        }, {
                            ...(options || {}),
                            ...(conn.temareply?.contextInfo && {
                                contextInfo: {
                                    ...(options?.contextInfo || {}),
                                    ...conn.temareply?.contextInfo,
                                    externalAdReply: {
                                        ...(options?.contextInfo?.externalAdReply || {}),
                                        ...conn.temareply?.contextInfo?.externalAdReply,
                                    },
                                },
                            }),
                        });
                    })(),
                };
                const messageContent = proto.Message.create({
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2,
                            },
                            interactiveMessage,
                        },
                    },
                });
                const msgs = await generateWAMessageFromContent(jid, messageContent, {
                    userJid: conn.user.jid,
                    quoted: quoted,
                    upload: conn.waUploadToServer,
                    ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
                });
                await conn.relayMessage(jid, msgs.message, {
                    messageId: msgs.key.id,
                });
            },
        },
        /**
         * Send carouselMessage
         */
        sendCarousel: {
            async value(
                jid,
                text = "",
                footer = "",
                text2 = "",
                messages,
                quoted,
                options,
            ) {
                if (messages.length > 1) {
                    const cards = await Promise.all(
                        messages.map(
                            async ([
                                text = "",
                                footer = "",
                                buffer,
                                buttons,
                                copy,
                                urls,
                                list,
                            ]) => {
                                let img, video;
                                if (/^https?:\/\//i.test(buffer)) {
                                    try {
                                        const response = await fetch(buffer);
                                        const contentType = response.headers.get("content-type");
                                        if (/^image\//i.test(contentType)) {
                                            img = await prepareWAMessageMedia({
                                                image: {
                                                    url: buffer,
                                                },
                                            }, {
                                                upload: conn.waUploadToServer,
                                                ...options,
                                            },);
                                        } else if (/^video\//i.test(contentType)) {
                                            video = await prepareWAMessageMedia({
                                                video: {
                                                    url: buffer,
                                                },
                                            }, {
                                                upload: conn.waUploadToServer,
                                                ...options,
                                            },);
                                        } else {
                                            console.error("Incompatible MIME types:", contentType);
                                        }
                                    } catch (error) {
                                        console.error("Failed to get MIME type:", error);
                                    }
                                } else {
                                    try {
                                        const type = await conn.getFile(buffer);
                                        if (/^image\//i.test(type.mime)) {
                                            img = await prepareWAMessageMedia({
                                                image: /^https?:\/\//i.test(buffer) ?
                                                    {
                                                        url: buffer,
                                                    } :
                                                    type && type?.data,
                                            }, {
                                                upload: conn.waUploadToServer,
                                                ...options,
                                            },);
                                        } else if (/^video\//i.test(type.mime)) {
                                            video = await prepareWAMessageMedia({
                                                video: /^https?:\/\//i.test(buffer) ?
                                                    {
                                                        url: buffer,
                                                    } :
                                                    type && type?.data,
                                            }, {
                                                upload: conn.waUploadToServer,
                                                ...options,
                                            },);
                                        }
                                    } catch (error) {
                                        console.error("Failed to get file type:", error);
                                    }
                                }
                                const dynamicButtons = buttons.map((btn) => ({
                                    name: "quick_reply",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: btn[0],
                                        id: btn[1],
                                    }),
                                }));
                                /*dynamicButtons.push(
              (copy && (typeof copy === 'string' || typeof copy === 'number')) && {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                  display_text: 'Copy',
                  copy_code: copy
                })
              });*/
                                copy = Array.isArray(copy) ? copy : [copy];
                                copy.map((copy) => {
                                    dynamicButtons.push({
                                        name: "cta_copy",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: "Copy",
                                            copy_code: copy[0],
                                        }),
                                    });
                                });
                                urls?.forEach((url) => {
                                    dynamicButtons.push({
                                        name: "cta_url",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: url[0],
                                            url: url[1],
                                            merchant_url: url[1],
                                        }),
                                    });
                                });

                                list?.forEach((lister) => {
                                    dynamicButtons.push({
                                        name: "single_select",
                                        buttonParamsJson: JSON.stringify({
                                            title: lister[0],
                                            sections: lister[1],
                                        }),
                                    });
                                });

                                /*list?.forEach(lister => {
    dynamicButtons.push({
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
            title: lister[0],
            sections: [{
            title: lister[1],
                rows: [{
                    header: lister[2],
                    title: lister[3],
                    description: lister[4], 
                    id: lister[5]
                }]
            }]
        })
    });
});*/

                                return {
                                    body: proto.Message.InteractiveMessage.Body.create({
                                        text: text || "",
                                    }),
                                    footer: proto.Message.InteractiveMessage.Footer.create({
                                        text: footer || wm,
                                    }),
                                    header: proto.Message.InteractiveMessage.Header.create({
                                        title: text2,
                                        subtitle: text || "",
                                        hasMediaAttachment: img?.imageMessage || video?.videoMessage ? true : false,
                                        imageMessage: img?.imageMessage || null,
                                        videoMessage: video?.videoMessage || null,
                                    }),
                                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                        buttons: dynamicButtons.filter(Boolean),
                                        messageParamsJson: "",
                                    },),
                                    // Fix: cachear parseMention en card (antes se llamaba 3 veces)
                                    ...await (async () => {
                                        const _mentions = typeof text === "string" ? await conn.parseMention(text || "@0", jid) : [];
                                        return Object.assign({
                                            mentions: _mentions,
                                            contextInfo: {
                                                mentionedJid: _mentions,
                                                groupMentions: [],
                                                mentions: _mentions,
                                            },
                                        }, {
                                            ...(options || {}),
                                            ...(conn.temareply?.contextInfo && {
                                                contextInfo: {
                                                    ...(options?.contextInfo || {}),
                                                    ...conn.temareply?.contextInfo,
                                                    externalAdReply: {
                                                        ...(options?.contextInfo?.externalAdReply || {}),
                                                        ...conn.temareply?.contextInfo?.externalAdReply,
                                                    },
                                                },
                                            }),
                                        });
                                    })(),
                                };
                            },
                        ),
                    );
                    const interactiveMessage = proto.Message.InteractiveMessage.create({
                        body: proto.Message.InteractiveMessage.Body.create({
                            text: text || "",
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.create({
                            text: footer || wm,
                        }),
                        header: proto.Message.InteractiveMessage.Header.create({
                            title: text || "",
                            subtitle: text || "",
                            hasMediaAttachment: false,
                        }),
                        carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
                            cards,
                        }),
                        // Fix: cachear parseMention en carousel wrapper (antes se llamaba 2 veces)
                        ...await (async () => {
                            const _mentions = typeof text === "string" ? await conn.parseMention(text || "@0", jid) : [];
                            return Object.assign({
                                mentions: _mentions,
                                contextInfo: {
                                    mentionedJid: _mentions,
                                },
                            }, {
                                ...(options || {}),
                                ...(conn.temareply?.contextInfo && {
                                    contextInfo: {
                                        ...(options?.contextInfo || {}),
                                        ...conn.temareply?.contextInfo,
                                        externalAdReply: {
                                            ...(options?.contextInfo?.externalAdReply || {}),
                                            ...conn.temareply?.contextInfo?.externalAdReply,
                                        },
                                    },
                                }),
                            });
                        })(),
                    });
                    const messageContent = proto.Message.create({
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadata: {},
                                    deviceListMetadataVersion: 2,
                                },
                                interactiveMessage,
                            },
                        },
                    });
                    const msgs = await generateWAMessageFromContent(jid, messageContent, {
                        userJid: conn.user.jid,
                        quoted: quoted,
                        upload: conn.waUploadToServer,
                        ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
                    });
                    await conn.relayMessage(jid, msgs.message, {
                        messageId: msgs.key.id,
                    });
                } else {
                    await conn.sendNCarousel(jid, ...messages[0], quoted, options);
                }
            },
        },

        // sendButton: {
        /**
         * send Button
         * @param {String} jid
         * @param {String} text
         * @param {String} footer
         * @param {Buffer} buffer
         * @param {String[] | String[][]} buttons
         * @param {import("baileys").proto.WebMessageInfo} quoted
         * @param {Object} options
         */
        /*   async value(jid, text = '', footer = '', buffer, buttons, quoted, options) {
            let type;
            if (Array.isArray(buffer)) (options = quoted, quoted = buttons, buttons = buffer, buffer = null);
            else if (buffer) {
              try {
                (type = await conn.getFile(buffer), buffer = type.data);
              } catch {
                buffer = null;
              }
            }
            if (!Array.isArray(buttons[0]) && typeof buttons[0] === 'string') buttons = [buttons];
            if (!options) options = {};
            const message = {
              ...options,
              [buffer ? 'caption' : 'text']: text || '',
              footer,
              buttons: buttons.map((btn) => ({
                buttonId: !nullish(btn[1]) && btn[1] || !nullish(btn[0]) && btn[0] || '',
                buttonText: {
                  displayText: !nullish(btn[0]) && btn[0] || !nullish(btn[1]) && btn[1] || '',
                },
              })),
              ...(buffer ?
                            options.asLocation && /image/.test(type.mime) ? {
                              location: {
                                ...options,
                                jpegThumbnail: buffer,
                              },
                            } : {
                              [/video/.test(type.mime) ? 'video' : /image/.test(type.mime) ? 'image' : 'document']: buffer,
                            } : {}),
            };

            return await conn.sendMessage(jid, message, {
              quoted,
              upload: conn.waUploadToServer,
              ...options,
            });
          },
          enumerable: true,
        },*/
        //-- new
        sendButton: {
            async value(
                jid,
                text = "",
                footer = "",
                buffer,
                buttons,
                copy,
                urls,
                quoted,
                options,
            ) {
                let img, video;

                if (/^https?:\/\//i.test(buffer)) {
                    try {
                        // Obtener el tipo MIME de la URL
                        const response = await fetch(buffer);
                        const contentType = response.headers.get("content-type");
                        if (/^image\//i.test(contentType)) {
                            img = await prepareWAMessageMedia({
                                image: {
                                    url: buffer
                                }
                            }, {
                                upload: conn.waUploadToServer
                            },);
                        } else if (/^video\//i.test(contentType)) {
                            video = await prepareWAMessageMedia({
                                video: {
                                    url: buffer
                                }
                            }, {
                                upload: conn.waUploadToServer
                            },);
                        } else {
                            console.error("Tipo MIME no compatible:", contentType);
                        }
                    } catch (error) {
                        console.error("Error al obtener el tipo MIME:", error);
                    }
                } else {
                    try {
                        const type = await conn.getFile(buffer);
                        if (/^image\//i.test(type.mime)) {
                            img = await prepareWAMessageMedia({
                                image: {
                                    url: buffer
                                }
                            }, {
                                upload: conn.waUploadToServer
                            },);
                        } else if (/^video\//i.test(type.mime)) {
                            video = await prepareWAMessageMedia({
                                video: {
                                    url: buffer
                                }
                            }, {
                                upload: conn.waUploadToServer
                            },);
                        }
                    } catch (error) {
                        console.error("Error al obtener el tipo de archivo:", error);
                    }
                }

                const dynamicButtons = buttons.map((btn) => ({
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: btn[0],
                        id: btn[1],
                    }),
                }));

                if (copy && (typeof copy === "string" || typeof copy === "number")) {
                    // Añadir botón de copiar
                    dynamicButtons.push({
                        name: "cta_copy",
                        buttonParamsJson: JSON.stringify({
                            display_text: "Copy",
                            copy_code: copy,
                        }),
                    });
                }

                // Añadir botones de URL
                if (urls && Array.isArray(urls)) {
                    urls.forEach((url) => {
                        dynamicButtons.push({
                            name: "cta_url",
                            buttonParamsJson: JSON.stringify({
                                display_text: url[0],
                                url: url[1],
                                merchant_url: url[1],
                            }),
                        });
                    });
                }

                const interactiveMessage = {
                    body: {
                        text: text
                    },
                    footer: {
                        text: footer
                    },
                    header: {
                        hasMediaAttachment: false,
                        imageMessage: img ? img.imageMessage : null,
                        videoMessage: video ? video.videoMessage : null,
                    },
                    nativeFlowMessage: {
                        buttons: dynamicButtons,
                        messageParamsJson: "",
                    },
                };

                let msgL = generateWAMessageFromContent(
                    jid, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage,
                        },
                    },
                }, {
                    userJid: conn.user.jid,
                    quoted
                },
                );

                return await conn.relayMessage(jid, msgL.message, {
                    messageId: msgL.key.id,
                    ...options,
                });
            },
        },

        sendList: {
            async value(
                jid,
                title,
                text,
                buttonText,
                listSections,
                quoted,
                options = {},
            ) {
                const sections = [...listSections];

                const message = {
                    interactiveMessage: {
                        header: {
                            title: title
                        },
                        body: {
                            text: text
                        },
                        nativeFlowMessage: {
                            buttons: [{
                                name: "single_select",
                                buttonParamsJson: JSON.stringify({
                                    title: buttonText,
                                    sections,
                                }),
                            },],
                            messageParamsJson: "",
                        },
                    },
                };
                await conn.relayMessage(jid, {
                    viewOnceMessage: {
                        message
                    }
                }, {});
            },
        },

        sendEvent: {
            async value(jid, text, des, loc, link, quoted) {
                // 🛡️ BLINDADO: Intenta usar la estructura nativa del fork (ej. sauruslord)
                try {
                    return await conn.sendMessage(jid, {
                        eventMessage: {
                            isCanceled: false,
                            name: text,
                            description: des,
                            location: {
                                degreesLatitude: 0,
                                degreesLongitude: 0,
                                name: loc
                            },
                            joinLink: link,
                            startTime: String(Math.floor(Date.now() / 1000)), // Tiempo actual
                            endTime: String(Math.floor(Date.now() / 1000) + 7200), // +2 horas
                            extraGuestsAllowed: false
                        }
                    }, { quoted: quoted || null });
                } catch (error) {
                    console.error("⚠️ Este fork de Baileys rechazó la creación nativa del Evento. Ignorando fallo:", error.message);
                    return null;
                }
            },
            enumerable: true,
        },

        sendPoll: {
            async value(jid, name = "", optiPoll, options) {
                if (!Array.isArray(optiPoll[0]) && typeof optiPoll[0] === "string")
                    optiPoll = [optiPoll];
                if (!options) options = {};
                const pollMessage = {
                    name: name,
                    options: optiPoll.map((btn) => ({
                        optionName: (!nullish(btn[0]) && btn[0]) || "",
                    })),
                    selectableOptionsCount: 1,
                };
                return conn.relayMessage(
                    jid, {
                    pollCreationMessage: pollMessage
                }, {
                    ...options
                },
                );
            },
        },
        sendHydrated: {
            /**
             * Legacy sendHydrated — migrado a Native Flow Buttons.
             * Mantiene la misma firma para retrocompatibilidad.
             * Los templateButtons antiguos (urlButton, callButton, quickReplyButton)
             * ya no funcionan en WhatsApp — se convierten a Native Flow.
             */
            async value(
                jid,
                text = "",
                footer = "",
                buffer,
                url,
                urlText,
                call,
                callText,
                buttons,
                quoted,
                options,
            ) {
                // Rearrange args if buffer is actually a string (URL/text)
                if (
                    buffer &&
                    !Buffer.isBuffer(buffer) &&
                    (typeof buffer === "string" || Array.isArray(buffer))
                ) {
                    options = quoted;
                    quoted = buttons;
                    buttons = callText;
                    callText = call;
                    call = urlText;
                    urlText = url;
                    url = buffer;
                    buffer = null;
                }
                if (!options) options = {};

                // Build Native Flow buttons from legacy params
                const nativeButtons = [];
                if (buttons && buttons.length) {
                    const btnArr = Array.isArray(buttons[0]) ? buttons : [buttons];
                    for (const [displayText, id] of btnArr) {
                        nativeButtons.push({
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: displayText || id || '',
                                id: id || displayText || ''
                            })
                        });
                    }
                }
                if (url) {
                    const urls = Array.isArray(url) ? url : [url];
                    const texts = Array.isArray(urlText) ? urlText : [urlText];
                    for (let i = 0; i < urls.length; i++) {
                        if (urls[i]) {
                            nativeButtons.push({
                                name: 'cta_url',
                                buttonParamsJson: JSON.stringify({
                                    display_text: texts[i] || urls[i] || 'Link',
                                    url: urls[i],
                                    merchant_url: urls[i]
                                })
                            });
                        }
                    }
                }

                // Resolve media buffer if provided
                let mediaOpts = {};
                if (buffer) {
                    try {
                        const file = await conn.getFile(buffer);
                        buffer = file.data;
                        if (/image/i.test(file.mime)) mediaOpts = { image: buffer };
                        else if (/video/i.test(file.mime)) mediaOpts = { video: buffer };
                    } catch { /* ignore media errors */ }
                }

                return conn.sendButtons(jid, {
                    text: text || '',
                    footer: footer || '',
                    buttons: nativeButtons,
                    ...mediaOpts
                }, quoted, options);
            },
            enumerable: true,
        },
        sendHydrated2: {
            /**
             * Legacy sendHydrated2 — migrado a Native Flow Buttons.
             * Soporta 2 URLs. Redirige a sendHydrated que ya usa Native Flow.
             */
            async value(
                jid,
                text = "",
                footer = "",
                buffer,
                url,
                urlText,
                url2,
                urlText2,
                buttons,
                quoted,
                options,
            ) {
                // Merge both URLs into a single array
                const allUrls = [
                    ...(url ? (Array.isArray(url) ? url : [url]) : []),
                    ...(url2 ? (Array.isArray(url2) ? url2 : [url2]) : [])
                ];
                const allUrlTexts = [
                    ...(urlText ? (Array.isArray(urlText) ? urlText : [urlText]) : []),
                    ...(urlText2 ? (Array.isArray(urlText2) ? urlText2 : [urlText2]) : [])
                ];
                return conn.sendHydrated(
                    jid, text, footer, buffer,
                    allUrls, allUrlTexts,
                    null, null, // call/callText not used in v2
                    buttons, quoted, options
                );
            },
            enumerable: true,
        },
        cMod: {
            /**
             * cMod
             * @param {String} jid
             * @param {import("baileys").proto.WebMessageInfo} message
             * @param {String} text
             * @param {String} sender
             * @param {*} options
             * @returns
             */
            value(jid, message, text = "", sender = conn.user.jid, options = {}) {
                if (options.mentions && !Array.isArray(options.mentions))
                    options.mentions = [options.mentions];
                const copy = message.toJSON();
                delete copy.message.messageContextInfo;
                delete copy.message.senderKeyDistributionMessage;
                const mtype = Object.keys(copy.message)[0];
                const msg = copy.message;
                const content = msg[mtype];
                if (typeof content === "string") msg[mtype] = text || content;
                else if (content.caption) content.caption = text || content.caption;
                else if (content.text) content.text = text || content.text;
                if (typeof content !== "string") {
                    msg[mtype] = {
                        ...content,
                        ...options
                    };
                    msg[mtype].contextInfo = {
                        ...(content.contextInfo || {}),
                        mentionedJid: options.mentions || content.contextInfo?.mentionedJid || [],
                    };
                }
                if (copy.participant)
                    sender = copy.participant = sender || copy.participant;
                else if (copy.key.participant)
                    sender = copy.key.participant = sender || copy.key.participant;
                if (copy.key.remoteJid.includes("@s.whatsapp.net"))
                    sender = sender || copy.key.remoteJid;
                else if (copy.key.remoteJid.includes("@broadcast"))
                    sender = sender || copy.key.remoteJid;
                copy.key.remoteJid = jid;
                copy.key.fromMe = areJidsSameUser(sender, conn.user.id) || false;
                return proto.WebMessageInfo.create(copy);
            },
            enumerable: true,
        },
        copyNForward: {
            /**
             * Exact Copy Forward
             * @param {String} jid
             * @param {import("baileys").proto.WebMessageInfo} message
             * @param {Boolean|Number} forwardingScore
             * @param {Object} options
             */
            async value(jid, message, forwardingScore = true, options = {}) {
                let vtype;
                if (options.readViewOnce && message.message.viewOnceMessage?.message) {
                    vtype = Object.keys(message.message.viewOnceMessage.message)[0];
                    delete message.message.viewOnceMessage.message[vtype].viewOnce;
                    message.message = proto.Message.create(
                        JSON.parse(JSON.stringify(message.message.viewOnceMessage.message)),
                    );
                    message.message[vtype].contextInfo =
                        message.message.viewOnceMessage.contextInfo;
                }
                const mtype = Object.keys(message.message)[0];
                let m = generateForwardMessageContent(message, !!forwardingScore);
                const ctype = Object.keys(m)[0];
                if (
                    forwardingScore &&
                    typeof forwardingScore === "number" &&
                    forwardingScore > 1
                )
                    m[ctype].contextInfo.forwardingScore += forwardingScore;
                m[ctype].contextInfo = {
                    ...(message.message[mtype].contextInfo || {}),
                    ...(m[ctype].contextInfo || {}),
                };
                m = generateWAMessageFromContent(jid, m, {
                    ...options,
                    userJid: conn.user.jid,
                });
                await conn.relayMessage(jid, m.message, {
                    messageId: m.key.id,
                    additionalAttributes: {
                        ...options
                    },
                });
                return m;
            },
            enumerable: true,
        },
        fakeReply: {
            /**
             * Fake Replies
             * @param {String} jid
             * @param {String|Object} text
             * @param {String} fakeJid
             * @param {String} fakeText
             * @param {String} fakeGroupJid
             * @param {String} options
             */
            value(
                jid,
                text = "",
                fakeJid = this.user.jid,
                fakeText = "",
                fakeGroupJid,
                options,
            ) {
                return conn.reply(jid, text, {
                    key: {
                        fromMe: areJidsSameUser(fakeJid, conn.user.id),
                        participant: fakeJid,
                        ...(fakeGroupJid ? {
                            remoteJid: fakeGroupJid
                        } : {}),
                    },
                    message: {
                        conversation: fakeText
                    },
                    ...options,
                });
            },
        },
        downloadM: {
            /**
             * Download media message
             * @param {Object} m
             * @param {String} type
             * @param {fs.PathLike | fs.promises.FileHandle} saveToFile
             * @return {Promise<fs.PathLike | fs.promises.FileHandle | Buffer>}
             */
            async value(m, type, saveToFile) {
                let filename;
                if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
                const stream = await downloadContentFromMessage(m, type);
                // Fix P1-1: usar array-push + single concat en vez de O(n²)
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                if (saveToFile) ({
                    filename
                } = await conn.getFile(buffer, true));
                return saveToFile && fs.existsSync(filename) ? filename : buffer;
            },
            enumerable: true,
        },
        /*parseMention: {
            async value(text = "", groupChatId = null) {
                try {
                    const esNumeroValido = (numero) => {
                        const len = numero.length;
                        if (len < 8 || len > 15) return false;
                        const codigosValidos = ["521", "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98", "211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266", "267", "268", "269", "290", "291", "297", "298", "299", "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374", "375", "376", "377", "378", "379", "380", "381", "382", "383", "385", "386", "387", "389", "420", "421", "423", "500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "590", "591", "592", "593", "594", "595", "596", "597", "598", "599", "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691", "692", "850", "852", "853", "855", "856", "880", "886", "960", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975", "976", "977", "978", "979", "992", "993", "994", "995", "996", "998"];
                        const valido = codigosValidos.some(codigo => numero.startsWith(codigo));
                        if (!valido) return false;
                        const numeroLimpio = numero.replace(/^(\d+)/, '').replace('@', '');
                        if (!/^\d+$/.test(numeroLimpio)) return false;
                        return true;
                    };
                    const resolveLidFromCache = async (jid, groupChatId) => {
                        if (!jid || !jid.toString().endsWith('@lid')) {
                            return jid?.includes('@') ? jid : `${jid}@s.whatsapp.net`;
                        }
                        if (!groupChatId?.endsWith('@g.us')) {
                            return jid;
                        }
                        const lidKey = jid.split('@')[0];
                        if (global.lidResolver) {
                            const userInfo = global.lidResolver.getUserInfo(lidKey);
                            if (userInfo && userInfo.jid && !userInfo.jid.endsWith('@lid') && !userInfo.notFound && !userInfo.error) {
                                return userInfo.jid;
                            }
                            try {
                                const resolvedJid = await global.lidResolver.resolveLid(jid, groupChatId, 2);
                                if (resolvedJid && !resolvedJid.endsWith('@lid')) {
                                    return resolvedJid;
                                }
                            } catch (error) {
                                console.log(`[parseMention] Error resolviendo ${jid}:`, error.message);
                            }
                        }
                        if (typeof String.prototype.resolveLidToRealJid === 'function') {
                            try {
                                const resolved = await String.prototype.resolveLidToRealJid.call(
                                    jid, 
                                    groupChatId, 
                                    conn || this, 
                                    2, 
                                    1000
                                );
                                if (resolved && !resolved.endsWith('@lid')) {
                                    return resolved;
                                }
                            } catch (error) {
                                console.log(`[parseMention] Error en fallback para ${jid}:`, error.message);
                            }
                        }
                        return jid;
                    };
                    const mencionesEncontradas = text.match(/@(\d{5,20})/g) || [];
                    const mentions = [];
                    for (const m of mencionesEncontradas) {
                        const numero = m.substring(1);
                        if (esNumeroValido(numero)) {
                            mentions.push(`${numero}@s.whatsapp.net`);
                        } else {
                            const lidJid = `${numero}@lid`;
                            const resolved = await resolveLidFromCache(lidJid, groupChatId);
                            mentions.push(resolved);
                        }
                    }
                    return [...new Set(mentions.filter(mention => mention && mention.length > 0))];
                } catch (error) {
                    console.error('[ERROR] En parseMention:', error.stack || error);
                    return [];
                }
            },
            enumerable: true,
        },*/
        parseMention: {
            value(text = "") {
                try {
                    const raw = text.match(/@(\d{5,20})/g) || []
                    const ids = raw.map(m => m.substring(1))
                    const validJids = []

                    for (const numero of ids) {
                        const len = numero.length
                        if (len >= 8 && len <= 15) {
                            validJids.push(`${numero}@s.whatsapp.net`)
                        } else if (len > 15 && len <= 20) {
                            validJids.push(`${numero}@lid`)
                        }
                    }
                    return [...new Set(validJids)]
                } catch (error) {
                    console.error("[parseMention] Error:", error)
                    return []
                }
            },
            enumerable: true,
        },
        getName: {
            /**
             * Get name from jid
             * @param {String} jid
             * @param {Boolean} withoutContact
             */
            value(jid = "", withoutContact = false) {
                try {
                    if (
                        !jid ||
                        typeof jid !== "string" ||
                        jid.includes("No SenderKeyRecord")
                    )
                        return "";
                    jid = conn.decodeJid(jid);
                    withoutContact = conn.withoutContact || withoutContact;
                    let v;
                    if (jid.endsWith("@g.us")) {
                        return new Promise(async (resolve) => {
                            try {
                                v = conn.chats[jid] || {};
                                if (!(v.name || v.subject))
                                    v = global.groupMetadataCache?.get(jid) || await conn?.groupMetadata(jid).catch(() => ({}));
                                resolve(
                                    v.name ||
                                    v.subject ||
                                    PhoneNumber(
                                        "+" + jid.replace("@s.whatsapp.net", ""),
                                    ).getNumber("international"),
                                );
                            } catch (e) {
                                resolve("");
                            }
                        });
                    } else {
                        v =
                            jid === "0@s.whatsapp.net" ?
                                {
                                    jid,
                                    vname: "WhatsApp"
                                } :
                                areJidsSameUser(jid, conn.user.id) ?
                                    conn.user :
                                    conn.chats[jid] || {};
                        return (
                            (withoutContact ? "" : v.name) ||
                            v.subject ||
                            v.vname ||
                            v.notify ||
                            v.verifiedName ||
                            PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber(
                                "international",
                            )
                        );
                    }
                } catch (error) {
                    return "";
                }
            },
        },
        loadMessage: {
            /**
             *
             * @param {String} messageID
             * @returns {import("baileys").proto.WebMessageInfo}
             */
            value(messageID) {
                return Object.entries(conn.chats)
                    .filter(([_, {
                        messages
                    }]) => typeof messages === "object")
                    .find(([_, {
                        messages
                    }]) =>
                        Object.entries(messages).find(
                            ([k, v]) => k === messageID || v.key?.id === messageID,
                        ),
                    )?.[1].messages?.[messageID];
            },
            enumerable: true,
        },
        sendGroupV4Invite: {
            /**
             * sendGroupV4Invite
             * @param {String} jid
             * @param {*} participant
             * @param {String} inviteCode
             * @param {Number} inviteExpiration
             * @param {String} groupName
             * @param {String} caption
             * @param {Buffer} jpegThumbnail
             * @param {*} options
             */
            async value(
                jid,
                participant,
                inviteCode,
                inviteExpiration,
                groupName = "unknown subject",
                caption = "Invitation to join my WhatsApp group",
                jpegThumbnail,
                options = {},
            ) {
                const msg = proto.Message.create({
                    groupInviteMessage: proto.GroupInviteMessage.create({
                        inviteCode,
                        inviteExpiration: parseInt(inviteExpiration) ||
                            +new Date(new Date() + 3 * 86400000),
                        groupJid: jid,
                        groupName: (groupName ? groupName : await conn.getName(jid)) || null,
                        jpegThumbnail: Buffer.isBuffer(jpegThumbnail) ?
                            jpegThumbnail :
                            null,
                        caption,
                    }),
                });
                const message = generateWAMessageFromContent(participant, msg, options);
                await conn.relayMessage(participant, message.message, {
                    messageId: message.key.id,
                    additionalAttributes: {
                        ...options
                    },
                });
                return message;
            },
            enumerable: true,
        },
        processMessageStubType: {
            /**
             * to process MessageStubType
             * @param {import("baileys").proto.WebMessageInfo} m
             */
            async value(m) {
                if (!m.messageStubType) return;
                const chat = conn.decodeJid(
                    m.key.remoteJid ||
                    m.message?.senderKeyDistributionMessage?.groupId ||
                    "",
                );
                if (!chat || chat === "status@broadcast") return;
                const emitGroupUpdate = (update) => {
                    conn.ev.emit("groups.update", [{
                        id: chat,
                        ...update
                    }]);
                };
                switch (m.messageStubType) {
                    case WAMessageStubType.REVOKE:
                    case WAMessageStubType.GROUP_CHANGE_INVITE_LINK:
                        emitGroupUpdate({
                            revoke: m.messageStubParameters?.[0]
                        });
                        break;
                    case WAMessageStubType.GROUP_CHANGE_ICON:
                        emitGroupUpdate({
                            icon: m.messageStubParameters?.[0]
                        });
                        break;
                    default: {
                        try {
                            const raw = m.messageStubParameters?.[0];
                            if (raw && typeof raw === 'string' && raw.includes('@lid')) {
                                const data = JSON.parse(raw);
                                if (data?.id?.endsWith('@lid') && data?.phoneNumber?.endsWith('@s.whatsapp.net')) {
                                    global.db.data.lidmap = global.db.data.lidmap || {};
                                    global.db.data.lidmap[data.id] = data.phoneNumber;
                                }
                            }
                        } catch (e) {}
                        break;
                    }
                }
                const isGroup = chat.endsWith("@g.us");
                if (!isGroup) return;
                let chats = conn.chats[chat];
                if (!chats) chats = conn.chats[chat] = {
                    id: chat
                };
                chats.isChats = true;
                // FIX: cache-first — evita query directa a WA en cada evento de grupo
                let metadata = global.groupMetadataCache?.get(chat)
                if (!metadata) {
                    metadata = await conn.groupMetadata(chat).catch((_) => null);
                    if (metadata) global.groupMetadataCache?.set(chat, metadata);
                }
                if (!metadata) return;
                chats.subject = metadata.subject;
                chats.metadata = metadata;
            },
        },
        insertAllGroup: {
            async value() {
                const groups =
                    (await conn.groupFetchAllParticipating().catch((_) => null)) || {};
                for (const group in groups) {
                    conn.chats[group] = {
                        ...(conn.chats[group] || {}),
                        id: group,
                        subject: groups[group].subject,
                        isChats: true,
                        metadata: groups[group],
                    };
                    // FIX: poblar groupMetadataCache para evitar queries futuras
                    if (global.groupMetadataCache) global.groupMetadataCache.set(group, groups[group]);
                }
                return conn.chats;
            },
        },
        pushMessage: {
            /**
             * pushMessage
             * @param {import("baileys").proto.WebMessageInfo[]} m
             */
            async value(m) {
                if (!m) return;
                if (!Array.isArray(m)) m = [m];
                for (const message of m) {
                    try {
                        // if (!(message instanceof proto.WebMessageInfo)) continue // https://github.com/adiwajshing/Baileys/pull/696/commits/6a2cb5a4139d8eb0a75c4c4ea7ed52adc0aec20f
                        if (!message) continue;
                        if (
                            message.messageStubType &&
                            message.messageStubType != WAMessageStubType.CIPHERTEXT
                        )
                            conn.processMessageStubType(message).catch(console.error);
                        const _mtype = Object.keys(message.message || {});
                        const mtype =
                            (!["senderKeyDistributionMessage", "messageContextInfo"].includes(
                                _mtype[0],
                            ) &&
                                _mtype[0]) ||
                            (_mtype.length >= 3 &&
                                _mtype[1] !== "messageContextInfo" &&
                                _mtype[1]) ||
                            _mtype[_mtype.length - 1];
                        const chat = conn.decodeJid(
                            message.key.remoteJid ||
                            message.message?.senderKeyDistributionMessage?.groupId ||
                            "",
                        );
                        if (message.message?.[mtype]?.contextInfo?.quotedMessage) {
                            /**
                             * @type {import("baileys").proto.IContextInfo}
                             */
                            const context = message.message[mtype].contextInfo;
                            let participant = conn.decodeJid(context.participant);
                            const remoteJid = conn.decodeJid(
                                context.remoteJid || participant,
                            );
                            /**
                             * @type {import("baileys").proto.IMessage}
                             *
                             */
                            const quoted = message.message[mtype].contextInfo.quotedMessage;
                            if (remoteJid && remoteJid !== "status@broadcast" && quoted) {
                                let qMtype = Object.keys(quoted)[0];
                                if (qMtype == "conversation") {
                                    quoted.extendedTextMessage = {
                                        text: quoted[qMtype]
                                    };
                                    delete quoted.conversation;
                                    qMtype = "extendedTextMessage";
                                }
                                if (!quoted[qMtype].contextInfo)
                                    quoted[qMtype].contextInfo = {};
                                quoted[qMtype].contextInfo.mentionedJid =
                                    context.mentionedJid ||
                                    quoted[qMtype].contextInfo.mentionedJid || [];
                                const isGroup = remoteJid.endsWith("g.us");
                                if (isGroup && !participant) participant = remoteJid;
                                const qM = {
                                    key: {
                                        remoteJid,
                                        fromMe: areJidsSameUser(conn.user.jid, remoteJid),
                                        id: context.stanzaId,
                                        participant,
                                    },
                                    message: JSON.parse(JSON.stringify(quoted)),
                                    ...(isGroup ? {
                                        participant
                                    } : {}),
                                };
                                let qChats = conn.chats[participant];
                                if (!qChats)
                                    qChats = conn.chats[participant] = {
                                        id: participant,
                                        isChats: !isGroup,
                                    };
                                if (!qChats.messages) qChats.messages = {};
                                if (!qChats.messages[context.stanzaId] && !qM.key.fromMe)
                                    qChats.messages[context.stanzaId] = qM;
                                let qChatsMessages;
                                if (
                                    (qChatsMessages = Object.entries(qChats.messages)).length > 40
                                )
                                    qChats.messages = Object.fromEntries(
                                        qChatsMessages.slice(30, qChatsMessages.length),
                                    ); // maybe avoid memory leak
                            }
                        }
                        if (!chat || chat === "status@broadcast") continue;
                        const isGroup = chat.endsWith("@g.us");
                        let chats = conn.chats[chat];
                        if (!chats) {
                            if (isGroup) await conn.insertAllGroup().catch(console.error);
                            chats = conn.chats[chat] = {
                                id: chat,
                                isChats: true,
                                ...(conn.chats[chat] || {}),
                            };
                        }
                        let metadata;
                        let sender;
                        if (isGroup) {
                            if (!chats.subject || !chats.metadata) {
                                // FIX: cache-first — evita query directa a WA en cada pushMessage
                                metadata = global.groupMetadataCache?.get(chat) ||
                                    (await conn.groupMetadata(chat).catch((_) => ({}))) || {};
                                if (metadata?.subject) global.groupMetadataCache?.set(chat, metadata);
                                if (!chats.subject) chats.subject = metadata.subject || "";
                                if (!chats.metadata) chats.metadata = metadata;
                            }
                            sender = conn.decodeJid(
                                (message.key?.fromMe && conn.user.id) ||
                                message.participant ||
                                message.key?.participant ||
                                chat ||
                                "",
                            );
                            if (sender !== chat) {
                                let chats = conn.chats[sender];
                                if (!chats) chats = conn.chats[sender] = {
                                    id: sender
                                };
                                if (!chats.name)
                                    chats.name = message.pushName || chats.name || "";
                            }
                        } else if (!chats.name)
                            chats.name = message.pushName || chats.name || "";
                        if (
                            ["senderKeyDistributionMessage", "messageContextInfo"].includes(
                                mtype,
                            )
                        )
                            continue;
                        chats.isChats = true;
                        if (!chats.messages) chats.messages = {};
                        const fromMe =
                            message.key.fromMe ||
                            areJidsSameUser(sender || chat, conn.user.id);
                        if (
                            !["protocolMessage"].includes(mtype) &&
                            !fromMe &&
                            message.messageStubType != WAMessageStubType.CIPHERTEXT &&
                            message.message
                        ) {
                            delete message.message.messageContextInfo;
                            delete message.message.senderKeyDistributionMessage;
                            chats.messages[message.key.id] = JSON.parse(
                                JSON.stringify(message, null, 2),
                            );
                            let chatsMessages;
                            if ((chatsMessages = Object.entries(chats.messages)).length > 40)
                                chats.messages = Object.fromEntries(
                                    chatsMessages.slice(30, chatsMessages.length),
                                );
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            },
        },
        serializeM: {
            /**
             * Serialize Message, so it easier to manipulate
             * @param {import("baileys").proto.WebMessageInfo} m
             */
            value(m) {
                return smsg(conn, m);
            },
        },
        ...(typeof conn.chatRead !== "function" ?
            {
                chatRead: {
                    /**
                     * Read message
                     * @param {String} jid
                     * @param {String|undefined|null} participant
                     * @param {String} messageID
                     */
                    value(jid, participant = conn.user.jid, messageID) {
                        return conn.sendReadReceipt(jid, participant, [messageID]);
                    },
                    enumerable: true,
                },
            } :
            {}),
        ...(typeof conn.setStatus !== "function" ?
            {
                setStatus: {
                    /**
                     * setStatus bot
                     * @param {String} status
                     */
                    value(status) {
                        return conn.query({
                            tag: "iq",
                            attrs: {
                                to: S_WHATSAPP_NET,
                                type: "set",
                                xmlns: "status",
                            },
                            content: [{
                                tag: "status",
                                attrs: {},
                                content: Buffer.from(status, "utf-8"),
                            },],
                        });
                    },
                    enumerable: true,
                },
            } :
            {}),
        // ── Baileys v7 Feature Methods ──────────────────────────────────────
        editMessage: {
            /**
             * Edit an already-sent message.
             * @param {string} jid - Chat JID
             * @param {object} oldKey - Key of the message to edit
             * @param {string} newText - New text
             */
            async value(jid, oldKey, newText) {
                if (!oldKey?.id) throw new Error('editMessage: key requerida');
                return await conn.sendMessage(jid, { edit: oldKey, text: newText });
            },
            enumerable: true,
        },
        sendStatusUpdate: {
            /**
             * Publish a status/story update to status@broadcast.
             * @param {object} content - Message content
             * @param {object} options - statusJidList, backgroundColor, font, etc.
             */
            async value(content, options = {}) {
                return await conn.sendMessage('status@broadcast', content, {
                    statusJidList: options.statusJidList,
                    backgroundColor: options.backgroundColor,
                    font: options.font,
                    ...options
                });
            },
            enumerable: true,
        },
        setDisappearing: {
            /**
             * Set disappearing messages for a chat.
             * @param {string} jid - Chat JID
             * @param {number} duration - Duration in seconds (0 = off)
             */
            async value(jid, duration) {
                const seconds = Number(duration) || 0;
                return await conn.sendMessage(jid, {
                    disappearingMessagesInChat: seconds === 0 ? false : seconds
                });
            },
            enumerable: true,
        },
        addChatLabel: {
            /**
             * Add a label to a chat (WhatsApp Business).
             * @param {string} jid - Chat JID
             * @param {string} labelId - Label ID
             */
            async value(jid, labelId) {
                return await conn.chatModify({ addChatLabel: { labelId: String(labelId) } }, jid);
            },
            enumerable: true,
        },
        removeChatLabel: {
            /**
             * Remove a label from a chat (WhatsApp Business).
             * @param {string} jid - Chat JID
             * @param {string} labelId - Label ID
             */
            async value(jid, labelId) {
                return await conn.chatModify({ removeChatLabel: { labelId: String(labelId) } }, jid);
            },
            enumerable: true,
        },
        // ────────────────────────────────────────────────────────────────────
    });
    if (sock.user?.id) sock.user.jid = sock.decodeJid(sock.user.id);
    store.bind(sock);
    return sock;
}
/**
 * Serialize Message
 * @param {ReturnType<typeof makeWASocket>} conn
 * @param {import("baileys").proto.WebMessageInfo} m
 * @param {Boolean} hasParent
 */
export function smsg(conn, m, hasParent) {
    if (!m) return m;
    const M = proto.WebMessageInfo;
    try {
        m = M.create(m);
        m.conn = conn;
        let protocolMessageKey;
        if (m.message) {
            if (m.mtype == "protocolMessage" && m.msg?.key) {
                protocolMessageKey = m.msg.key;
                if (protocolMessageKey.remoteJid === "status@broadcast") {
                    protocolMessageKey.remoteJid = m.chat || "";
                }
                if (
                    !protocolMessageKey.participant ||
                    protocolMessageKey.participant === "status_me"
                ) {
                    protocolMessageKey.participant =
                        typeof m.sender === "string" ? m.sender : "";
                }
                const decodedParticipant =
                    conn?.decodeJid?.(protocolMessageKey.participant) || "";
                protocolMessageKey.fromMe =
                    decodedParticipant === (conn?.user?.id || "");
                if (
                    !protocolMessageKey.fromMe &&
                    protocolMessageKey.remoteJid === (conn?.user?.id || "")
                ) {
                    protocolMessageKey.remoteJid =
                        typeof m.sender === "string" ? m.sender : "";
                }
            }
            if (m.quoted && !m.quoted.mediaMessage) {
                delete m.quoted.download;
            }
        }
        if (!m.mediaMessage) {
            delete m.download;
        }
        if (protocolMessageKey && m.mtype == "protocolMessage") {
            try {
                conn.ev.emit("message.delete", protocolMessageKey);
            } catch (e) {
                console.error("Error al emitir message.delete:", e);
            }
        }
        return m;
    } catch (e) {
        console.error("Error en smsg:", e);
        return m;
    }
}

// https://github.com/Nurutomo/wabot-aq/issues/490
// Fix 2025 - @BrunoSobrino - LID Resolved
export function serialize() {
    const MediaType = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage"];
    const safeEndsWith = (str, suffix) =>
        typeof str === "string" && str.endsWith(suffix);
    const safeDecodeJid = (jid, conn) => {
        try {
            if (!jid || typeof jid !== "string") return "";
            return conn?.decodeJid?.(jid) || jid;
        } catch (e) {
            console.error("Error en safeDecodeJid:", e);
            return "";
        }
    };
    const safeSplit = (str, separator) =>
        typeof str === "string" ? str.split(separator) : [];
    const normalizeMentionedJid = (value) => {
        if (!value) return [];
        const list = Array.isArray(value) ? value : [value];
        return [...new Set(list.map((user) => {
            if (!user) return "";
            if (typeof user === "string") return user;
            if (typeof user === "number") return `${user}@s.whatsapp.net`;
            if (typeof user !== "object") return "";
            if (user.user && user.server) return `${user.user}@${user.server}`;
            return user.jid || user.id || user.lid || user.phoneNumber || user.participant || user.sender || "";
        }).filter((jid) => typeof jid === "string" && jid.includes("@")))];
    };

    return Object.defineProperties(proto.WebMessageInfo.prototype, {
        conn: {
            value: undefined,
            enumerable: false,
            writable: true,
        },
        id: {
            get() {
                try {
                    return this.key?.id || "";
                } catch (e) {
                    console.error("Error en id getter:", e);
                    return "";
                }
            },
            enumerable: true,
        },
        isBaileys: {
            get() {
                try {
                    const userId = this.conn?.user?.id || "";
                    const sender = this.sender || "";
                    const messageId = this.id || "";
                    const isFromBot = this?.fromMe === true || areJidsSameUser(userId, sender);
                    if (!isFromBot) return false;
                    const baileysStarts = ['NJX-', 'Lyru-', 'META-', 'EvoGlobalBot-', 'FizzxyTheGreat-', 'BAE5', '3EB0', 'B24E', '8SCO', 'SUKI', 'MYSTIC-'];
                    const hasKnownPrefix = baileysStarts.some(prefix => messageId.startsWith(prefix));
                    const isSukiPattern = /^SUKI[A-F0-9]+$/.test(messageId);
                    const isMysticPattern = /^MYSTIC[A-F0-9]+$/.test(messageId);
                    return isMysticPattern || isSukiPattern || hasKnownPrefix || false;
                } catch (e) {
                    console.error("Error en isBaileys getter:", e);
                    return false;
                }
            },
            enumerable: true,
        },
        chat: {
            get() {
                try {
                    const senderKeyDistributionMessage =
                        this.message?.senderKeyDistributionMessage?.groupId;
                    const rawJid =
                        this.key?.remoteJid ||
                        (senderKeyDistributionMessage &&
                            senderKeyDistributionMessage !== "status@broadcast") ||
                        "";
                    return safeDecodeJid(rawJid, this.conn);
                } catch (e) {
                    console.error("Error en chat getter:", e);
                    return "";
                }
            },
            enumerable: true,
        },
        isGroup: {
            get() {
                try {
                    return safeEndsWith(this.chat, "@g.us");
                } catch (e) {
                    console.error("Error en isGroup getter:", e);
                    return false;
                }
            },
            enumerable: true,
        },
        sender: {
            get() {
                try {
                    return this.conn?.decodeJid(this.key?.fromMe && this.conn?.user.id || this.participant || this.key.participant || this.chat || '');
                } catch (e) {
                    console.error("Error en sender getter:", e);
                    return "";
                }
            },
            enumerable: true,
        },
        fromMe: {
            get() {
                try {
                    const userId = this.conn?.user?.jid || "";
                    const sender = this.sender || "";
                    return this.key?.fromMe || areJidsSameUser(userId, sender) || false;
                } catch (e) {
                    console.error("Error en fromMe getter:", e);
                    return false;
                }
            },
            enumerable: true,
        },
        mtype: {
            get() {
                try {
                    if (!this.message) return "";
                    const type = Object.keys(this.message);

                    if (
                        !["senderKeyDistributionMessage", "messageContextInfo"].includes(
                            type[0],
                        )
                    ) {
                        return type[0];
                    }

                    if (type.length >= 3 && type[1] !== "messageContextInfo") {
                        return type[1];
                    }

                    return type[type.length - 1];
                } catch (e) {
                    console.error("Error en mtype getter:", e);
                    return "";
                }
            },
            enumerable: true,
        },
        msg: {
            get() {
                try {
                    if (!this.message) return null;
                    return this.message[this.mtype] || null;
                } catch (e) {
                    console.error("Error en msg getter:", e);
                    return null;
                }
            },
            enumerable: true,
        },
        mediaMessage: {
            get() {
                try {
                    if (!this.message) return null;

                    const Message =
                        (this.msg?.url || this.msg?.directPath ?
                            {
                                ...this.message
                            } :
                            extractMessageContent(this.message)) || null;
                    if (!Message) return null;

                    const mtype = Object.keys(Message)[0];
                    return MediaType.includes(mtype) ? Message : null;
                } catch (e) {
                    console.error("Error en mediaMessage getter:", e);
                    return null;
                }
            },
            enumerable: true,
        },
        mediaType: {
            get() {
                try {
                    const message = this.mediaMessage;
                    if (!message) return null;
                    return Object.keys(message)[0];
                } catch (e) {
                    console.error("Error en mediaType getter:", e);
                    return null;
                }
            },
            enumerable: true,
        },
        quoted: {
            get() {
                try {
                    const self = this;
                    const msg = self.msg;
                    const contextInfo = msg?.contextInfo;
                    const quoted = contextInfo?.quotedMessage;

                    if (!msg || !contextInfo || !quoted) return null;

                    const type = Object.keys(quoted)[0];
                    const q = quoted[type];
                    const text = typeof q === "string" ? q : q?.text || "";

                    return Object.defineProperties(
                        JSON.parse(
                            JSON.stringify(typeof q === "string" ? {
                                text: q
                            } : q || {}),
                        ), {
                        mtype: {
                            get() {
                                return type;
                            },
                            enumerable: true,
                        },
                        mediaMessage: {
                            get() {
                                const Message =
                                    (q?.url || q?.directPath ?
                                        {
                                            ...quoted
                                        } :
                                        extractMessageContent(quoted)) || null;
                                if (!Message) return null;
                                const mtype = Object.keys(Message)[0];
                                return MediaType.includes(mtype) ? Message : null;
                            },
                            enumerable: true,
                        },
                        mediaType: {
                            get() {
                                const message = this.mediaMessage;
                                if (!message) return null;
                                return Object.keys(message)[0];
                            },
                            enumerable: true,
                        },
                        id: {
                            get() {
                                return contextInfo.stanzaId || "";
                            },
                            enumerable: true,
                        },
                        chat: {
                            get() {
                                return contextInfo.remoteJid || self.chat || "";
                            },
                            enumerable: true,
                        },
                        isBaileys: {
                            get() {
                                const userId = self.conn?.user?.id || "";
                                const sender = this.sender || "";
                                const messageId = this.id || "";
                                const isFromBot = this?.fromMe === true || areJidsSameUser(userId, sender);
                                if (!isFromBot) return false;
                                const baileysStarts = ['NJX-', 'Lyru-', 'META-', 'EvoGlobalBot-', 'FizzxyTheGreat-', 'BAE5', '3EB0', 'B24E', '8SCO', 'SUKI', 'MYSTIC-'];
                                const hasKnownPrefix = baileysStarts.some(prefix => messageId.startsWith(prefix));
                                const isSukiPattern = /^SUKI[A-F0-9]+$/.test(messageId);
                                const isMysticPattern = /^MYSTIC[A-F0-9]+$/.test(messageId);
                                return isMysticPattern || isSukiPattern || hasKnownPrefix || false;
                            },
                            enumerable: true,
                        },
                        sender: {
                            get() {
                                try {
                                    const rawParticipant = contextInfo.participant;
                                    if (!rawParticipant) {
                                        const isFromMe =
                                            this.key?.fromMe ||
                                            areJidsSameUser(this.chat, self.conn?.user?.id || "");
                                        return isFromMe ?
                                            safeDecodeJid(self.conn?.user?.id, self.conn) :
                                            this.chat;
                                    }
                                    const parsedJid = safeDecodeJid(rawParticipant, self.conn);
                                    
                                    // Mantener el LID nativamente para preservar base de datos
                                    return parsedJid;
                                } catch (e) {
                                    console.error("Error en quoted sender getter:", e);
                                    return "";
                                }
                            },
                            enumerable: true,
                        },
                        fromMe: {
                            get() {
                                const sender = this.sender || "";
                                const userJid = self.conn?.user?.jid || "";
                                return areJidsSameUser(sender, userJid);
                            },
                            enumerable: true,
                        },
                        text: {
                            get() {
                                return (
                                    text ||
                                    this.caption ||
                                    this.contentText ||
                                    this.selectedDisplayText ||
                                    ""
                                );
                            },
                            enumerable: true,
                        },
                        mentionedJid: {
                            get() {
                                const mentioned = q?.contextInfo?.mentionedJid || self.getQuotedObj()?.mentionedJid || [];
                                return normalizeMentionedJid(mentioned);
                            },
                            enumerable: true,
                        },
                        name: {
                            get() {
                                const sender = this.sender;
                                return sender ? self.conn?.getName?.(sender) : null;
                            },
                            enumerable: true,
                        },
                        vM: {
                            get() {
                                return proto.WebMessageInfo.create({
                                    key: {
                                        fromMe: this.fromMe,
                                        remoteJid: this.chat,
                                        id: this.id,
                                    },
                                    message: quoted,
                                    ...(self.isGroup ? {
                                        participant: this.sender
                                    } : {}),
                                });
                            },
                            enumerable: true,
                        },
                        fakeObj: {
                            get() {
                                return this.vM;
                            },
                            enumerable: true,
                        },
                        download: {
                            value(saveToFile = false) {
                                const mtype = this.mediaType;
                                return self.conn?.downloadM?.(
                                    this.mediaMessage?.[mtype],
                                    mtype?.replace(/message/i, ""),
                                    saveToFile,
                                );
                            },
                            enumerable: true,
                            configurable: true,
                        },
                        reply: {
                            value(text, chatId, options) {
                                return self.conn?.reply?.(
                                    chatId ? chatId : this.chat,
                                    text,
                                    this.vM,
                                    options,
                                );
                            },
                            enumerable: true,
                        },
                        copy: {
                            value() {
                                const M = proto.WebMessageInfo;
                                return smsg(self.conn, M.create(M.toObject(this.vM)));
                            },
                            enumerable: true,
                        },
                        forward: {
                            value(jid, force = false, options) {
                                return self.conn?.sendMessage?.(
                                    jid, {
                                    forward: this.vM,
                                    force,
                                    ...options,
                                }, {
                                    ...options
                                },
                                );
                            },
                            enumerable: true,
                        },
                        copyNForward: {
                            value(jid, forceForward = false, options) {
                                return self.conn?.copyNForward?.(
                                    jid,
                                    this.vM,
                                    forceForward,
                                    options,
                                );
                            },
                            enumerable: true,
                        },
                        cMod: {
                            value(jid, text = "", sender = this.sender, options = {}) {
                                return self.conn?.cMod?.(jid, this.vM, text, sender, options);
                            },
                            enumerable: true,
                        },
                        delete: {
                            value() {
                                return self.conn?.sendMessage?.(this.chat, {
                                    delete: this.vM.key,
                                });
                            },
                            enumerable: true,
                        },
                    },
                    );
                } catch (e) {
                    console.error("Error en quoted getter:", e);
                    return null;
                }
            },
            enumerable: true,
        },
        _text: {
            value: null,
            writable: true,
            enumerable: true,
        },
        text: {
            get() {
                try {
                    if (
                        typeof this._text === "string" &&
                        this._text.length > 0
                    ) {
                        return this._text;
                    }

                    return getMessageResponseText(this.msg);
                } catch (e) {
                    console.error("Error en text getter:", e);
                    return "";
                }
            },
            set(str) {
                this._text = str;
            },
            enumerable: true,
        },
        mentionedJid: {
            get() {
                try {
                    const mentioned = this.msg?.contextInfo?.mentionedJid || [];
                    return normalizeMentionedJid(mentioned);
                } catch (e) {
                    console.error("Error en mentionedJid getter:", e);
                    return [];
                }
            },
            enumerable: true,
        },
        name: {
            get() {
                try {
                    if (!nullish(this.pushName) && this.pushName) return this.pushName;
                    const sender = this.sender;
                    return sender ? this.conn?.getName?.(sender) : "";
                } catch (e) {
                    console.error("Error en name getter:", e);
                    return "";
                }
            },
            enumerable: true,
        },
        download: {
            value(saveToFile = false) {
                try {
                    const mtype = this.mediaType;
                    return this.conn?.downloadM?.(
                        this.mediaMessage?.[mtype],
                        mtype?.replace(/message/i, ""),
                        saveToFile,
                    );
                } catch (e) {
                    console.error("Error en download:", e);
                    return Promise.reject(e);
                }
            },
            enumerable: true,
            configurable: true,
        },
        reply: {
            value(text, chatId, options) {
                try {
                    if (typeof text === 'string' && (text.includes('USO INCORRECTO') || text.includes('Uso incorrecto') || text.includes('uso incorrecto') || text.startsWith('⚠️') || text.startsWith('❌'))) {
                        this.isCommandError = true;
                    }
                    return this.conn?.reply?.(
                        chatId ? chatId : this.chat,
                        text,
                        this,
                        options,
                    );
                } catch (e) {
                    console.error("Error en reply:", e);
                    return Promise.reject(e);
                }
            },
            enumerable: true,
        },
        copy: {
            value() {
                try {
                    const M = proto.WebMessageInfo;
                    return smsg(this.conn, M.create(M.toObject(this)));
                } catch (e) {
                    console.error("Error en copy:", e);
                    return null;
                }
            },
            enumerable: true,
        },
        forward: {
            value(jid, force = false, options = {}) {
                try {
                    return this.conn?.sendMessage?.(
                        jid, {
                        forward: this,
                        force,
                        ...options,
                    }, {
                        ...options
                    },
                    );
                } catch (e) {
                    console.error("Error en forward:", e);
                    return Promise.reject(e);
                }
            },
            enumerable: true,
        },
        copyNForward: {
            value(jid, forceForward = false, options = {}) {
                try {
                    return this.conn?.copyNForward?.(jid, this, forceForward, options);
                } catch (e) {
                    console.error("Error en copyNForward:", e);
                    return Promise.reject(e);
                }
            },
            enumerable: true,
        },
        cMod: {
            value(jid, text = "", sender = this.sender, options = {}) {
                try {
                    return this.conn?.cMod?.(jid, this, text, sender, options);
                } catch (e) {
                    console.error("Error en cMod:", e);
                    return Promise.reject(e);
                }
            },
            enumerable: true,
        },
        getQuotedObj: {
            value() {
                try {
                    if (!this.quoted?.id) return null;
                    const q = proto.WebMessageInfo.create(
                        this.conn?.loadMessage?.(this.quoted.id) || this.quoted.vM || {},
                    );
                    return smsg(this.conn, q);
                } catch (e) {
                    console.error("Error en getQuotedObj:", e);
                    return null;
                }
            },
            enumerable: true,
        },
        getQuotedMessage: {
            get() {
                return this.getQuotedObj;
            },
            enumerable: true,
        },
        delete: {
            value() {
                try {
                    return this.conn?.sendMessage?.(this.chat, {
                        delete: this.key
                    });
                } catch (e) {
                    console.error("Error en delete:", e);
                    return Promise.reject(e);
                }
            },
            enumerable: true,
        },
        react: {
            value(text) {
                return this.conn?.sendMessage(this.chat, {
                    react: {
                        text,
                        key: this.key
                    }
                })
            },
            enumerable: true
        }
    });
}

export function logic(check, inp, out) {
    if (inp.length !== out.length)
        throw new Error("Input and Output must have same length");
    for (const i in inp)
        if (util.isDeepStrictEqual(check, inp[i])) return out[i];
    return null;
}

export function protoType() {
    Buffer.prototype.toArrayBuffer = function toArrayBufferV2() {
        return _toArrayBuffer(this);
    };
    Buffer.prototype.toArrayBufferV2 = function toArrayBuffer() {
        return _toArrayBufferV2(this);
    };
    ArrayBuffer.prototype.toBuffer = function toBuffer() {
        return _arrayBufferToBuffer(this);
    };
    Uint8Array.prototype.getFileType =
        ArrayBuffer.prototype.getFileType =
        Buffer.prototype.getFileType =
        async function getFileType() {
            return await _getFileType(this);
        };
    /**
     * @returns {Boolean}
     */
    String.prototype.isNumber = Number.prototype.isNumber = function isNumber() {
        return _isNumber(this);
    };
    /**
     * @return {String}
     */
    String.prototype.capitalize = function capitalize() {
        return _capitalize(this.toString());
    };
    /**
     * @return {String}
     */
    String.prototype.capitalizeV2 = function capitalizeV2() {
        return _capitalizeV2(this.toString());
    };

    String.prototype.resolveLidToRealJid = async function (groupChatId, conn) {
        return _resolveLidToRealJid(this.toString(), groupChatId, conn);
    };

    String.prototype.decodeJid = function decodeJid() {
        return _decodeJid(this.toString());
    };
    /**
     * number must be milliseconds
     * @return {string}
     */
    Number.prototype.toTimeString = function toTimeString() {
        return _toTimeString(this);
    };
    Number.prototype.getRandom =
        String.prototype.getRandom =
        Array.prototype.getRandom =
        function getRandom() { return _getRandom(this); };
}

function isNumber() {
    return _isNumber(this);
}

function getRandom() {
    return _getRandom(this);
}

/**
 * @deprecated use the operator ?? instead
 * - (null || undefined) ?? 'idk'
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_operator
 */
function nullish(args) {
    return !(args !== null && args !== undefined);
}