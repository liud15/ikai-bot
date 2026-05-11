import sharp from 'sharp'
import fetch from 'node-fetch'
import { getUser, getRealJid } from '../src/lib/family-utils.js'

let handler = async (m, { conn }) => {
  const senderJid = getRealJid(m.sender)
  const me = getUser(senderJid)

  if (!me.marry) {
    return m.reply('❌ No tienes pareja registrada. Usa *#casar @usuario* para casarte primero.')
  }

  await m.reply('📜 *Imprimiendo Certificado de Matrimonio Oficial...*')

  const partnerJid = me.marry;

  const escapeXml = (str) => {
    if (!str) return '';
    return str.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;'; case '>': return '&gt;';
        case '&': return '&amp;'; case '\'': return '&apos;'; case '"': return '&quot;';
      }
    });
  };

  let senderName = escapeXml(conn.getName(senderJid) || senderJid.split('@')[0])
  let partnerName = escapeXml(conn.getName(partnerJid) || partnerJid.split('@')[0])

  if (senderName.length > 20) senderName = senderName.substring(0, 18) + '...'
  if (partnerName.length > 20) partnerName = partnerName.substring(0, 18) + '...'

  const width = 1200
  const height = 800

  // Molde para hacer los avatares circulares
  const circleMask = '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="100" fill="white"/></svg>';
  const fallbackSvg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="100" fill="#313244"/><circle cx="100" cy="80" r="35" fill="#45475a"/><path d="M 30 180 C 30 120, 170 120, 170 180" fill="#45475a"/></svg>`;

  async function processPic(jid) {
    try {
      const url = await conn.profilePictureUrl(jid, 'image')
      const res = await fetch(url)
      const buf = Buffer.from(await res.arrayBuffer())
      return await sharp(buf).resize(200, 200, { fit: 'cover' }).ensureAlpha().composite([{ input: Buffer.from(circleMask), blend: 'dest-in' }]).png().toBuffer()
    } catch (e) {
      return await sharp(Buffer.from(fallbackSvg)).png().toBuffer()
    }
  }

  // Descargar ambas fotos simultáneamente
  const [senderPic, partnerPic] = await Promise.all([processPic(senderJid), processPic(partnerJid)])

  const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })

  // Fondo base del diploma
  const bgSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#11111b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1e1e2e;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
    </svg>
    `;

  // Capa frontal: Marcos dorados y textos (se pone SOBRE las fotos)
  const overlaySvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f9e2af;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#fab387;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Marco Dorado Exterior -->
      <rect x="40" y="40" width="1120" height="720" fill="none" stroke="url(#gold)" stroke-width="6" />
      <rect x="55" y="55" width="1090" height="690" fill="none" stroke="url(#gold)" stroke-width="2" opacity="0.6"/>
      <rect x="25" y="25" width="1150" height="750" fill="none" stroke="url(#gold)" stroke-width="2" opacity="0.6"/>
      
      <!-- Esquinas Decorativas -->
      <path d="M 40 100 L 40 40 L 100 40" fill="none" stroke="url(#gold)" stroke-width="14"/>
      <path d="M 1160 100 L 1160 40 L 1100 40" fill="none" stroke="url(#gold)" stroke-width="14"/>
      <path d="M 40 700 L 40 760 L 100 760" fill="none" stroke="url(#gold)" stroke-width="14"/>
      <path d="M 1160 700 L 1160 760 L 1100 760" fill="none" stroke="url(#gold)" stroke-width="14"/>

      <!-- Título -->
      <text x="600" y="160" font-family="Georgia, serif" font-weight="bold" font-size="52" fill="url(#gold)" text-anchor="middle" letter-spacing="4">CERTIFICADO DE MATRIMONIO</text>
      <line x1="300" y1="190" x2="900" y2="190" stroke="url(#gold)" stroke-width="3" opacity="0.8"/>
      
      <!-- Subtítulo -->
      <text x="600" y="260" font-family="Arial, sans-serif" font-style="italic" font-size="28" fill="#bac2de" text-anchor="middle">El presente documento hace constar y certifica la sagrada unión entre:</text>

      <!-- Anillos dorados alrededor de los avatares -->
      <circle cx="350" cy="450" r="105" fill="none" stroke="url(#gold)" stroke-width="8"/>
      <circle cx="850" cy="450" r="105" fill="none" stroke="url(#gold)" stroke-width="8"/>

      <!-- Corazón en el centro -->
      <text x="600" y="470" font-family="Arial" font-size="80" text-anchor="middle">❤️</text>
      <text x="600" y="520" font-family="Georgia, serif" font-weight="bold" font-size="20" fill="url(#gold)" text-anchor="middle" letter-spacing="6">UNIDOS</text>

      <!-- Nombres -->
      <text x="350" y="610" font-family="Arial, sans-serif" font-weight="bold" font-size="35" fill="#cdd6f4" text-anchor="middle">${senderName}</text>
      <text x="850" y="610" font-family="Arial, sans-serif" font-weight="bold" font-size="35" fill="#cdd6f4" text-anchor="middle">${partnerName}</text>

      <!-- Pie de página (Firmas y fecha) -->
      <text x="600" y="700" font-family="Arial, sans-serif" font-size="22" fill="#a6adc8" text-anchor="middle">Día de Expedición: ${dateStr}</text>
      <text x="600" y="730" font-family="Arial, sans-serif" font-weight="bold" font-size="18" fill="url(#gold)" text-anchor="middle" opacity="0.8" letter-spacing="2">SELLADO POR IKAI-BOT REGISTRY</text>
    </svg>
    `;

  // 3 capas: Fondo -> Fotos -> Overlay
  const composites = [
    { input: senderPic, left: 250, top: 350 },
    { input: partnerPic, left: 750, top: 350 },
    { input: Buffer.from(overlaySvg), left: 0, top: 0 }
  ]

  const finalBuffer = await sharp(Buffer.from(bgSvg))
    .composite(composites)
    .png()
    .toBuffer()

  await conn.sendMessage(m.chat, {
    image: finalBuffer,
    caption: `💍 *CERTIFICADO OFICIAL* 💍\n\nQue viva el amor. Aquí está el documento legal que certifica su matrimonio en este grupo.\n\nFelicidades @${senderJid.split('@')[0]} y @${partnerJid.split('@')[0]} 🎉`,
    mentions: [senderJid, partnerJid]
  }, { quoted: m })
}

handler.help = ['certificado']
handler.tags = ['economy']
handler.command = ['certificado', 'actamatrimonio']
handler.group = true

export default handler
