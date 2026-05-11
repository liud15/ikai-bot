//Código creado por JonathanG, dejen creditos hdp >:v

const menuVideos = [
    'https://files.catbox.moe/mul8a5.mp4',
    'https://files.catbox.moe/jopdis.mp4',
    "https://files.catbox.moe/jetxdl.mkv",
    "https://files.catbox.moe/z1dktl.mkv"
];
const menuImages = [
    'https://i.pinimg.com/1200x/3d/79/1e/3d791e95f394436324c07dfcaaa28b1e.jpg',
    'https://i.pinimg.com/1200x/a7/40/d0/a740d0208b0d60b5395f9bb13edf3a39.jpg',
    "https://i.pinimg.com/1200x/b1/5c/56/b15c56e644b48f57f41a9b1b1e63b873.jpg",
    "https://i.pinimg.com/1200x/0d/d8/14/0dd814ecd081c00638c7d6d9ed5dd5a5.jpg",
    "https://i.pinimg.com/1200x/7f/1f/4e/7f1f4ec5fdd293965aa16ef89cb5b90f.jpg",
    "https://i.pinimg.com/1200x/03/1a/b2/031ab26e6c2053efea7f44dc999ad584.jpg",
    "https://i.pinimg.com/1200x/aa/e3/73/aae373e9e9c9a8ba2b040a01b8bf299a.jpg"
];
// --- --- --- --- --- --- --- --- --- --- -

// Función auxiliar para el tiempo de actividad 
function clockString(ms) {
    let d = isNaN(ms) ? '--' : Math.floor(ms / 86400000)
    let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24
    let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
    let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
    // return [d, 'd ', h, 'h ', m, 'm ', s, 's '].map(v => v.toString().padStart(2, 0)).join('') // Formato con días
    return [h, 'h ', m, 'm ', s, 's '].map(v => v.toString().padStart(2, 0)).join(''); // Formato horas, minutos, segundos
}


