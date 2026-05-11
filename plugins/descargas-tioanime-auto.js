import { detail, download } from '../lib/tioanime.js';
import { File } from "megajs";
import fs from "fs";

const DB_FILE = './tioanime_db.json';

function readDB() {
    if (!fs.existsSync(DB_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch { return {}; }
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const CHECK_INTERVAL = 30 * 60 * 1000; // Revisar cada 30 minutos
const MAX_CHATS = 5;

let handler = async (m, { conn, command, usedPrefix, text, args }) => {
    let db = readDB();
    if (!db[m.chat]) db[m.chat] = { animes: [] };
    let chatAnimes = db[m.chat].animes;

    const action = args[0]?.toLowerCase();
    
    if (!action || !['add', 'remove', 'list', 'checknow'].includes(action)) {
        return m.reply(`\`Uso del comando:\`\n\n• ${usedPrefix + command} add <url> <día> <HH:MM>\n• ${usedPrefix + command} remove <url>\n• ${usedPrefix + command} list\n\n*Ejemplo:* ${usedPrefix + command} add https://tioanime.com/anime/dandadan Lunes 14:30\n\n_Nota: El horario ayuda al bot a solo buscar después de la emisión de ese día. Servicio exclusivo para un máximo de 5 grupos en total._`);
    }

    if (action === 'checknow') {
        if (!m.fromMe && !global.owner.map(v => v[0] + '@s.whatsapp.net').includes(m.sender)) {
             return m.reply('Este comando es solo para admins/owners.');
        }
        global.forceTioanimeCheck = true;
        global.lastTioanimeCheck = 0;
        return m.reply('Activando la búsqueda manual de nuevos capítulos en este instante (se ejecutará de fondo).');
    }

    if (action === 'list') {
        if (chatAnimes.length === 0) return m.reply('Este chat no está siguiendo ningún anime en emisión.');
        let txt = `📺 *Animes seguidos en este chat:*\n\n`;
        chatAnimes.forEach((anime, i) => {
            let sched = anime.day && anime.time ? `\n> \`Horario:\` ${anime.day} a las ${anime.time}` : "";
            txt += `*${i + 1}.* ${anime.title}\n> \`Último ep detectado:\` ${anime.lastEp}${sched}\n> \`Enlace:\` ${anime.url}\n\n`;
        });
        return m.reply(txt.trim());
    }

    if (action === 'add') {
        const url = args[1];
        const day = args[2]?.toLowerCase();
        const time = args[3];

        if (!url || !url.includes('tioanime.com/anime/')) return m.reply(`Por favor, proporciona el enlace del anime desde TioAnime.\nEjemplo: ${usedPrefix + command} add https://tioanime.com/anime/dandadan Lunes 14:30`);
        
        const validDays = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        if (!day || !validDays.includes(day.replace("é", "e").replace("á", "a"))) return m.reply(`Debes especificar el día de la semana.\nEjemplo: Lunes`);
        
        if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return m.reply(`Debes especificar la hora en formato 24h (HH:MM).\nEjemplo: 14:30`);

        // Check quota limit
        let currentActiveChats = Object.keys(db).filter(id => db[id].animes && db[id].animes.length > 0);
        // If this chat is not one of the active ones, and we reached the limit
        if (!currentActiveChats.includes(m.chat) && currentActiveChats.length >= MAX_CHATS) {
            return m.reply(`❌ Límite alcanzado. Ya hay ${MAX_CHATS} grupos utilizando el servicio de auto-descargas de TioAnime. ¡Se ha llenado el cupo!`);
        }

        if (chatAnimes.find(a => a.url === url)) return m.reply('Este anime ya está siendo seguido en este chat.');

        m.react('⌛');
        let info = await detail(url);
        if (info.error) {
            m.react('❌');
            return m.reply('Error al obtener la información del anime. Asegúrate de que el enlace sea correcto.');
        }

        let maxEpNum = 0;
        if (info.episodes && info.episodes.length > 0) {
            // Find highest episode number
            maxEpNum = Math.max(...info.episodes.map(e => parseInt(e.ep)));
        }

        let normalizedDay = day.replace("é", "e").replace("á", "a").replace("ó", "o");

        chatAnimes.push({
            title: info.title,
            url: url,
            lastEp: maxEpNum,
            day: normalizedDay,
            time: time
        });
        
        saveDB(db);

        m.react('✅');
        return m.reply(`✅ *${info.title}* añadido correctamente a la lista.\n\n> 📆 Se revisará automáticamente los **${normalizedDay}s** a partir de las **${time}** (+30 mins aprox.).\n> El último detectado fue el **${maxEpNum}**.`);
    }

    if (action === 'remove') {
        const urlOrIndex = args[1];
        if (!urlOrIndex) return m.reply(`Debes proporcionar el enlace o el número del anime a eliminar (usa ${usedPrefix + command} list).`);

        let index = parseInt(urlOrIndex) - 1;
        if (!isNaN(index) && index >= 0 && index < chatAnimes.length) {
            let removed = chatAnimes.splice(index, 1);
            saveDB(db);
            return m.reply(`Se ha dejado de seguir: *${removed[0].title}*`);
        } else {
            let removedIdx = chatAnimes.findIndex(a => a.url === urlOrIndex);
            if (removedIdx > -1) {
                let removed = chatAnimes.splice(removedIdx, 1);
                saveDB(db);
                return m.reply(`Se ha dejado de seguir: *${removed[0].title}*`);
            } else {
                return m.reply('No se encontró ese anime en la lista.');
            }
        }
    }
};

handler.before = async (m, { conn }) => {
    // Only set up background interval if not initialized in current session
    if (!global.lastTioanimeCheck) global.lastTioanimeCheck = Date.now();

    if (Date.now() - global.lastTioanimeCheck < CHECK_INTERVAL && !global.forceTioanimeCheck) {
        return;
    }

    global.lastTioanimeCheck = Date.now();
    global.forceTioanimeCheck = false; // Reset force flag if used

    // Delay helper to avoid rate limit
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    // Obtener la fecha y hora exacta en Perú (Lima) ignorando la hora GMT del servidor
    const nowServer = new Date();
    const peruDate = new Date(nowServer.toLocaleString("en-US", { timeZone: "America/Lima" }));
    
    const currentDayStr = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][peruDate.getDay()];
    const currentHour = peruDate.getHours();
    const currentMins = peruDate.getMinutes();
    const currentTimeInMins = (currentHour * 60) + currentMins;

    try {
        let db = readDB();
        let dbChanged = false;

        let activeChatsEntries = Object.keys(db).filter(id => db[id].animes && db[id].animes.length > 0);
        
        for (let chatId of activeChatsEntries) {
            let chatAnimes = db[chatId].animes;
            // Iterate safely over the list
            for (let i = 0; i < chatAnimes.length; i++) {
                let anime = chatAnimes[i];
                
                // Validate schedule
                if (anime.day && anime.time && !global.forceTioanimeCheck) {
                    if (anime.day !== currentDayStr) continue; // Not today
                    let [h, m] = anime.time.split(":").map(Number);
                    let schedTimeInMins = (h * 60) + m;
                    // Only check if current time is past (scheduled time + 30 mins)
                    if (currentTimeInMins < schedTimeInMins + 30) continue; 
                }

                let info = await detail(anime.url);
                
                if (info.error) {
                    await delay(5000);
                    continue; // Skip if Tioanime fails
                }
                
                let maxEp = info.episodes && info.episodes.length > 0 
                                ? Math.max(...info.episodes.map(e => parseInt(e.ep))) 
                                : anime.lastEp;

                if (maxEp > anime.lastEp) {
                    // New episodes detected! Loop from lastEp + 1 up to maxEp
                    for (let ep = anime.lastEp + 1; ep <= maxEp; ep++) {
                        // Find the episode link
                        let epData = info.episodes.find(e => parseInt(e.ep) === ep);
                        if (!epData) continue;
                        
                        try {
                            const inf = await download(epData.link);
                            if (!inf.error && inf.dl && inf.dl.sub) {
                                let videoBuffer;
                                if (inf.type === 'mega') {
                                    const file = File.fromURL(inf.dl.sub);
                                    await file.loadAttributes();
                                    videoBuffer = await file.downloadBuffer();
                                } else {
                                    const res = await fetch(inf.dl.sub);
                                    videoBuffer = Buffer.from(await res.arrayBuffer());
                                }
                                
                                await conn.sendFile(chatId, videoBuffer, `${anime.title} - ep ${ep}.mp4`, `✨ *¡NUEVO EPISODIO DETECTADO!*\n\n> 📺 *Anime:* ${anime.title}\n> 🍿 *Episodio:* ${ep}`, null, false, {
                                    mimetype: 'video/mp4',
                                    asDocument: true
                                });
                                // We update lastEp dynamically in case downloading next ones fail
                                anime.lastEp = ep;
                                dbChanged = true;
                                saveDB(db); // Save immediately on successful episode send to avoid duplicate downloads on crash
                            }
                        } catch (e) {
                            console.error(`Error auto-descargando ${anime.title} ep ${ep}:`, e);
                            // Break out to retry this episode later or next interval
                            break; 
                        }
                        await delay(15000); // 15s between episode downloads to not saturate WhatsApp / Mega
                    }
                }
                await delay(5000); // 5s between checking different animes
            }
        }
    } catch (err) {
        console.error('Error in TioAnime background checker handler:', err);
    }
}

handler.command = ["autotioanime", "autotio"];
handler.tags = ['download'];
handler.help = ["autotioanime <add|remove|list>"];
handler.admin = true; // Solo administradores del grupo pueden añadir animes para evitar spam
handler.group = true; // Recomendamos usarlo solo en grupos

export default handler;
