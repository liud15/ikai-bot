// ═══════════════════════════════════════════════════════════
//  🎭 MENÚ 7 — INTERACCIONES & FUN
//  Roleplay anime, frases, epígrafes y más
//  Usa: #menu7
// ═══════════════════════════════════════════════════════════
import fetch from 'node-fetch'

const menuImages = [
    'https://i.pinimg.com/1200x/aa/e3/73/aae373e9e9c9a8ba2b040a01b8bf299a.jpg',
    'https://i.pinimg.com/1200x/3d/79/1e/3d791e95f394436324c07dfcaaa28b1e.jpg',
];

let handler = async (m, { conn }) => {
    let userId = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender;

    let txt = `
╔═══════════════════════╗
║   🎭 INTERACCIONES & FUN 🎭    ║
╚═══════════════════════╝

╭─⬣「 💕 INTERACCIONES CARIÑOSAS 」⬣
│ ⚡ #abrazo @user     — Dar un abrazo
│ ⚡ #beso @user       — Dar un beso
│ ⚡ #caricia @user    — Acariciar
│ ⚡ #mimar @user      — Mimar/Acurrucarse
│ ⚡ #besomejilla @u   — Beso en la mejilla
│ ⚡ #tomarmano @user  — Tomar de la mano
│ ⚡ #acurrucar @user  — Acurrucarse
╰─⬣

╭─⬣「 😈 INTERACCIONES DIVERTIDAS 」⬣
│ ⚡ #cachetada @user  — Cachetada
│ ⚡ #golpe @user      — Golpe
│ ⚡ #morder @user     — Morder
│ ⚡ #lamer @user      — Lamer
│ ⚡ #bonk @user       — Bonk
│ ⚡ #patada @user     — Patada
│ ⚡ #empujar @user    — Empujar
│ ⚡ #escupir @user    — Escupir
│ ⚡ #matar @user      — Matar
│ ⚡ #bully @user      — Hacer bullying
╰─⬣

╭─⬣「 😊 EXPRESIONES 」⬣
│ ⚡ #bailar @user     — Bailar
│ ⚡ #llorar           — Llorar
│ ⚡ #reir             — Reír
│ ⚡ #sonreir          — Sonreír
│ ⚡ #sonrojar         — Sonrojarse
│ ⚡ #saludar @user    — Saludar
│ ⚡ #guiñar @user     — Guiñar el ojo
│ ⚡ #feliz            — Estar feliz
│ ⚡ #triste           — Estar triste
│ ⚡ #enojado          — Enojarse
│ ⚡ #timido           — Ponerse tímido
│ ⚡ #gritar @user     — Gritar
│ ⚡ #presumir         — Presumir
│ ⚡ #nope @user       — Decir NOPE
│    ... y muchas más!
╰─⬣

╭─⬣「 🎲 FUN RANDOM 」⬣
│ ⚡ #fraseanime       — Frase anime random
│ ⚡ #excusa           — Excusa aleatoria
│ ⚡ #consejo          — Consejo de vida
│ ⚡ #mision           — Misión del día
│ ⚡ #titulo           — Tu título anime
╰─⬣

╭─⬣「 ✍️ EPÍGRAFES 」⬣
│ ⚡ #epigrafe         — Epígrafe elite
│ ⚡ #citaelite        — Cita de élite
│ ⚡ #inspiracion      — Frase inspiracional
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

handler.help = ['menu7'];
handler.tags = ['main'];
handler.command = ['menu7', 'menú7'];

export default handler;
