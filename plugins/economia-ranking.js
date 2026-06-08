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
    if (typeof unsafe !== 'string') return String(unsafe);
    return unsafe.replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
}

// ──────────────────────────────────────────────────────────────────────────────
// Posiciones del podio: [1ro centro, 2do izq, 3ro der]
// ──────────────────────────────────────────────────────────────────────────────
const PODIUM_POS = [
    { cx: 450, avatarTop: 110, avatarSize: 178 },  // 1er (centro, grande)
    { cx: 178, avatarTop: 178, avatarSize: 142 },  // 2do (izq, mediano)
    { cx: 722, avatarTop: 198, avatarSize: 126 },  // 3ro (der, pequeño)
];

// Medallas
const MEDALS = [
    { ringGrad:'goldRing', plateGrad:'goldPlate', shadow:'rgba(255,215,0,0.4)',  label:'1ER LUGAR', labelBg:'#c8920a', labelColor:'#fff8e0', valueColor:'#ffd54f' },
    { ringGrad:'silverRing', plateGrad:'silverPlate', shadow:'rgba(180,180,200,0.35)', label:'2DO LUGAR', labelBg:'#606070', labelColor:'#e8e8f0', valueColor:'#c8c8d8' },
    { ringGrad:'bronzeRing', plateGrad:'bronzePlate', shadow:'rgba(200,120,40,0.35)',  label:'3ER LUGAR', labelBg:'#7d4e1e', labelColor:'#f0d0a0', valueColor:'#cd8040' },
];

// Calcula la altura necesaria para el podio dinámicamente
function calcPodiumH() {
    let maxY = 0;
    for (let i = 0; i < PODIUM_POS.length; i++) {
        const pos = PODIUM_POS[i];
        const avatarR = pos.avatarSize / 2;
        const avatarCY = pos.avatarTop + avatarR;
        const ringR = avatarR + 11;
        const plateY = avatarCY + ringR + 4;
        const valueY = plateY + 44 + 56;   // plateH=44, offset texto=56
        maxY = Math.max(maxY, valueY);
    }
    return maxY + 28;  // padding inferior del podio
}

