import yts from 'yt-search'
import axios from 'axios'

const MAX_VIDEO_SIZE = 160 * 1024 * 1024 // 160 MB

let handler = async (m, { conn, text, command, usedPrefix }) => {
  if (!text) return m.reply(
    `🎬 Ingresa el nombre o link del video.\n` +
    `Ejemplo: *${usedPrefix + command} Ma Meilleure Ennemie*\n` +
    `También puedes pegar un link de YouTube directamente.`
  )

  try {
    await m.reply('⏳ Buscando y descargando video, espera un momento...')

    // Buscar video si es texto, si es URL la mantiene
    const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
    const query = videoMatch ? 'https://youtu.be/' + videoMatch[1] : text

    const search = await yts(query)
    if (!search.videos.length) throw new Error('Video no encontrado, ¡intenta con otro título!')

    const video = videoMatch
      ? search.videos.find(v => v.videoId === videoMatch[1]) || search.videos[0]
      : search.videos[0]

    const videoUrl = video.url

    // Usar VidsSave para obtener enlace compatible con WhatsApp (H.264/AAC)
    const scraper = new VidsSave()
    const result = await scraper.scrape(videoUrl)

    if (!result || !result.status || !result.medias.video.available) {
      throw new Error('No se pudo obtener un video compatible de este enlace.')
    }

    const downloadUrl = result.medias.video.url
    const fileSizeStr = result.medias.video.size || 'Desconocido'
    const fileName = sanitizeFilename(video.title || 'video') + '.mp4'

    const caption = `
乂  *Y T - V I D E O*

   ⭔  *Título* : ${video.title || 'N/A'}
   ⭔  *Canal* : ${video.author?.name || 'YouTube'}
   ⭔  *Duración* : ${video.timestamp || 'N/A'}
   ⭔  *Vistas* : ${video.views?.toLocaleString() || 'N/A'}
   ⭔  *Subido* : ${video.ago || 'N/A'}
   ⭔  *Calidad* : ${result.medias.video.quality || 'N/A'}
   ⭔  *Tamaño* : ${fileSizeStr}

${global.wm || ''}`.trim()

    // ── video2 / video2hd / mp4: enviar como video de WhatsApp ────
    if (command === 'video2' || command === 'video2hd' || command === 'mp4') {
      await conn.sendMessage(m.chat, {
        video: { url: downloadUrl },
        mimetype: 'video/mp4',
        fileName,
        caption
      }, { quoted: m })

      // ── video2doc: siempre como documento .mp4 ───────────────────
    } else if (command === 'video2doc') {
      await conn.sendMessage(m.chat, {
        document: { url: downloadUrl },
        mimetype: 'video/mp4',
        fileName,
        caption
      }, { quoted: m })
    }

  } catch (e) {
    console.error('Error en descargas-video2:', e)
    await m.reply(`❌ Ocurrió un error.\n*Detalles:* ${e.message}`)
  }
}

handler.help = ['video2 <título|link>', 'video2hd <título|link>', 'video2doc <título|link>', 'mp4 <título|link>']
handler.tags = ['downloader']
handler.command = ['video2', 'video2hd', 'video2doc', 'mp4']
handler.limit = true
handler.daftar = true

export default handler

function sanitizeFilename(name = 'video') {
  return name.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 150)
}

class VidsSave {
  constructor() {
    this.baseUrl = "https://api.vidssave.com";
    this.authToken = "20250901majwlqo";
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36",
      "accept": "*/*",
      "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/x-www-form-urlencoded",
      "sec-ch-ua": "\"Chromium\";v=\"133\", \"Not_A Brand\";v=\"24\"",
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": "\"Android\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "Referer": "https://vidssave.com/",
      "Origin": "https://vidssave.com",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    };
  }

  getQualityScore(qualityStr) {
    if (!qualityStr) return 0;
    const q = qualityStr.toLowerCase();
    if (q.includes("720")) return 100;
    if (q.includes("1080")) return 90;
    if (q.includes("480")) return 70;
    if (q.includes("360")) return 60;
    return 10;
  }

  async getResources(url) {
    try {
      const body = `auth=${this.authToken}&domain=api-ak.vidssave.com&origin=source&link=${encodeURIComponent(url)}`;
      const { data } = await axios.post(`${this.baseUrl}/api/contentsite_api/media/parse`, body, {
        headers: this.headers
      });

      if (!data || data.status !== 1) throw new Error("Link no válido o falló el parseo");
      return data.data;
    } catch (error) {
      return null;
    }
  }

  async resolveDownloadLink(resourceToken) {
    if (!resourceToken) return null;
    try {
      const taskBody = `auth=${this.authToken}&domain=api-ak.vidssave.com&request=${encodeURIComponent(resourceToken)}&no_encrypt=1`;
      const { data: taskData } = await axios.post(`${this.baseUrl}/api/contentsite_api/media/download`, taskBody, { headers: this.headers });

      if (!taskData || taskData.status !== 1) return null;

      const queryParams = new URLSearchParams({
        auth: this.authToken,
        domain: "api-ak.vidssave.com",
        task_id: taskData.data.task_id,
        download_domain: "vidssave.com",
        origin: "content_site"
      }).toString();

      let finalUrl = null;
      for (let i = 0; i < 15; i++) {
        const { data: sseString } = await axios.get(`${this.baseUrl}/sse/contentsite_api/media/download_query?${queryParams}`, {
          headers: { ...this.headers, "accept": "text/event-stream" },
          responseType: "text"
        });

        const lines = sseString.split("\n");
        for (const line of lines) {
          if (line.includes("data:")) {
            try {
              const json = JSON.parse(line.replace("data:", "").replace("event: success", "").trim());
              if (json.status === "success" && json.download_link) {
                finalUrl = json.download_link;
                break;
              }
            } catch (e) { }
          }
        }
        if (finalUrl) break;
        await new Promise(r => setTimeout(r, 1000));
      }
      return finalUrl;
    } catch (e) {
      return null;
    }
  }

  async scrape(url) {
    const data = await this.getResources(url);
    if (!data) return { status: false, msg: "Fallo al obtener metadatos" };

    const { title, thumbnail, duration, resources } = data;

    let videoResources = resources.filter(r => r.type === "video");
    videoResources.sort((a, b) => this.getQualityScore(b.quality) - this.getQualityScore(a.quality));

    const bestVideo = videoResources[0];
    const audioResource = resources.find(r => r.type === "audio");

    const [videoUrl, audioUrl] = await Promise.all([
      bestVideo ? this.resolveDownloadLink(bestVideo.resource_content) : Promise.resolve(null),
      audioResource ? this.resolveDownloadLink(audioResource.resource_content) : Promise.resolve(null)
    ]);

    return {
      status: true,
      title: title,
      thumbnail: thumbnail,
      duration: duration,
      medias: {
        video: {
          available: !!videoUrl,
          quality: bestVideo ? bestVideo.quality : null,
          size: bestVideo ? bestVideo.size : 0,
          extension: bestVideo ? bestVideo.format : "mp4",
          url: videoUrl
        },
        audio: {
          available: !!audioUrl,
          extension: "mp3",
          url: audioUrl
        }
      }
    };
  }
}
