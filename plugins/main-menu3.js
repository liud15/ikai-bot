// ═══════════════════════════════════════════════════════════
//  🤖 MENÚ 3 — IA & BOTS
//  Comandos de Inteligencia Artificial
//  Usa: #menu3
// ═══════════════════════════════════════════════════════════
import fetch from 'node-fetch'

const menuImages = [
    'https://i.pinimg.com/1200x/7f/1f/4e/7f1f4ec5fdd293965aa16ef89cb5b90f.jpg',
    'https://i.pinimg.com/1200x/03/1a/b2/031ab26e6c2053efea7f44dc999ad584.jpg',
    "https://i.pinimg.com/1200x/aa/e3/73/aae373e9e9c9a8ba2b040a01b8bf299a.jpg"
];

let handler = async (m, { conn }) => {
    let userId = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender;

    let txt = `
╔══════════════════════════╗
║  🤖  IA & BOTS  🤖       ║
╚══════════════════════════╝

╭─⬣「 💬 CHAT IA 」⬣
│ ⚡ #ia <texto>        — Chat IA (IKAI)
│ ⚡ #gemini <texto>    — Google Gemini
│ ⚡ #chatgpt <texto>   — ChatGPT / GPT4
╰─⬣

╭─⬣「 🖼️ IMÁGENES IA 」⬣
│ ⚡ #imagen <texto>    — Generar imagen IA
│ ⚡ #ai3d <texto>      — Imagen 3D IA
│ ⚡ #toreal <img>      — Foto → Realista IA
│ ⚡ #toghibli <img>    — Foto → Ghibli IA
╰─⬣

╭─⬣「 🎵 MÚSICA IA 」⬣
│ ⚡ #musica <texto>    — Generar música
│ ⚡ #lyria <texto>     — Lyria v1
│ ⚡ #lyria2 <texto>    — Lyria v2
│ ⚡ #lyria3 <texto>    — Lyria v3
│ ⚡ #musicapro <texto> — Música Profesional
╰─⬣

╭─⬣「 🔊 VOZ IA 」⬣
│ ⚡ #voz <texto>       — TTS — Texto a Voz
│ ⚡ #hablar <texto>    — Hablar texto
╰─⬣

╭─⬣「 💕 WAIFUS IA 」⬣
│ ⚡ #rem              — Chat con Rem (Re:Zero)
│ ⚡ #aqua             — Chat con Aqua (Konosuba)
│ ⚡ #nezuko           — Chat con Nezuko (KnY)
│ ⚡ #kurumi           — Chat con Kurumi (Date A Live)
│ ⚡ #alya             — Chat con Alya
│ ⚡ #kaoruko          — Chat con Kaoruko
│ ⚡ #remclear         — Limpiar historial de Rem
│    (agrega "clear" a cualquier waifu para limpiar)
╰─⬣

╭─⬣「 🤖 SUB-BOT 」⬣
│ ⚡ #qr               — Conectar sub-bot (QR)
│ ⚡ #code             — Conectar sub-bot (Código)
│ ⚡ #botlist          — Ver bots conectados
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

handler.help = ['menu3'];
handler.tags = ['main'];
handler.command = ['menu3', 'menú3'];

export default handler;