let handler = async (m, { conn, text, usedPrefix }) => {
  const input = (text || '').trim().toLowerCase()

  if (!input || input === 'help') {
    const lista = Object.entries(CATEGORIES).map(([k, c]) => `  • *${usedPrefix}top ${k}* — ${c.emoji} ${c.label}`).join('\n')
    return m.reply(`🏆 *Rankings HD del grupo*\n\n${lista}\n\nEjemplo: *${usedPrefix}top coins*`)
  }

  const cat = CATEGORIES[input]
  if (!cat) return m.reply(`❌ Categoría inválida.\nOpciones: ${Object.keys(CATEGORIES).join(', ')}`)

  const allUsers = global.db.data.users
  let entries = Object.entries(allUsers).filter(([, u]) => u && typeof u === 'object')

  if (input === 'salud') entries = entries.filter(([, u]) => Number.isFinite(u.health) && u.health > 0)

  entries.sort((a, b) => cat.key(b[1]) - cat.key(a[1]))
  const topUsers = entries.slice(0, 10)
  if (topUsers.length === 0) return m.reply('📭 No hay usuarios con datos en esta categoría aún.')

  await m.reply(`✨ *Generando Ranking HD de ${cat.label}...*`)

  // Mapa inverso lidmap: @lid → número real (para mostrar en lugar del LID crudo)
  const lidmap = global.db.data.lidmap || {}
  const lidToPhone = {}
  for (const [lid, real] of Object.entries(lidmap)) {
      if (lid.endsWith('@lid')) lidToPhone[lid] = real.split('@')[0]
  }

  const usersData = await Promise.all(topUsers.map(async ([jid, u], i) => {
      // 1) Nombre guardado en la DB (más fiable tras la migración)
      let nameRaw = (u.name && u.name.trim()) ? u.name.trim() : ''
      // 2) Nombre del store de contactos (conn.chats)
      if (!nameRaw) nameRaw = conn.getName(jid) || ''
      // 3) Si es un LID y no hay nombre, usar el número real del lidmap
      if (!nameRaw && jid.endsWith('@lid') && lidToPhone[jid]) {
          nameRaw = '+' + lidToPhone[jid]
      }
      // 4) Último recurso: número del JID (sin el @...)
      if (!nameRaw) nameRaw = jid.split('@')[0]

      // Podio (top 3): espacio limitado → max 14 chars
      // Lista (4-10): espacio amplio → max 22 chars
      const maxNameLen = i < 3 ? 14 : 22;
      if (nameRaw.length > maxNameLen) nameRaw = nameRaw.substring(0, maxNameLen - 2) + '..';
      const name  = escapeXml(nameRaw);
      const value = escapeXml(cat.fmt(cat.key(u)));
      let picUrl = '';
      try { picUrl = await conn.profilePictureUrl(jid, 'image') } catch(e) {}
      return { jid, name, value, picUrl, rank: i + 1 };
  }));

  // ── Dimensiones ────────────────────────────────────────────────
  const W = 900;
  const PODIUM_H = calcPodiumH();   // altura dinámica, sin espacio muerto
  const ROW_H = 86;
  const listCount = Math.max(0, usersData.length - 3);
  const H = PODIUM_H + listCount * ROW_H + 30;

  // ── Procesado de imágenes circulares ───────────────────────────
  async function processImage(url, size) {
      const h = size / 2;
      const fallback = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${h}" cy="${h}" r="${h}" fill="#1e2040"/>
          <circle cx="${h}" cy="${h - size*0.1}" r="${size*0.22}" fill="#2e3060"/>
          <path d="M ${size*0.22} ${size*0.82} C ${size*0.22} ${size*0.52} ${size*0.78} ${size*0.52} ${size*0.78} ${size*0.82}" fill="#2e3060"/>
      </svg>`;
      const mask = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${h}" cy="${h}" r="${h}" fill="white"/></svg>`;
      try {
          if (!url) throw new Error();
          const res = await fetch(url);
          const buf = Buffer.from(await res.arrayBuffer());
          return await sharp(buf).resize(size, size, { fit:'cover' }).ensureAlpha()
              .composite([{ input: Buffer.from(mask), blend:'dest-in' }]).png().toBuffer();
      } catch(e) {
          return await sharp(Buffer.from(fallback)).png().toBuffer();
      }
  }

  const composites = [];

  // ── Estrellitas estáticas (posiciones fijas para reproducibilidad) ──
  const STARS = [
      [32,45],[80,130],[130,60],[200,20],[310,50],[390,30],[480,15],[560,40],
      [650,25],[720,55],[800,35],[860,90],[870,200],[840,300],[20,250],
      [55,350],[100,420],[820,420],[150,170],[700,160],[260,140],[610,90],
      [400,100],[500,70],[750,300],[300,300],[450,440],[600,430],
  ];

  // ── SVG principal ──────────────────────────────────────────────
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <!-- Fondo -->
  <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%"   stop-color="#0b0d22"/>
    <stop offset="55%"  stop-color="#0f1230"/>
    <stop offset="100%" stop-color="#080b1e"/>
  </linearGradient>
  <!-- Halo superior -->
  <radialGradient id="topHalo" cx="50%" cy="0%" r="60%">
    <stop offset="0%" stop-color="#1e2666" stop-opacity="0.85"/>
    <stop offset="100%" stop-color="#0b0d22" stop-opacity="0"/>
  </radialGradient>
  <!-- Halos laterales -->
  <radialGradient id="haloL" cx="0%" cy="55%" r="40%">
    <stop offset="0%" stop-color="#141a50" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="#0b0d22" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="haloR" cx="100%" cy="55%" r="40%">
    <stop offset="0%" stop-color="#141a50" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="#0b0d22" stop-opacity="0"/>
  </radialGradient>
  <!-- Medalla DORADA -->
  <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%"   stop-color="#ffe066"/>
    <stop offset="45%"  stop-color="#ffd700"/>
    <stop offset="100%" stop-color="#a06800"/>
  </linearGradient>
  <linearGradient id="goldPlate" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%"   stop-color="#ffe566"/>
    <stop offset="50%"  stop-color="#d4a017"/>
    <stop offset="100%" stop-color="#8b6000"/>
  </linearGradient>
  <!-- Medalla PLATA -->
  <linearGradient id="silverRing" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%"   stop-color="#e8e8f0"/>
    <stop offset="45%"  stop-color="#b8b8c8"/>
    <stop offset="100%" stop-color="#606070"/>
  </linearGradient>
  <linearGradient id="silverPlate" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%"   stop-color="#d0d0e0"/>
    <stop offset="50%"  stop-color="#9090a0"/>
    <stop offset="100%" stop-color="#404050"/>
  </linearGradient>
  <!-- Medalla BRONCE -->
  <linearGradient id="bronzeRing" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%"   stop-color="#e8a050"/>
    <stop offset="45%"  stop-color="#cd7f32"/>
    <stop offset="100%" stop-color="#6b3a10"/>
  </linearGradient>
  <linearGradient id="bronzePlate" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%"   stop-color="#dba060"/>
    <stop offset="50%"  stop-color="#b07030"/>
    <stop offset="100%" stop-color="#5a2c08"/>
  </linearGradient>
  <!-- Fila lista -->
  <linearGradient id="rowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="#1a1c38"/>
    <stop offset="100%" stop-color="#141628"/>
  </linearGradient>
  <!-- Degradado título -->
  <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="#90b8ff"/>
    <stop offset="50%"  stop-color="#ffffff"/>
    <stop offset="100%" stop-color="#90b8ff"/>
  </linearGradient>
  <!-- Filtros -->
  <filter id="glow">
    <feGaussianBlur stdDeviation="2.5" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="rowShadow">
    <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgba(0,0,0,0.6)"/>
  </filter>
  <filter id="medalGlow">
    <feGaussianBlur stdDeviation="4" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>

<!-- Fondo base -->
<rect width="${W}" height="${H}" rx="26" ry="26" fill="url(#bgGrad)"/>
<rect width="${W}" height="${H}" rx="26" ry="26" fill="url(#topHalo)"/>
<rect width="${W}" height="${H}" rx="26" ry="26" fill="url(#haloL)"/>
<rect width="${W}" height="${H}" rx="26" ry="26" fill="url(#haloR)"/>

<!-- Estrellas -->
${STARS.map(([sx, sy]) => `<circle cx="${sx}" cy="${sy}" r="1.2" fill="white" opacity="0.55"/>`).join('\n')}
<text x="45"  y="80" font-size="20" fill="white" opacity="0.4" text-anchor="middle">✦</text>
<text x="855" y="95" font-size="16" fill="white" opacity="0.35" text-anchor="middle">✦</text>
<text x="100" y="370" font-size="13" fill="white" opacity="0.25" text-anchor="middle">✦</text>
<text x="808" y="360" font-size="14" fill="white" opacity="0.25" text-anchor="middle">✦</text>

<!-- ══ TÍTULO ══ -->
<text x="78"  y="70" font-family="Arial Black,Arial" font-size="26" fill="url(#titleGrad)" text-anchor="middle" opacity="0.8">◆</text>
<text x="822" y="70" font-family="Arial Black,Arial" font-size="26" fill="url(#titleGrad)" text-anchor="middle" opacity="0.8">◆</text>
<text x="${W/2}" y="72" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="40" fill="url(#titleGrad)" text-anchor="middle" filter="url(#glow)" letter-spacing="3">${escapeXml(cat.label.toUpperCase())}</text>
`;

  // ── Render del podio (orden z: 2do, 3ro, 1ro) ─────────────────
  const renderOrder = [1, 2, 0];

  for (const ri of renderOrder) {
    if (ri >= usersData.length) continue;
    const user = usersData[ri];
    const pos  = PODIUM_POS[ri];
    const med  = MEDALS[ri];
    const cx   = pos.cx;
    const aR   = pos.avatarSize / 2;
    const aCY  = pos.avatarTop + aR;
    const ringR  = aR + 11;
    const outerR = ringR + 9;
    const plateW = outerR * 2 + 14;
    const plateH = 44;
    const plateX = cx - plateW / 2;
    const plateY = aCY + ringR + 4;
    const nameY  = plateY + plateH + 28;
    const valY   = nameY + 26;
    // badge encima del avatar
    const badgeW = 116;
    const badgeH = 28;
    const badgeX = cx - badgeW / 2;
    const badgeY = pos.avatarTop - badgeH - 6;

    // Avatar composite
    const imgBuf = await processImage(user.picUrl, pos.avatarSize);
    composites.push({ input: imgBuf, left: Math.round(cx - aR), top: Math.round(pos.avatarTop) });

    const nameFontSize = ri === 0 ? 23 : 19;
    const valFontSize  = ri === 0 ? 19 : 16;

    svg += `
<!-- ── Podio puesto ${ri + 1} ── -->
<!-- Halo de color -->
<circle cx="${cx}" cy="${aCY}" r="${outerR + 16}" fill="${med.shadow}" opacity="0.5"/>
<!-- Anillo exterior -->
<circle cx="${cx}" cy="${aCY}" r="${outerR}" fill="none" stroke="url(#${med.ringGrad})" stroke-width="11" filter="url(#medalGlow)"/>
<!-- Anillo interior delgado -->
<circle cx="${cx}" cy="${aCY}" r="${ringR - 2}" fill="none" stroke="white" stroke-width="1.5" opacity="0.2"/>
<!-- Plataforma -->
<rect x="${plateX}" y="${plateY}" width="${plateW}" height="${plateH}" rx="12" fill="url(#${med.plateGrad})"/>
<!-- Brillo plataforma -->
<rect x="${plateX + 8}" y="${plateY + 5}" width="${plateW - 16}" height="10" rx="5" fill="white" opacity="0.2"/>
<!-- Badge de posición -->
<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="9" fill="${med.labelBg}"/>
<rect x="${badgeX + 1}" y="${badgeY + 1}" width="${badgeW - 2}" height="${badgeH - 2}" rx="8" fill="none" stroke="white" stroke-width="0.8" opacity="0.3"/>
<text x="${cx}" y="${badgeY + badgeH - 8}" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="14" fill="${med.labelColor}" text-anchor="middle" letter-spacing="1">${escapeXml(med.label)}</text>
<!-- Nombre -->
<text x="${cx}" y="${nameY}" font-family="Arial,sans-serif" font-weight="700" font-size="${nameFontSize}" fill="#dde4ff" text-anchor="middle">${escapeXml(user.name)}</text>
<!-- Valor -->
<text x="${cx}" y="${valY}" font-family="Arial,sans-serif" font-weight="700" font-size="${valFontSize}" fill="${med.valueColor}" text-anchor="middle">${escapeXml(user.value)}</text>
`;
  }

  // ── Separador podio / lista ────────────────────────────────────
  svg += `
<!-- Separador -->
<line x1="40" y1="${PODIUM_H - 8}" x2="${W - 40}" y2="${PODIUM_H - 8}" stroke="#2a2d50" stroke-width="1.5"/>
`;

  // ── Lista posiciones 4–10 ──────────────────────────────────────
  let listY = PODIUM_H;

  for (let i = 3; i < usersData.length; i++) {
    const user = usersData[i];
    const aSize  = 54;          // avatar de lista
    const rankW  = 62;          // ancho reservado para el número de rank
    const gap    = 12;          // espacio entre avatar y nombre
    const aCX2   = rankW + aSize / 2 + 4;   // cx del avatar = 93
    const rowY   = listY;
    const aCY2   = rowY + ROW_H / 2;
    const nameX  = aCX2 + aSize / 2 + gap;  // inicio del nombre
    const valX   = W - 32;                  // fin del valor (right-aligned)

    const imgBuf = await processImage(user.picUrl, aSize);
    composites.push({ input: imgBuf, left: Math.round(aCX2 - aSize / 2), top: Math.round(aCY2 - aSize / 2) });

    svg += `
<!-- Fila #${user.rank} -->
<rect x="26" y="${rowY + 5}" width="${W - 52}" height="${ROW_H - 10}" rx="16" fill="url(#rowGrad)" stroke="#24274a" stroke-width="1.5" filter="url(#rowShadow)"/>
<!-- Número rank (right-aligned dentro de su columna) -->
<text x="${rankW - 4}" y="${aCY2 + 8}" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="19" fill="#5060a0" text-anchor="end">#${user.rank}</text>
<!-- Borde avatar -->
<circle cx="${aCX2}" cy="${aCY2}" r="${aSize / 2 + 3}" fill="none" stroke="#30345a" stroke-width="2"/>
<!-- Nombre usuario -->
<text x="${nameX}" y="${aCY2 + 8}" font-family="Arial,sans-serif" font-weight="700" font-size="20" fill="#c8d4ff">${escapeXml(user.name)}</text>
<!-- Valor -->
<text x="${valX}" y="${aCY2 + 8}" font-family="Arial,sans-serif" font-weight="700" font-size="20" fill="#f5cc4e" text-anchor="end">${escapeXml(user.value)} ◆</text>
`;
    listY += ROW_H;
  }

  svg += `</svg>`;

  // ── Renderizar imagen final ────────────────────────────────────
  const finalImageBuffer = await sharp(Buffer.from(svg))
      .composite(composites)
      .png()
      .toBuffer();

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
