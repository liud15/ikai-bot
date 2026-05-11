import sharp from 'sharp';
import fetch from 'node-fetch';

let handler = async (m, { conn, text }) => {
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? conn.user.jid : m.sender;
  let user = global.db.data.users[who];

  if (!user) return m.reply(`❌ El usuario no está en la base de datos.`);

  await m.reply('✨ *Generando perfil HD...* esto pondrá a trabajar al servidor.');

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

  // Datos del usuario
  let nameRaw = conn.getName(who) || user.name || 'Desconocido';
  // Evitar nombres exageradamente largos que rompan el diseño
  if (nameRaw.length > 15) nameRaw = nameRaw.substring(0, 15) + '...';
  const name = escapeXml(nameRaw);

  const roleRaw = user.role || 'Novato';
  const role = escapeXml(roleRaw);

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' Mill';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' Mil';
    return num.toLocaleString();
  };

  let level = user.level || 0;
  let exp = user.exp || 0;
  let limit = user.diamond || 0; // Diamantes
  let money = user.coin || 0; // Monedas
  let bank = user.bank || 0; // Banco

  // Lógica de experiencia
  let maxExp = level * 1000 + 500; // Fórmula estándar
  let expPercent = Math.min(100, Math.max(0, Math.floor((exp / maxExp) * 100)));

  // Foto de perfil
  let pp;
  try {
    pp = await conn.profilePictureUrl(who, 'image');
  } catch (e) {
    pp = 'https://telegra.ph/file/24fa902ead26340f3df2c.png'; // Avatar por defecto (Gatito oscuro)
  }

  // Descargar la foto a un Buffer
  let avatarBuffer;
  try {
    const res = await fetch(pp);
    avatarBuffer = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    avatarBuffer = Buffer.from('<svg width="250" height="250"><rect width="250" height="250" fill="#313244"/></svg>');
  }

  // Usar sharp para recortar el avatar en un círculo perfecto
  const avatarSize = 250;
  const circleSvg = `<svg width="${avatarSize}" height="${avatarSize}" xmlns="http://www.w3.org/2000/svg"><circle cx="${avatarSize/2}" cy="${avatarSize/2}" r="${avatarSize/2}" fill="white"/></svg>`;
  
  const circularAvatar = await sharp(avatarBuffer)
    .resize(avatarSize, avatarSize, { fit: 'cover' })
    .ensureAlpha() // Asegura que las imágenes JPG puedan tener transparencia
    .composite([{
      input: Buffer.from(circleSvg),
      blend: 'dest-in' // Recorta usando el círculo blanco
    }])
    .png()
    .toBuffer();

  // Dimensiones de la tarjeta base
  const width = 800;
  const height = 400;

  // Renderizado SVG (Diseño Aesthetic Oscuro)
  const svgLayout = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Degradado del fondo principal -->
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e1e2e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#11111b;stop-opacity:1" />
        </linearGradient>
        <!-- Degradado de la barra de experiencia -->
        <linearGradient id="bar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#89b4fa;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#cba6f7;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Fondo -->
      <rect width="100%" height="100%" rx="30" ry="30" fill="url(#bg)" />
      
      <!-- Círculos decorativos de fondo (Estilo Glassmorphism) -->
      <circle cx="800" cy="0" r="300" fill="#cba6f7" opacity="0.05" />
      <circle cx="0" cy="400" r="200" fill="#89b4fa" opacity="0.05" />

      <!-- Textos Principales -->
      <text x="330" y="100" font-family="Arial, sans-serif" font-weight="bold" font-size="45" fill="#cdd6f4">${name}</text>
      <text x="330" y="145" font-family="Arial, sans-serif" font-size="25" fill="#f38ba8">Rango: ${role}</text>
      
      <!-- Estadísticas de RPG -->
      <g transform="translate(330, 220)">
        <text x="20" y="0" font-family="Arial, sans-serif" font-size="18" fill="#a6adc8" text-anchor="middle">Lvl</text>
        <text x="20" y="30" font-family="Arial, sans-serif" font-weight="bold" font-size="26" fill="#cdd6f4" text-anchor="middle">${level}</text>
        
        <text x="130" y="0" font-family="Arial, sans-serif" font-size="18" fill="#a6adc8" text-anchor="middle">Cartera</text>
        <text x="130" y="30" font-family="Arial, sans-serif" font-weight="bold" font-size="26" fill="#f9e2af" text-anchor="middle">${formatNumber(money)}</text>
        
        <text x="260" y="0" font-family="Arial, sans-serif" font-size="18" fill="#a6adc8" text-anchor="middle">Banco</text>
        <text x="260" y="30" font-family="Arial, sans-serif" font-weight="bold" font-size="26" fill="#a6e3a1" text-anchor="middle">${formatNumber(bank)}</text>
        
        <text x="390" y="0" font-family="Arial, sans-serif" font-size="18" fill="#a6adc8" text-anchor="middle">Diamantes</text>
        <text x="390" y="30" font-family="Arial, sans-serif" font-weight="bold" font-size="26" fill="#89b4fa" text-anchor="middle">${formatNumber(limit)}</text>
      </g>

      <!-- Fondo oscuro de la barra de Experiencia -->
      <rect x="330" y="300" width="400" height="15" rx="7.5" ry="7.5" fill="#313244" />
      <!-- Frente coloreado de la barra de Experiencia (Calculado) -->
      <rect x="330" y="300" width="${400 * (expPercent / 100)}" height="15" rx="7.5" ry="7.5" fill="url(#bar)" />
      
      <!-- Texto de Exp arriba de la barra -->
      <text x="730" y="285" font-family="Arial, sans-serif" font-size="16" fill="#a6adc8" text-anchor="end">${exp.toLocaleString()} / ${maxExp.toLocaleString()} XP (${expPercent}%)</text>
    </svg>
  `;

  // Composición final: Une el fondo SVG con el avatar PNG circular usando el poder de Sharp
  const finalImageBuffer = await sharp(Buffer.from(svgLayout))
    .composite([
      { input: circularAvatar, top: 75, left: 40 }
    ])
    .png()
    .toBuffer();

  // Enviar el resultado
  await conn.sendMessage(m.chat, { 
    image: finalImageBuffer, 
    caption: `✨ *PERFIL AESTHETIC HD* ✨\n\n👤 *Usuario:* ${nameRaw}\n\n_Generado en alta resolución._`
  }, { quoted: m });
};

handler.help = ['perfilhd'];
handler.tags = ['economia'];
handler.command = ['perfilhd', 'phd', 'miperfil'];

export default handler;
