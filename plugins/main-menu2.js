// ═══════════════════════════════════════════════════════════
//  📥 MENÚ 2 — DESCARGAS
//  Comandos de descarga de contenido multimedia
//  Usa: #menu2
// ═══════════════════════════════════════════════════════════
import fetch from 'node-fetch'

const menuImages = [
    'https://i.pinimg.com/1200x/3d/79/1e/3d791e95f394436324c07dfcaaa28b1e.jpg',
    'https://i.pinimg.com/1200x/a7/40/d0/a740d0208b0d60b5395f9bb13edf3a39.jpg',
    "https://i.pinimg.com/1200x/b1/5c/56/b15c56e644b48f57f41a9b1b1e63b873.jpg",
];

let handler = async (m, { conn }) => {
    let userId = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender;

    let txt = `
╔═════════════════════╗
║  📥  DESCARGAS  📥      ║
╚═════════════════════╝

╭─⬣「 🎬 VIDEO / AUDIO 」⬣
│ ⚡ #dl <url>          — AIO (TikTok/IG/YT/FB)
│ ⚡ #tiktok <url>      — TikTok (sin marca)
│ ⚡ #tiktokimg <url>   — TikTok fotos/álbum
│ ⚡ #ttrandom          — TikTok aleatorio
│ ⚡ #facebook <url>    — Video de Facebook
│ ⚡ #instagram <url>   — Instagram (foto/vid)
│ ⚡ #play <texto>      — YouTube → MP3
│ ⚡ #ytvid <texto>     — YouTube → MP4
│ ⚡ #mp4 <url>         — Video HD alternativo
╰─⬣

╭─⬣「 🎵 MÚSICA / SPOTIFY 」⬣
│ ⚡ #plays <url/texto> — Spotify → MP3
│ ⚡ #spotify <url>     — Descargar canción
╰─⬣

╭─⬣「 📦 ARCHIVOS / HOSTING 」⬣
│ ⚡ #mediafire <url>   — Descarga Mediafire
│ ⚡ #drive <url>       — Google Drive
│ ⚡ #krakenfiles <url> — KrakenFiles
│ ⚡ #mp4upload <url>   — Mp4Upload
│ ⚡ #streamtape <url>  — StreamTape
│ ⚡ #catbox <media>    — Subir a Catbox/ImgBB
╰─⬣

╭─⬣「 🌸 ANIME / MANGA 」⬣
│ ⚡ #jkanime <url>     — JKAnime (capítulo)
│ ⚡ #tioanime <url>    — TioAnime (capítulo)
│ ⚡ #hentaila <url>    — HentaiLA (capítulo)
│ ⚡ #manga <url>       — Manga (capítulos)
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

handler.help = ['menu2'];
handler.tags = ['main'];
handler.command = ['menu2', 'menú2'];

export default handler;
