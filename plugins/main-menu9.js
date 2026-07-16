// ═══════════════════════════════════════════════════════════
//  🛡️ MENÚ 9 — GRUPOS & CONFIGURACIÓN
//  Administración de grupos, antiprotecciones y config
//  Usa: #menu9
// ═══════════════════════════════════════════════════════════
import fetch from 'node-fetch'

const menuImages = [
    'https://i.pinimg.com/1200x/03/1a/b2/031ab26e6c2053efea7f44dc999ad584.jpg',
    'https://i.pinimg.com/1200x/a7/40/d0/a740d0208b0d60b5395f9bb13edf3a39.jpg',
];

let handler = async (m, { conn }) => {
    let userId = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender;

    let txt = `
╔══════════════════════════╗
║  🛡️  GRUPOS & CONFIG  🛡️  ║
╚══════════════════════════╝

╭─⬣「 👮 MODERACIÓN 」⬣
│ ⚡ #kick @user       — Expulsar usuario
│ ⚡ #promote @user    — Dar admin
│ ⚡ #warn @user [r]   — Advertir usuario
│ ⚡ #unwarn @user     — Quitar advertencia
│ ⚡ #warnlist         — Lista de warns
│ ⚡ #resetwarn @user  — Resetear warns
│ ⚡ #del / #delete    — Borrar mensaje
╰─⬣

╭─⬣「 📢 COMUNICACIÓN 」⬣
│ ⚡ #hidetag <txt>    — Tag oculto / Notificar
│ ⚡ #tag              — Mencionar a todos
│ ⚡ #encuesta <txt>   — Crear encuesta
│ ⚡ #reglas           — Ver reglas del grupo
│ ⚡ #setreglas <txt>  — Poner reglas
│ ⚡ #addregla <txt>   — Añadir una regla
│ ⚡ #delregla <n>     — Eliminar una regla
╰─⬣

╭─⬣「 🔇 SILENCIAR 」⬣
│ ⚡ #silenciar        — Silenciar grupo
│ ⚡ #dessilenciar     — Dessilenciar grupo
│ ⚡ #mute / #unmute   — Mutear/Desmutear
╰─⬣

╭─⬣「 👋 BIENVENIDA & DESPEDIDA 」⬣
│ ⚡ #setwelcome       — Config bienvenida
│ ⚡ #setbye           — Config despedida
│ ⚡ #welcome          — Activar/Desactivar bv
╰─⬣

╭─⬣「 😴 INACTIVOS 」⬣
│ ⚡ #inactivos [d]    — Lista inactivos
│ ⚡ #activos [d]      — Lista activos
│ ⚡ #alertainactivos  — Alertar inactivos
│ ⚡ #kickinactivos    — Expulsar inactivos
│ ⚡ #actividad @user  — Ver actividad
╰─⬣

╭─⬣「 🔒 ANTIPROTECCIONES 」⬣
│ ⚡ #antibot          — Anti bots
│ ⚡ #antidelete       — Anti eliminar mensajes
│ ⚡ #antilink         — Anti links
│ ⚡ #antilink2        — Anti links v2
│ ⚡ #antiprivado      — Anti chats privados
│ ⚡ #antispam         — Anti spam
│ ⚡ #antisubbots      — Anti sub-bots
│ ⚡ #antitoxic        — Anti tóxicos
│ ⚡ #antitrabas       — Anti trabas
│ ⚡ #antiver          — Anti ver-una-vez
│ ⚡ #antifake         — Anti virtuales/fakes
│ ⚡ #nsfw             — Activar/Desactivar NSFW
╰─⬣

╭─⬣「 ⚙️ AUTO-CONFIG 」⬣
│ ⚡ #autoaceptar      — Auto aceptar solicitudes
│ ⚡ #autorechazar     — Auto rechazar solicitudes
│ ⚡ #autoresponder    — Configurar autorespuesta
│ ⚡ #autosticker      — Auto convertir a sticker
│ ⚡ #autolevelup      — Notificar sube de nivel
│ ⚡ #simi / #autosimi — Modo SimSimi
╰─⬣

╭─⬣「 🤖 CONFIG DEL BOT 」⬣
│ ⚡ #setprimary       — Número principal del bot
│ ⚡ #botlabel         — Etiqueta del bot
│ ⚡ #configuraciones  — Panel de configuraciones
│ ⚡ #config / #nable  — Opciones del grupo
│ ⚡ #prefix           — Cambiar prefijo (owner)
│ ⚡ #restart          — Reiniciar bot (owner)
│ ⚡ #update           — Actualizar bot (owner)
│ ⚡ #rev              — Ver revisión (owner)
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

handler.help = ['menu9'];
handler.tags = ['main'];
handler.command = ['menu9', 'menú9'];

export default handler;
