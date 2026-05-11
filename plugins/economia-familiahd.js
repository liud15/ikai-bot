import sharp from 'sharp'
import fetch from 'node-fetch'
import { getUser, getRealJid } from '../src/lib/family-utils.js'

let handler = async (m, { conn }) => {
    const senderJid = getRealJid(m.sender)
    const me = getUser(senderJid)

    // Recopilar todos los JIDs de la familia
    const jidsToFetch = [senderJid]
    if (me.marry) jidsToFetch.push(me.marry)
    me.parents.forEach(p => jidsToFetch.push(p))
    me.children.forEach(c => jidsToFetch.push(c))

    if (jidsToFetch.length === 1) {
        return m.reply('❌ No tienes una familia registrada aún.\nUsa los comandos `#adoptar`, `#casarse` para empezar tu linaje.')
    }

    await m.reply('✨ *Generando tu Árbol Genealógico en HD...*')

    // Diccionario para guardar imágenes y nombres
    const peopleData = {}
    
    // Imagen por defecto en caso de que alguien no tenga foto
    const fallbackSvg = `<svg width="150" height="150" xmlns="http://www.w3.org/2000/svg">
        <circle cx="75" cy="75" r="75" fill="#313244"/>
        <circle cx="75" cy="60" r="25" fill="#45475a"/>
        <path d="M 25 130 C 25 90, 125 90, 125 130" fill="#45475a"/>
    </svg>`;
    const fallbackBuffer = await sharp(Buffer.from(fallbackSvg)).png().toBuffer();

    // Molde circular para recortar las fotos
    const circleMask = '<svg width="150" height="150" xmlns="http://www.w3.org/2000/svg"><circle cx="75" cy="75" r="75" fill="white"/></svg>';

    const escapeXml = (str) => {
        if (!str) return '';
        // Eliminar emojis para evitar cajas negras rotas en el renderizado
        str = str.replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();
        return str.replace(/[<>&'"]/g, c => {
            switch (c) {
                case '<': return '&lt;'; case '>': return '&gt;';
                case '&': return '&amp;'; case '\'': return '&apos;'; case '"': return '&quot;';
            }
        });
    };

    // Descargar las fotos de perfil en paralelo
    await Promise.all(jidsToFetch.map(async (jid) => {
        let name = await conn.getName(jid) || global.db.data.users[jid]?.name || jid.split('@')[0]
        name = escapeXml(name)
        if (name.length > 10) name = name.substring(0, 9) + '...'

        let picBuffer = fallbackBuffer
        try {
            const url = await conn.profilePictureUrl(jid, 'image')
            const res = await fetch(url)
            const buf = Buffer.from(await res.arrayBuffer())
            picBuffer = await sharp(buf)
                .resize(150, 150, { fit: 'cover' })
                .ensureAlpha()
                .composite([{ input: Buffer.from(circleMask), blend: 'dest-in' }])
                .png()
                .toBuffer()
        } catch(e) {}

        peopleData[jid] = { name, image: picBuffer }
    }))

    // Configuración del lienzo
    const width = 1080
    const height = 1080

    // Calcular posiciones Y de las generaciones
    const hasParents = me.parents.length > 0
    const hasChildren = me.children.length > 0
    
    const activeTiers = []
    if (hasParents) activeTiers.push('parents')
    activeTiers.push('sender')
    if (hasChildren) activeTiers.push('children')

    const tierY = {}
    if (activeTiers.length === 3) {
        tierY['parents'] = 280; tierY['sender'] = 580; tierY['children'] = 880;
    } else if (activeTiers.length === 2) {
        tierY[activeTiers[0]] = 380; tierY[activeTiers[1]] = 750;
    } else {
        tierY['sender'] = 540;
    }

    const yTier1 = tierY['parents']
    const yTier2 = tierY['sender']
    const yTier3 = tierY['children']

    const positions = {}

    // Posiciones Generación 2: Tú y tu pareja
    if (me.marry) {
        positions[senderJid] = { x: 380, y: yTier2 } 
        positions[me.marry] = { x: 700, y: yTier2 }
    } else {
        positions[senderJid] = { x: 540, y: yTier2 }
    }
    
    // Posiciones Generación 1: Padres
    if (hasParents) {
        const pSpacing = 250
        const pStartX = 540 - ((me.parents.length - 1) * pSpacing / 2)
        me.parents.forEach((pJid, i) => {
            positions[pJid] = { x: pStartX + (i * pSpacing), y: yTier1 }
        })
    }
    
    // Posiciones Generación 3: Hijos
    if (hasChildren) {
        let cSpacing = 280
        if (me.children.length > 3) cSpacing = 200 // Si hay muchos hijos, juntarlos más
        const cStartX = 540 - ((me.children.length - 1) * cSpacing / 2)
        me.children.forEach((cJid, i) => {
            positions[cJid] = { x: cStartX + (i * cSpacing), y: yTier3 }
        })
    }

    // 1. DIBUJAR FONDO Y LÍNEAS (Base SVG)
    let baseSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e1e2e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#11111b;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      
      <!-- Círculos decorativos -->
      <circle cx="0" cy="0" r="400" fill="#cba6f7" opacity="0.03" />
      <circle cx="1080" cy="1080" r="500" fill="#89b4fa" opacity="0.03" />
    `;
    
    // Línea matrimonial
    if (me.marry) {
        baseSvg += `<line x1="${positions[senderJid].x + 75}" y1="${yTier2}" x2="${positions[me.marry].x - 75}" y2="${yTier2}" stroke="#f38ba8" stroke-width="4" stroke-dasharray="10,10"/>`
    }
    // Líneas ascendentes (Padres)
    me.parents.forEach(pJid => {
        baseSvg += `<line x1="${positions[pJid].x}" y1="${yTier1 + 75}" x2="${positions[senderJid].x}" y2="${yTier2 - 75}" stroke="#a6adc8" stroke-width="4" opacity="0.7"/>`
    })
    // Líneas descendentes (Hijos)
    me.children.forEach(cJid => {
        const sourceX = me.marry ? 540 : positions[senderJid].x
        baseSvg += `<line x1="${sourceX}" y1="${yTier2 + 40}" x2="${positions[cJid].x}" y2="${yTier3 - 75}" stroke="#89b4fa" stroke-width="4" opacity="0.7"/>`
    })
    
    baseSvg += `</svg>`;

    // 2. DIBUJAR NOMBRES Y BORDES (Capa superior SVG)
    let topSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="540" y="80" font-family="Arial, sans-serif" font-weight="bold" font-size="50" fill="#cdd6f4" text-anchor="middle">ÁRBOL GENEALÓGICO</text>
      <text x="540" y="125" font-family="Arial, sans-serif" font-size="25" fill="#a6adc8" text-anchor="middle">La Familia de ${peopleData[senderJid].name}</text>
    `;

    // Corazón Matrimonial Vectorial (Evita que salga negro en Linux/Pterodactyl)
    if (me.marry) {
        topSvg += `<path d="M 540 ${yTier2+20} C 540 ${yTier2+20} 525 ${yTier2} 525 ${yTier2-10} A 15 15 0 0 1 540 ${yTier2+5} A 15 15 0 0 1 555 ${yTier2-10} C 555 ${yTier2} 540 ${yTier2+20} 540 ${yTier2+20}" fill="#f38ba8" />`
    }

    // Dibujar anillos y nombres de cada persona
    for (const [jid, pos] of Object.entries(positions)) {
        let isMain = jid === senderJid;
        
        // Etiqueta de Rol
        let role = '';
        if (me.parents.includes(jid)) role = 'Padre/Madre';
        else if (me.children.includes(jid)) role = 'Hijo/Hija';
        else if (isMain) role = 'Tú';
        else if (jid === me.marry) role = 'Pareja';

        topSvg += `
            <circle cx="${pos.x}" cy="${pos.y}" r="78" fill="none" stroke="${isMain ? '#f5c2e7' : '#cba6f7'}" stroke-width="6"/>
            <text x="${pos.x}" y="${pos.y + 115}" font-family="Arial, sans-serif" font-weight="bold" font-size="22" fill="#cdd6f4" text-anchor="middle">${peopleData[jid].name}</text>
            <text x="${pos.x}" y="${pos.y + 145}" font-family="Arial, sans-serif" font-weight="bold" font-size="16" fill="${isMain ? '#f5c2e7' : '#a6adc8'}" text-anchor="middle">${role.toUpperCase()}</text>
        `
    }
    
    topSvg += `</svg>`;

    // 3. COMPONER LA IMAGEN FINAL CON SHARP
    const composites = []
    
    // Insertar las fotos en sus coordenadas
    for (const [jid, pos] of Object.entries(positions)) {
        composites.push({
            input: peopleData[jid].image,
            left: pos.x - 75,
            top: pos.y - 75
        })
    }
    
    // Colocar la capa de textos por encima de todo
    composites.push({ input: Buffer.from(topSvg), left: 0, top: 0 })

    const finalImageBuffer = await sharp(Buffer.from(baseSvg))
        .composite(composites)
        .png()
        .toBuffer()

    await conn.sendMessage(m.chat, { 
        image: finalImageBuffer, 
        caption: `🌳 *El Linaje de ${peopleData[senderJid].name}* 🌳\n\nAquí tienes el mapa visual de tu familia.`
    }, { quoted: m })
}

handler.help = ['arbolhd']
handler.tags = ['economy']
handler.command = ['arbolhd', 'familiahd']
handler.group = true

export default handler