let handler = async (m, { conn, args }) => {
    let userId = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender;
    let user = global.db.data.users[userId];
    let name = conn.getName(userId);
    let _uptime = process.uptime() * 1000;
    let uptime = clockString(_uptime);
    let totalreg = Object.keys(global.db.data.users).length;
    let totalCommands = Object.values(global.plugins).filter((v) => v.help && v.tags).length;

    let botSettings = global.db.data.settings[conn.user.jid] || {};


    let txt = `
¡Hola ${name} Me llamo  ${botname} 

╭━━ INFO - BOT ━ 
┃Tiempo activo: ${uptime}
┃Registros ${totalreg}
┃Comandos ${totalCommands}
┃✦ Canal: https://whatsapp.com/channel/0029Vafoq2TFsn0kTerYCJ17
╰━━━━━━━━━━━━━

Quieres ser un sub bot?
Utiliza *#qr* ó *#code*

✰ Lista de comandos:

╭─⬣「 ✰DESCARGAS✰ 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#facebook + <url>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#play + <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#tiktok + <url>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#video + <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#audiodoc
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#videodoc
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#ig  + <url>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#mediafire + <url>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#spotify + <url>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#dl
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#hentaila <url/texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#tioanime <url/texto>
╰─⬣

╭─⬣「 🎴GACHA🎴 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#rw — Roll de personaje
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#claim — Reclamar
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#harem — Tu colección
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#fav <nombre>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#release <nombre>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#trade @user <nombre>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#tradeaccept / #tradereject
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#gift @user <nombre>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#searchchar <nombre>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#charinfo <nombre>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#topharem
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#claimmsg <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#addchar (owner/admin)
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#gachaadmin (owner)
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#votar <nombre>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#wimage <nombre>
╰─⬣

╭─⬣「 💰ECONOMÍA💰 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#perfil — Tu perfil RPG completo
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#perfil @user — Ver perfil de otro
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#top <xp|level|coins|diamantes> — Rankings
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#bal — Wallet + Banco + Rango
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#daily — Recompensa diaria + XP
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#work — Trabajar + XP
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#cazar — Cazar bestias + XP
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#aventura — Explorar mapas + XP
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#robar @user — Robar + XP
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#cofre — Cofre misterioso
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#heal — Curar heridas
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#deposit <cant> / #withdraw <cant>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#upgrade — Mejorar banco (💎)
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#transfer @user <cant>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#shop — Tienda de ítems
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#buy <item> [cant]
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#inv — Ver inventario
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#usar <item> [cant] — Usar ítem
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#regalar @user <item/coins> [cant]
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#logros / #claimlogro <n>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#familydaily
╰─⬣

╭─⬣「 💸APUESTAS💸 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#duelo @user <cantidad>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#ppt <piedra/papel/tijera> [apuesta]
╰─⬣

╭─⬣「 👪FAMILIA👪 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#pareja @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#divorcio
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#adoptar @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#desheredar @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#emancipar
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#familia — Ver tu familia
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#arbolfamilia
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#familiatop
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#herencia @user (admin)
╰─⬣

╭─⬣「 🎮JUEGOS🎮 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#bj <apuesta> — Blackjack
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#coinflip <cara/cruz> <apuesta>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#slot <apuesta> — Tragamonedas
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#ttt @user — Tres en raya
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#wordle — Adivina palabra
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#minas — Buscaminas
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#dados — Juego de dados
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#carrera <emoji> <apuesta>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#conecta4
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#hol <apuesta> — Mayor o Menor
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#ruleta <tipo> <apuesta>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#plinko <apuesta>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#gato @user — Tic-Tac-Toe
╰─⬣

╭─⬣「 🎭INTERACCIONES🎭 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#abrazo @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#beso @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#caricia @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#cachetada @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#golpe @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#morder @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#bailar @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#cosquillas @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#choca @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#llorar — y 50+ más
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#fraseanime
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#excusa
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#consejo
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#mision
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#titulo
╰─⬣

╭─⬣「 🤖IA / BOTS🤖 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#ia <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#gemini <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#toreal <img/responder a img>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#ai3d <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#imagen <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#voz <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#musica <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#waifus
╰─⬣

╭─⬣「 ✰BUSQUEDAS✰ 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#pinterest + <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#tiktoksearch + <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#tweetpost
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#wikipedia <búsqueda>
╰─⬣

╭─⬣「 ✰CONFIGURACIÓN✰ 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#antibot 
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#antidelete
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#antilink
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#antilink2
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#antiprivado
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#antispam
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#antisubbots
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#antitoxic
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#antitrabas
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#antiver
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#autoaceptar
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#autorechazar
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#autoresponder
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#autosticker
╰─⬣

╭─⬣「 🛡️GRUPOS🛡️ 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#promote @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#kick @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#warn @user [razón]
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#unwarn @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#warnlist
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#resetwarn @user
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#reglas
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#setreglas <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#addregla <regla>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#delregla <n>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#setwelcome
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#setbye
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#setprimary
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#tag
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#hidetag <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#notificar <texto>
╰─⬣

╭─⬣「 😴INACTIVOS😴 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#inactivos [días]
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#activos [días]
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#alertainactivos [días]
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#kickinactivos [días]
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#actividad @user
╰─⬣

╭─⬣「 ✰TOOLS✰ 」⬣
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#s — Sticker
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#qc — QuotedChat
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#toimg
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#p — Ping
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#cbx — Catbox/ImgBB
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#toghibli
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#imagedit
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#tofigure
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#hd / #remini
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#removebg — Quitar fondo
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#whatmusic — Identificar canción
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#traducir <texto>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#ss <url>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#definir <palabra>
│⁖ฺ۟̇࣪·֗٬̤⃟⚡#calc <expresión>
╰─⬣

> © Powered by Staff IKAIBOT-MD
`.trim();
    let bot = global.db.data.settings[conn.user.jid]
    // --- Lógica para elegir aleatoriamente entre video/gif o imagen ---
    const useVideo = Math.random() < 0.5; // 50% de probabilidad de usar video/gif
    let messageOptions = {};
    let selectedMediaUrl;

    if (useVideo && menuVideos.length > 0) {
        // --- Preparar mensaje con Video/GIF ---
        selectedMediaUrl = menuVideos[Math.floor(Math.random() * menuVideos.length)];
        messageOptions = {
            video: { url: selectedMediaUrl },
            gifPlayback: true, // Permite que los GIF se reproduzcan automáticamente
            caption: txt,
            mentions: [m.sender, userId] // Menciona a los usuarios relevantes
        };
    } else if (menuImages.length > 0) {
        selectedMediaUrl = menuImages[Math.floor(Math.random() * menuImages.length)];
        messageOptions = {
            text: txt,
            contextInfo: {
                mentionedJid: [m.sender, userId],
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: channelRD.id,
                    newsletterName: channelRD.name,
                    serverMessageId: -1,
                },
                forwardingScore: 999,
                externalAdReply: {
                    title: botname,
                    body: textbot,
                    thumbnailUrl: selectedMediaUrl,
                    sourceUrl: redes,
                    mediaType: 1,
                    showAdAttribution: false,
                    renderLargerThumbnail: true
                }
            }
        };
    } else {
        // --- Fallback: Si no hay videos ni imágenes, enviar solo texto ---
        messageOptions = {
            text: txt,
            mentions: [m.sender, userId]
        };
        console.warn("Advertencia: No se encontraron URLs en menuVideos ni menuImages. Enviando solo texto.");
    }

    // --- Enviar el mensaje ---
    try {
        await conn.sendMessage(m.chat, messageOptions, { quoted: m }); // Envía citando el mensaje original
    } catch (error) {
        console.error("Error al enviar el mensaje del menú:", error);
        // Enviar un mensaje de error simple si falla el envío complejo
        await conn.reply(m.chat, `Error al mostrar el menú. \n\n${txt}`, m);
    }
};


handler.help = ['menu'];
handler.tags = ['main'];
handler.command = ['menu', 'menú', 'help'];


export default handler;