// Plugin de descarga de Manga desde TomosManga.com
// Búsqueda -> Detalle -> Descarga archivo via TeraBox -> Envía directo por WhatsApp
import { search, detail, resolveTerabox } from "../lib/tomosmanga.js";
import { createWriteStream, existsSync, mkdirSync, statSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const TMP_DIR = join(process.cwd(), 'tmp', 'manga');

/** Asegura que el directorio tmp/manga exista */
function ensureTmpDir() {
    if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

/** Limpia el archivo descargado de forma segura */
function cleanup(filePath) {
    try { if (filePath && existsSync(filePath)) unlinkSync(filePath); } catch {}
}

let handler = async (m, { command, usedPrefix, conn, text, args }) => {
    if (!text) return m.reply(`\`Ingresa el nombre del manga o la URL de TomosManga. Ejemplo:\`\n\n • ${usedPrefix + command} Kimetsu no Yaiba\n • ${usedPrefix + command} One Piece\n • ${usedPrefix + command} https://tomosmanga.com/descargar-kimetsu-no-yaiba/`);

    try {
        // Si el texto es una URL de tomosmanga, mostrar detalles y preparar descarga
        if (text.includes('tomosmanga.com/')) {
            m.react("⌛");

            let info = await detail(text.trim());
            if (info.error) return m.reply('❌ Error al obtener los detalles: ' + info.error);

            // Construir lista numerada de TeraBox links disponibles
            const tbLinks = info.teraboxLinks;
            let dlDisplay = '';

            if (tbLinks.length > 0) {
                dlDisplay = '\n☁️ *TERABOX (Descarga directa)*\n';
                tbLinks.forEach((link, idx) => {
                    dlDisplay += `> \`${idx + 1}\` • ${link.label}\n`;
                });
                dlDisplay += `\n> 💡 Responde con el *número* del tomo para descargarlo.\n> 📥 Responde *todos* para descargar todo automáticamente.`;
            } else {
                // Mostrar links alternativos si no hay TeraBox
                for (const [server, links] of Object.entries(info.downloads)) {
                    let emoji = '📦';
                    const serverUp = server.toUpperCase();
                    if (serverUp.includes('MEGA')) emoji = '📥';
                    else if (serverUp.includes('MEDIAFIRE') || serverUp.includes('MF')) emoji = '🔥';
                    else if (serverUp.includes('FIRELOAD')) emoji = '🌐';

                    dlDisplay += `\n${emoji} *${server}*\n`;
                    links.forEach((link, idx) => {
                        dlDisplay += `> ${idx + 1}. ${link.label}\n> 🔗 ${link.url}\n`;
                    });
                }
            }

            if (!dlDisplay) {
                dlDisplay = '\n> ⚠️ No se encontraron links de descarga en esta página.';
            }

            let cap = `
乂 \`\`\`MANGA - DOWNLOAD\`\`\`

「✦」 \`Título :\` ${info.title}
> ✰ \`Sinopsis :\` ${info.synopsis ? info.synopsis.substring(0, 350) + (info.synopsis.length > 350 ? '...' : '') : 'Sin sinopsis'}
> 📚 \`Formato :\` ${info.techData.formato || 'N/A'}
> 🌐 \`Idioma :\` ${info.techData.idioma || 'Español'}
> 📦 \`Tamaño total :\` ${info.techData.size || 'N/A'}
> 📊 \`Estado :\` ${info.techData.estado || 'N/A'}
> 🏷️ \`Categoría :\` ${info.categories.join(', ') || 'N/A'}

━━━ 📖 LINKS DE DESCARGA ━━━
${dlDisplay}
> ⚠️ *Contraseña de archivos:* \`tomosmanga\`
`.trim();

            let sent = await conn.sendMessage(m.chat, {
                text: cap,
                contextInfo: {
                    externalAdReply: {
                        title: info.title,
                        body: 'TomosManga - Descarga de Manga',
                        thumbnailUrl: info.cover,
                        sourceUrl: info.url || text,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: m });

            // Guardar sesión para interactividad (solo si hay links TeraBox)
            if (tbLinks.length > 0) {
                conn.manga = conn.manga || {};
                conn.manga[m.sender] = {
                    title: info.title,
                    teraboxLinks: tbLinks,
                    key: sent.key,
                    downloading: false,
                    timeout: setTimeout(() => delete conn.manga[m.sender], 600_000) // 10 min
                };
            }

            m.react("✅");
        } else {
            // Búsqueda por nombre
            m.react('🔍');
            const results = await search(text);
            if (results.length === 0) {
                return conn.reply(m.chat, '❌ No se encontraron resultados en TomosManga.', m);
            }

            let cap = `◢ 📖 Manga - Búsqueda ◤\n`;
            results.slice(0, 15).forEach((res, index) => {
                cap += `\n\`${index + 1}\`\n「✦」\`Título :\` ${res.title}\n> 📝 \`Info :\` ${res.snippet ? res.snippet.substring(0, 120) + '...' : 'Sin descripción'}\n> 🔗 \`Link :\` ${res.link}\n`;
            });

            cap += `\n> 💡 *Tip:* Usa \`${usedPrefix + command} <URL>\` con el link de arriba para ver los links de descarga.`;

            await conn.sendMessage(m.chat, {
                text: cap,
                contextInfo: {
                    mentionedJid: [m.sender],
                    externalAdReply: {
                        title: 'Búsqueda de Manga',
                        body: `${results.length} resultado(s) encontrado(s)`,
                        thumbnailUrl: results[0]?.cover || '',
                        sourceUrl: results[0]?.link || '',
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: m });
            m.react("✅");
        }
    } catch (error) {
        console.error('Error en handler manga:', error);
        conn.reply(m.chat, '❌ Error al procesar la solicitud: ' + error.message, m);
    }
};

/**
 * Descarga un RAR desde TeraBox, lo extrae en tmp/ y envía cada archivo individual
 */
async function downloadAndSend(conn, m, session, teraboxLink, mangaTitle) {
    let filePath = null;

    try {
        await conn.reply(m.chat, `⏳ Resolviendo link: *${teraboxLink.label}*...`, m);

        const resolved = await resolveTerabox(teraboxLink.url);
        if (!resolved.status || resolved.files.length === 0) {
            await conn.reply(m.chat, `❌ No se pudo resolver el link de TeraBox para *${teraboxLink.label}*.\n> ${resolved.error || 'Sin archivos disponibles'}`, m);
            return false;
        }

        ensureTmpDir();

        for (const file of resolved.files) {
            const sizeMB = (file.bytes / 1024 / 1024).toFixed(1);
            const timestamp = Date.now();
            filePath = join(TMP_DIR, `${timestamp}_${file.filename}`);

            await conn.reply(m.chat, `📥 Descargando *${file.filename}* (${sizeMB} MB)...\n> ⏳ Esto puede tardar varios minutos.`, m);

            try {
                // Timeout de 10 minutos para descarga desde TeraBox
                const controller = new AbortController();
                const dlTimeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);

                const response = await fetch(file.dlink, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: controller.signal
                });
                clearTimeout(dlTimeout);

                if (!response.ok) {
                    await conn.reply(m.chat, `❌ Error HTTP ${response.status} al descargar *${file.filename}*\n> 🔗 Link directo: ${file.dlink}`, m);
                    continue;
                }

                // Guardar a disco en lugar de memoria (stream)
                const fileStream = createWriteStream(filePath);
                const bodyStream = Readable.fromWeb(response.body);
                await pipeline(bodyStream, fileStream);

                const savedSize = statSync(filePath).size;
                if (savedSize < 1000) {
                    await conn.reply(m.chat, `❌ El archivo descargado está vacío o corrupto.\n> 🔗 Link directo: ${file.dlink}`, m);
                    cleanup(filePath);
                    continue;
                }

                const savedMB = (savedSize / 1024 / 1024).toFixed(1);
                await conn.reply(m.chat, `✅ Descarga completa (${savedMB} MB). Enviando archivo...`, m);

                // Enviar el archivo directamente sin extraer
                const fileBuffer = readFileSync(filePath);

                // Detectar tipo MIME
                let mimetype = 'application/octet-stream';
                if (file.filename.endsWith('.rar')) mimetype = 'application/x-rar-compressed';
                else if (file.filename.endsWith('.zip')) mimetype = 'application/zip';
                else if (file.filename.endsWith('.cbr')) mimetype = 'application/x-cbr';
                else if (file.filename.endsWith('.cbz')) mimetype = 'application/x-cbz';
                else if (file.filename.endsWith('.pdf')) mimetype = 'application/pdf';

                await conn.sendFile(m.chat, fileBuffer, file.filename,
                    `✅ *${mangaTitle}*\n> 📄 ${file.filename}\n> 📦 Tamaño: ${savedMB} MB\n> 🔑 Contraseña: \`tomosmanga\`\n> 🌐 Fuente: TeraBox`,
                    m, false, {
                    mimetype,
                    asDocument: true
                });

                // Limpiar archivo temporal
                cleanup(filePath);

            } catch (dlErr) {
                console.error('[manga] Error en descarga/envío:', file.filename, dlErr);
                cleanup(filePath);

                // Enviar link directo como fallback
                await conn.sendMessage(m.chat, {
                    text: `❌ Error procesando *${file.filename}*: ${dlErr.message}\n\n> 📥 Link directo de descarga:\n${file.dlink}\n\n> 🔑 Contraseña: \`tomosmanga\`\n> ⏰ El link expira en ~8 horas`,
                    contextInfo: {
                        externalAdReply: {
                            title: file.filename,
                            body: `${sizeMB} MB - Descarga directa`,
                            sourceUrl: file.dlink,
                            mediaType: 1
                        }
                    }
                }, { quoted: m });
            }
        }
        return true;
    } catch (err) {
        console.error('[manga] Error en downloadAndSend:', err);
        cleanup(filePath);
        await conn.reply(m.chat, `❌ Error procesando *${teraboxLink.label}*: ${err.message}`, m);
        return false;
    }
}

/**
 * Handler interactivo - detecta respuestas del usuario al mensaje de detalle
 */
handler.before = async (m, { conn }) => {
    conn.manga = conn.manga || {};
    const session = conn.manga[m.sender];
    if (!session || !m.quoted || m.quoted.id !== session.key.id) return;
    if (session.downloading) return m.reply('⏳ Ya hay una descarga en proceso. Espera a que termine.');

    const input = m.text.trim().toLowerCase();
    const tbLinks = session.teraboxLinks;

    if (input === 'todos' || input === 'all' || input === 'todo') {
        // Descargar todos los tomos automáticamente
        session.downloading = true;
        m.react('📥');

        await conn.reply(m.chat, `⏳ Iniciando descarga de *${tbLinks.length} paquete(s)* de *${session.title}*...\n> Esto puede tardar un rato dependiendo del tamaño.`, m);

        let success = 0;
        let failed = 0;
        for (const link of tbLinks) {
            const ok = await downloadAndSend(conn, m, session, link, session.title);
            if (ok) success++;
            else failed++;
        }

        await conn.reply(m.chat, `✅ *Descarga completada*\n> ✅ Exitosos: ${success}/${tbLinks.length}\n> ❌ Fallidos: ${failed}`, m);
        m.react('✅');

        clearTimeout(session.timeout);
        delete conn.manga[m.sender];
    } else {
        // Descargar un tomo específico por número
        const num = parseInt(input);
        if (isNaN(num) || num < 1 || num > tbLinks.length) {
            return m.reply(`❌ Número no válido. Envía un número entre *1* y *${tbLinks.length}*, o *todos* para descargar todo.`);
        }

        session.downloading = true;
        m.react('📥');

        const selectedLink = tbLinks[num - 1];
        await downloadAndSend(conn, m, session, selectedLink, session.title);

        session.downloading = false;
        m.react('✅');

        // No eliminar sesión para que pueda seguir descargando otros
        clearTimeout(session.timeout);
        session.timeout = setTimeout(() => delete conn.manga[m.sender], 600_000);
    }
};

handler.command = ["manga", "mangadl", "tomosmanga"];
handler.tags = ['download'];
handler.help = ["manga"];

export default handler;
