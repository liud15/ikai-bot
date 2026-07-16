// ═══════════════════════════════════════════════════════════
//  💰 MENÚ 5 — ECONOMÍA & RPG
//  Sistema completo de economía, RPG y familia
//  Usa: #menu5
// ═══════════════════════════════════════════════════════════
import fetch from 'node-fetch'

const menuImages = [
    'https://i.pinimg.com/1200x/b1/5c/56/b15c56e644b48f57f41a9b1b1e63b873.jpg',
    'https://i.pinimg.com/1200x/0d/d8/14/0dd814ecd081c00638c7d6d9ed5dd5a5.jpg',
];

let handler = async (m, { conn }) => {
    let userId = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender;

    let txt = `
╔══════════════════════════╗
║  💰  ECONOMÍA & RPG  💰  ║
╚══════════════════════════╝

╭─⬣「 👤 PERFIL & STATS 」⬣
│ ⚡ #perfil           — Tu perfil RPG
│ ⚡ #perfil @user     — Perfil de otro usuario
│ ⚡ #perfilhd         — Perfil en imagen HD
│ ⚡ #top <tipo>       — Rankings globales
│    (xp | level | coins | diamantes)
│ ⚡ #ranking          — Leaderboard completo
│ ⚡ #logros           — Ver logros
│ ⚡ #claimlogro <n>   — Reclamar logro
╰─⬣

╭─⬣「 💳 BANCO & WALLET 」⬣
│ ⚡ #bal              — Ver tu wallet y banco
│ ⚡ #deposit <cant>   — Depositar al banco
│ ⚡ #withdraw <cant>  — Retirar del banco
│ ⚡ #upgrade          — Mejorar banco (💎)
│ ⚡ #transfer @u <n>  — Transferir monedas
│ ⚡ #regalar @u <it>  — Regalar ítems/coins
╰─⬣

╭─⬣「 ⚔️ ACTIVIDADES 」⬣
│ ⚡ #daily            — Recompensa diaria
│ ⚡ #work             — Trabajar y ganar XP
│ ⚡ #cazar            — Cazar bestias
│ ⚡ #aventura         — Explorar mapas
│ ⚡ #minar            — Minería (recursos)
│ ⚡ #cofre            — Cofre misterioso
│ ⚡ #robar @user      — Robar monedas
╰─⬣

╭─⬣「 🏥 SALUD & INVENTARIO 」⬣
│ ⚡ #heal             — Curar heridas
│ ⚡ #hospital         — Ver estado de salud
│ ⚡ #inv              — Ver inventario
│ ⚡ #usar <item>      — Usar un ítem
│ ⚡ #shop             — Tienda de ítems
│ ⚡ #buy <item> [n]   — Comprar ítem
╰─⬣

╭─⬣「 🗺️ MUNDO & EXPLORACIÓN 」⬣
│ ⚡ #mapa             — Ver regiones del mundo
│ ⚡ #bestiario        — Bestias descubiertas
│ ⚡ #levelup          — Subir de nivel
╰─⬣

╭─⬣「 👪 FAMILIA 」⬣
│ ⚡ #pareja @user     — Proponer matrimonio
│ ⚡ #aceptarpareja    — Aceptar propuesta
│ ⚡ #divorcio         — Divorciarse
│ ⚡ #adoptar @user    — Adoptar usuario
│ ⚡ #aceptaradopcion  — Aceptar adopción
│ ⚡ #desheredar @user — Desheredar hijo
│ ⚡ #emancipar        — Emanciparse
│ ⚡ #familia          — Ver tu familia
│ ⚡ #arbolfamilia     — Árbol genealógico
│ ⚡ #arbolhd          — Árbol en imagen HD
│ ⚡ #familiatop       — Top familias
│ ⚡ #familydaily      — Recompensa familiar
│ ⚡ #herencia @user   — Dar herencia (admin)
│ ⚡ #certificado      — Certificado matrimonio
╰─⬣

╭─⬣「 🥊 APUESTAS 」⬣
│ ⚡ #duelo @user <n>  — Duelo RPG
│ ⚡ #ppt <tipo> [n]   — Piedra, Papel, Tijera
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

handler.help = ['menu5'];
handler.tags = ['main'];
handler.command = ['menu5', 'menú5'];

export default handler;
