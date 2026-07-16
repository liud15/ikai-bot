// ═══════════════════════════════════════════════════════════
//  🎴 MENÚ 4 — GACHA
//  Sistema de colección de personajes anime
//  Usa: #menu4
// ═══════════════════════════════════════════════════════════
import fetch from 'node-fetch'

const menuImages = [
    'https://i.pinimg.com/1200x/3d/79/1e/3d791e95f394436324c07dfcaaa28b1e.jpg',
    'https://i.pinimg.com/1200x/a7/40/d0/a740d0208b0d60b5395f9bb13edf3a39.jpg',
];

let handler = async (m, { conn }) => {
    let userId = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender;

    let txt = `
╔══════════════════════════╗
║  🎴  GACHA  🎴           ║
╚══════════════════════════╝

╭─⬣「 🎲 ROLL & CLAIM 」⬣
│ ⚡ #rw               — Roll de personaje
│ ⚡ #claim            — Reclamar personaje
│ ⚡ #fav <nombre>     — Marcar favorito
│ ⚡ #release <nombre> — Liberar personaje
╰─⬣

╭─⬣「 👥 COLECCIÓN 」⬣
│ ⚡ #harem            — Ver tu colección
│ ⚡ #micoleccion      — Colección HD
│ ⚡ #charinfo <nom>   — Info de personaje
│ ⚡ #searchchar <nom> — Buscar personaje
│ ⚡ #wimage <nom>     — Ver imagen del char
╰─⬣

╭─⬣「 🤝 SOCIAL GACHA 」⬣
│ ⚡ #trade @user <nom>       — Intercambiar
│ ⚡ #tradeaccept             — Aceptar trade
│ ⚡ #tradereject             — Rechazar trade
│ ⚡ #tradecancel             — Cancelar trade
│ ⚡ #giftchar @user <nom>    — Regalar char
╰─⬣

╭─⬣「 🗳️ VOTACIÓN & RANKING 」⬣
│ ⚡ #vote <nombre>    — Votar personaje
│ ⚡ #topharem         — Top harems
│ ⚡ #wtop             — Top waifus globales
╰─⬣

╭─⬣「 ⚙️ GACHA AVANZADO 」⬣
│ ⚡ #claimmsg <texto> — Personalizar claim msg
│ ⚡ #addchar          — Agregar personaje (admin)
│ ⚡ #subirimagen      — Subir imagen (admin)
│ ⚡ #gachaadmin       — Panel admin gacha (owner)
│ ⚡ #malscraper       — Scraper de MAL (owner)
╰─⬣

╭─⬣「 🌸 ANIME INFO 」⬣
│ ⚡ #anime <nombre>   — Info de anime (MAL)
│ ⚡ #ainfo <nombre>   — Info detallada
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

handler.help = ['menu4'];
handler.tags = ['main'];
handler.command = ['menu4', 'menú4'];

export default handler;
