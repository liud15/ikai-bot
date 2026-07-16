// ═══════════════════════════════════════════════════════════
//  🎮 MENÚ 6 — JUEGOS & MINIJUEGOS
//  Todos los juegos disponibles en el bot
//  Usa: #menu6
// ═══════════════════════════════════════════════════════════
import fetch from 'node-fetch'

const menuImages = [
    'https://i.pinimg.com/1200x/7f/1f/4e/7f1f4ec5fdd293965aa16ef89cb5b90f.jpg',
    'https://i.pinimg.com/1200x/03/1a/b2/031ab26e6c2053efea7f44dc999ad584.jpg',
];

let handler = async (m, { conn }) => {
    let userId = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender;

    let txt = `
╔══════════════════════════╗
║  🎮  JUEGOS  🎮          ║
╚══════════════════════════╝

╭─⬣「 🃏 JUEGOS DE CARTAS 」⬣
│ ⚡ #bj <apuesta>     — Blackjack / 21
│ ⚡ #coinflip <t> <n> — Cara o Cruz
│ ⚡ #slot <apuesta>   — Tragamonedas
│ ⚡ #dados            — Juego de dados
╰─⬣

╭─⬣「 🎲 APUESTAS & AZAR 」⬣
│ ⚡ #ruleta <t> <n>   — Ruleta (rojo/negro/número)
│ ⚡ #plinko <apuesta> — Plinko
│ ⚡ #hol <apuesta>    — Mayor o Menor (High-Low)
│ ⚡ #carrera <emoji>  — Carreras (apuesta)
╰─⬣

╭─⬣「 🧠 JUEGOS DE HABILIDAD 」⬣
│ ⚡ #wordle           — Adivina la palabra
│ ⚡ #minas            — Buscaminas
│ ⚡ #ttt @user        — Tres en Raya (Triqui)
│ ⚡ #gato @user       — Tic-Tac-Toe (Gato)
│ ⚡ #conecta4 @user   — Conecta 4
╰─⬣

╭─⬣「 📊 STATS & RANKING 」⬣
│ ⚡ #top10            — Top jugadores
╰─⬣

> 💡 *Tip:* La mayoría de juegos con apuesta usan tus monedas del perfil
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

handler.help = ['menu6'];
handler.tags = ['main'];
handler.command = ['menu6', 'menú6'];

export default handler;
