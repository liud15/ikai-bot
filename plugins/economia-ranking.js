import sharp from 'sharp'
import fetch from 'node-fetch'
import { getRankLabel } from '../lib/levelRanks.js'

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' Mill';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' Mil';
  return num.toLocaleString();
};

const CATEGORIES = {
  xp:        { label: 'TOP EXPERIENCIA', emoji: '✨', key: u => Number(u.exp || 0),                               fmt: v => `${formatNumber(v)} XP` },
  level:     { label: 'TOP NIVELES',     emoji: '📊', key: u => Number(u.level || 0),                             fmt: v => `Nv. ${formatNumber(v)}` },
  coins:     { label: 'TOP MILLONARIOS', emoji: '🪙', key: u => Number(u.coin || u.money || 0) + Number(u.bank || 0), fmt: v => `${formatNumber(v)} Coins` },
  diamantes: { label: 'TOP DIAMANTES',   emoji: '💎', key: u => Number(u.diamond || u.limit || 0),                fmt: v => `${formatNumber(v)} Diamantes` },
  salud:     { label: 'TOP SALUD',       emoji: '❤️', key: u => Number(u.health || 0),                            fmt: v => `${formatNumber(v)}/1000` },
}

function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;'; case '>': return '&gt;';
            case '&': return '&amp;'; case '\'': return '&apos;'; case '"': return '&quot;';
        }
    });
}

