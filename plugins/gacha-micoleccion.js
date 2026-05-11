import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

let handler = async (m, { conn }) => {
    const chat = global.db.data.chats[m.chat]

    if (!chat.gacha || !chat.gacha.claimed) {
        return m.reply('❌ No hay datos de gacha en este grupo.');
    }

    const rawTargetUser = m.sender;
    const targetUser = m.sender;
    let userNameRaw = conn.getName(rawTargetUser) || 'Usuario'
    if (userNameRaw.length > 15) userNameRaw = userNameRaw.substring(0, 15) + '...';

    const escapeXml = (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    };
    const userName = escapeXml(userNameRaw);

    // Leer base de datos
    let characters;
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8');
        const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
        characters = JSON.parse(clean);
    } catch (e) {
        return m.reply('❌ Error al leer la base de datos de personajes.');
    }

    // Filtrar los personajes del usuario
    const userChars = [];
    for (const [charId, data] of Object.entries(chat.gacha.claimed)) {
        if (data.owner === targetUser) {
            const char = characters.find(c => String(c.id) === charId);
            if (char) {
                userChars.push({ ...char, claimData: data });
            }
        }
    }

    if (userChars.length === 0) {
        return m.reply('📭 No tienes personajes en tu colección de este grupo. ¡Usa #rw para reclamar uno!');
    }

    await m.reply('✨ *Generando tu Showcase en HD...* Esto tomará un momento mientras renderizamos.');

    // Ordenar por valor (los más caros primero)
    userChars.sort((a, b) => (parseInt(b.value) || 0) - (parseInt(a.value) || 0));

    // Tomar los 4 mejores
    const topChars = userChars.slice(0, 4);

    // Función para procesar la imagen de cada personaje con Sharp
    async function getCharImage(url) {
        const maskSvg = '<svg width="220" height="320" xmlns="http://www.w3.org/2000/svg"><rect width="220" height="320" rx="20" ry="20" fill="white"/></svg>';
        
        try {
            if (!url) throw new Error("No URL");
            const res = await fetch(url);
            const buffer = Buffer.from(await res.arrayBuffer());
            
            return await sharp(buffer)
                .resize(220, 320, { fit: 'cover' })
                .ensureAlpha()
                .composite([{
                    input: Buffer.from(maskSvg),
                    blend: 'dest-in'
                }])
                .png()
                .toBuffer();
        } catch(e) {
            // Caja estética si no tiene imagen o falla
            const fallbackSvgBase = `<svg width="220" height="320" xmlns="http://www.w3.org/2000/svg">
                <rect width="220" height="320" rx="20" ry="20" fill="#313244"/>
                <circle cx="110" cy="140" r="40" fill="#45475a"/>
                <text x="110" y="220" font-family="Arial, sans-serif" font-weight="bold" font-size="20" fill="#a6adc8" text-anchor="middle">SIN IMAGEN</text>
            </svg>`;
            return await sharp(Buffer.from(fallbackSvgBase)).png().toBuffer();
        }
    }

    // Descargar/Renderizar las imágenes en paralelo
    const charImages = await Promise.all(topChars.map(c => getCharImage(c.img && c.img.length > 0 ? c.img[0] : '')));

    const width = 1040;
    const height = 550;

    // Fondo Base SVG
    const baseSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#11111b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1e1e2e;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="30" ry="30" fill="url(#bg)" />
      
      <!-- Decoración Glassmorphism -->
      <circle cx="1040" cy="0" r="400" fill="#f5c2e7" opacity="0.05" />
      <circle cx="0" cy="550" r="300" fill="#b4befe" opacity="0.05" />
    </svg>
    `;

    // Capa de textos y marcos
    let overlaySvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="520" y="80" font-family="Arial, sans-serif" font-weight="bold" font-size="45" fill="#cdd6f4" text-anchor="middle">SHOWCASE DE ${userName.toUpperCase()}</text>
      <text x="520" y="115" font-family="Arial, sans-serif" font-size="22" fill="#a6adc8" text-anchor="middle">Tus Personajes Más Valiosos</text>
    `;

    const xOffsets = [40, 280, 520, 760];
    const imageY = 140;

    topChars.forEach((char, i) => {
        const x = xOffsets[i];
        
        let charName = escapeXml(char.name);
        if (charName.length > 15) charName = charName.substring(0, 14) + '...';

        let value = parseInt(char.value) || 0;
        let starCount = value >= 7000 ? 5 : value >= 4000 ? 4 : value >= 2000 ? 3 : value >= 1000 ? 2 : 1;
        
        let starsSvg = '';
        const starWidth = 20;
        const spacing = 5;
        const totalWidth = (starCount * starWidth) + ((starCount - 1) * spacing);
        let currentX = x + 110 - (totalWidth / 2);
        const starY = imageY + 365;

        for (let j = 0; j < starCount; j++) {
            starsSvg += `<polygon points="10,1 12.5,7.5 19,7.5 14,12 16,18.5 10,15 4,18.5 6,12 1,7.5 7.5,7.5" fill="#f9e2af" transform="translate(${currentX}, ${starY})"/>`;
            currentX += starWidth + spacing;
        }

        overlaySvg += `
            <!-- Marco exterior -->
            <rect x="${x-4}" y="${imageY-4}" width="228" height="328" rx="24" ry="24" fill="none" stroke="#cba6f7" stroke-width="4" opacity="0.6"/>
            <!-- Textos abajo -->
            <text x="${x + 110}" y="${imageY + 355}" font-family="Arial, sans-serif" font-weight="bold" font-size="22" fill="#cdd6f4" text-anchor="middle">${charName}</text>
            <!-- Estrellas de rareza -->
            ${starsSvg}
        `;
    });

    overlaySvg += `</svg>`;

    // Juntar la base, las 4 fotos y la capa de texto arriba
    const composites = [
        ...charImages.map((img, i) => ({ input: img, top: imageY, left: xOffsets[i] })),
        { input: Buffer.from(overlaySvg), top: 0, left: 0 }
    ];

    const finalImageBuffer = await sharp(Buffer.from(baseSvg))
        .composite(composites)
        .png()
        .toBuffer();

    await conn.sendMessage(m.chat, { 
        image: finalImageBuffer, 
        caption: `✨ *Colección Premium de ${userNameRaw}* ✨\n\nPresumiendo a tus mejores waifus/husbandos.\nTotal en Harem: *${userChars.length}* personajes.`
    }, { quoted: m });
};

handler.help = ['micoleccion'];
handler.tags = ['gacha'];
handler.command = ['micoleccion', 'showcase', 'coleccionhd'];
handler.group = true;

export default handler;
