// ═══════════════════════════════════════════════════════════
//  🔍 MENÚ 8 — BÚSQUEDAS & HERRAMIENTAS
//  Búsquedas en la web, stickers y utilidades
//  Usa: #menu8
// ═══════════════════════════════════════════════════════════
import fetch from 'node-fetch'

const menuImages = [
    'https://i.pinimg.com/1200x/0d/d8/14/0dd814ecd081c00638c7d6d9ed5dd5a5.jpg',
    'https://i.pinimg.com/1200x/b1/5c/56/b15c56e644b48f57f41a9b1b1e63b873.jpg',
];

let handler = async (m, { conn }) => {
    let userId = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender;

    let txt = `
╔══════════════════════════╗
║  🔍  BÚSQUEDAS & TOOLS  ║
╚══════════════════════════╝

╭─⬣「 🔍 BÚSQUEDAS WEB 」⬣
│ ⚡ #pinterest <t>    — Buscar imágenes
│ ⚡ #pinvideo <t>     — Buscar videos
│ ⚡ #wallpaper <t>    — Buscar fondos de pantalla
│ ⚡ #tiktoksearch <t> — Buscar en TikTok
│ ⚡ #tweetposts <t>   — Buscar tweets/posts
│ ⚡ #ytsearch <t>     — Buscar en YouTube
│ ⚡ #wikipedia <t>    — Buscar en Wikipedia
╰─⬣

╭─⬣「 🖼️ STICKERS 」⬣
│ ⚡ #s <media>        — Crear sticker
│ ⚡ #toimg            — Sticker → Imagen
│ ⚡ #qc               — Quoted Chat (sticker)
│ ⚡ #setsticker       — Config sticker del bot
│ ⚡ #stickerly <t>    — Buscar stickers
│ ⚡ #wm / #take       — Robar sticker (sin marca)
╰─⬣

╭─⬣「 🛠️ HERRAMIENTAS 」⬣
│ ⚡ #hd / #remini     — Mejorar calidad de foto
│ ⚡ #removebg         — Quitar fondo (rmbg)
│ ⚡ #photoroom        — Fondo profesional
│ ⚡ #imagedit         — Editar imagen
│ ⚡ #tofigure         — Imagen → Figura
│ ⚡ #toreal <img>     — Foto → Realista
│ ⚡ #ss <url>         — Screenshot de web
│ ⚡ #traducir <t>     — Traducir texto
│ ⚡ #definir <p>      — Diccionario / Definir
│ ⚡ #calc <expr>      — Calculadora
│ ⚡ #whatmusic        — Identificar canción 🎵
│ ⚡ #catbox / #cbx    — Subir archivo a URL
╰─⬣

╭─⬣「 ℹ️ INFO & MISC 」⬣
│ ⚡ #p / #ping        — Ping / Estado del bot
│ ⚡ #speed            — Velocidad del bot
│ ⚡ #name <nombre>    — Cambiar tu nombre
│ ⚡ #reporte <texto>  — Reportar un bug
│ ⚡ #ds               — Fix mensaje de espera
╰─⬣

> 📌 Escribe *#menu* para volver al menú principal
> © Powered by Staff IKAIBOT-MD
`.trim();

    const selectedImage = menuImages[Math.floor(Math.random() * menuImages.length)];
    try {
        const res = await fetch(selectedImage);
        if (res.ok) {
            const imgBuffer = Buffer.from(await res.arrayBuffer());
            await conn.sendMessage(m.chat, {
                image: imgBuffer,
                caption: txt,
                mentions: [m.sender, userId]
            }, { quoted: m });
        } else throw new Error('fetch failed');
    } catch {
        await conn.reply(m.chat, txt, m);
    }
};

handler.help = ['menu8'];
handler.tags = ['main'];
handler.command = ['menu8', 'menú8'];

export default handler;