let handler = async (m, { conn, text, usedPrefix }) => {
  const input = (text || '').trim().toLowerCase()

  if (!input || input === 'help') {
    const lista = Object.entries(CATEGORIES).map(([k, c]) => `  • *${usedPrefix}top ${k}* — ${c.emoji} ${c.label}`).join('\n')
    return m.reply(`🏆 *Rankings HD del grupo*\n\n${lista}\n\nEjemplo: *${usedPrefix}top coins*`)
  }

  const cat = CATEGORIES[input]
  if (!cat) {
    return m.reply(`❌ Categoría inválida.\nOpciones: ${Object.keys(CATEGORIES).join(', ')}`)
  }

  const allUsers = global.db.data.users
  let entries = Object.entries(allUsers).filter(([, u]) => u && typeof u === 'object')

  // El ranking ahora es GLOBAL por defecto para mostrar a los mejores de toda la base de datos

  if (input === 'salud') {
    entries = entries.filter(([, u]) => Number.isFinite(u.health) && u.health > 0)
  }

  // Ordenar
  entries.sort((a, b) => cat.key(b[1]) - cat.key(a[1]))
  
  const topUsers = entries.slice(0, 10)

  if (topUsers.length === 0) {
    return m.reply('📭 No hay usuarios con datos en esta categoría aún.')
  }

  await m.reply(`✨ *Generando Ranking HD de ${cat.label}...*`)

  // Descargar fotos y preparar datos en paralelo
  const usersData = await Promise.all(topUsers.map(async ([jid, u], i) => {
      let nameRaw = conn.getName(jid) || jid.split('@')[0];
      if (nameRaw.length > 15) nameRaw = nameRaw.substring(0, 13) + '...';
      const name = escapeXml(nameRaw);
      const value = escapeXml(cat.fmt(cat.key(u)));
      
      let picUrl = '';
      try { picUrl = await conn.profilePictureUrl(jid, 'image') } catch(e) {}
      
      return { jid, name, value, picUrl, rank: i + 1 };
  }));

  const width = 1000;
  // Alto dinámico: Podio (550px) + 90px por cada usuario extra
  const listCount = Math.max(0, usersData.length - 3);
  const height = 550 + (listCount * 90);

  let baseSvg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#11111b;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#1e1e2e;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" rx="30" ry="30" fill="url(#bg)" />
    
    <!-- Texto Principal -->
    <text x="500" y="80" font-family="Arial, sans-serif" font-weight="bold" font-size="50" fill="#cba6f7" text-anchor="middle">${cat.label.toUpperCase()}</text>
  `;

  // --- PODIO (Top 1 al 3) ---
  const podiumPositions = [
      { x: 500, y: 160, size: 200, color: '#f9e2af', medal: '1ER LUGAR' }, // 1ro
      { x: 220, y: 220, size: 150, color: '#a6adc8', medal: '2DO LUGAR' }, // 2do
      { x: 780, y: 250, size: 130, color: '#f38ba8', medal: '3ER LUGAR' }  // 3ro
  ];

  const composites = [];

  async function processImage(url, size) {
      const fallbackSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#313244"/>
          <circle cx="${size/2}" cy="${size/2 - size*0.1}" r="${size*0.25}" fill="#45475a"/>
          <path d="M ${size*0.2} ${size*0.8} C ${size*0.2} ${size*0.5}, ${size*0.8} ${size*0.5}, ${size*0.8} ${size*0.8}" fill="#45475a"/>
      </svg>`;
      const maskSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`;
      try {
          if(!url) throw new Error();
          const res = await fetch(url);
          const buf = Buffer.from(await res.arrayBuffer());
          return await sharp(buf).resize(size, size, {fit: 'cover'}).ensureAlpha().composite([{input: Buffer.from(maskSvg), blend: 'dest-in'}]).png().toBuffer();
      } catch(e) {
          return await sharp(Buffer.from(fallbackSvg)).png().toBuffer();
      }
  }

  // Generar Podio
  for (let i = 0; i < Math.min(3, usersData.length); i++) {
      const user = usersData[i];
      const pos = podiumPositions[i];
      
      const imgBuffer = await processImage(user.picUrl, pos.size);
      composites.push({ input: imgBuffer, left: pos.x - pos.size/2, top: pos.y });

      // Anillo y Textos del podio
      baseSvg += `
          <circle cx="${pos.x}" cy="${pos.y + pos.size/2}" r="${pos.size/2 + 5}" fill="none" stroke="${pos.color}" stroke-width="6"/>
          <text x="${pos.x}" y="${pos.y + pos.size + 35}" font-family="Arial, sans-serif" font-weight="bold" font-size="26" fill="#cdd6f4" text-anchor="middle">${user.name}</text>
          <text x="${pos.x}" y="${pos.y + pos.size + 65}" font-family="Arial, sans-serif" font-weight="bold" font-size="20" fill="${pos.color}" text-anchor="middle">${user.value}</text>
          <text x="${pos.x}" y="${pos.y - 15}" font-family="Arial, sans-serif" font-weight="bold" font-size="18" fill="${pos.color}" text-anchor="middle">${pos.medal}</text>
      `;
  }

  // --- LISTA (Top 4 al 10) ---
  let listY = 530; // Posición de inicio de la lista
  for (let i = 3; i < usersData.length; i++) {
      const user = usersData[i];
      const size = 60;
      
      const imgBuffer = await processImage(user.picUrl, size);
      composites.push({ input: imgBuffer, left: 140, top: listY });

      baseSvg += `
          <rect x="70" y="${listY - 10}" width="860" height="80" rx="20" ry="20" fill="#181825" stroke="#313244" stroke-width="2"/>
          <text x="120" y="${listY + 38}" font-family="Arial, sans-serif" font-weight="bold" font-size="28" fill="#bac2de" text-anchor="end">#${user.rank}</text>
          
          <circle cx="${140 + size/2}" cy="${listY + size/2}" r="${size/2 + 2}" fill="none" stroke="#bac2de" stroke-width="2"/>
          
          <text x="220" y="${listY + 38}" font-family="Arial, sans-serif" font-weight="bold" font-size="26" fill="#cdd6f4">${user.name}</text>
          <text x="900" y="${listY + 38}" font-family="Arial, sans-serif" font-weight="bold" font-size="26" fill="#f9e2af" text-anchor="end">${user.value}</text>
      `;
      listY += 90;
  }

  baseSvg += `</svg>`;

  const finalImageBuffer = await sharp(Buffer.from(baseSvg))
      .composite(composites)
      .png()
      .toBuffer();

  // Buscar tu posición
  const myIdx = entries.findIndex(([jid]) => jid === m.sender);
  const myPosTxt = myIdx !== -1 ? `\n📍 *Tu posición:* #${myIdx + 1}` : '';

  await conn.sendMessage(m.chat, {
      image: finalImageBuffer,
      caption: `${cat.emoji} *Top 10 — ${cat.label}* ${cat.emoji}\n\nAquí están los líderes actuales.${myPosTxt}`
  }, { quoted: m });
}

handler.help    = ['top [xp|level|coins|diamantes|salud]']
handler.tags    = ['economy']
handler.command = ['top', 'ranking', 'rank', 'leaderboard']
handler.group   = true

export default handler
