import fetch from "node-fetch";
import crypto from "crypto";
import { fileTypeFromBuffer } from "file-type";
import FormData from "form-data";
import axios from "axios";

const IMGBB_API_KEY = '61821b3046b1b570b2257434ad48d97c';

let handler = async (m, { conn }) => {
  let q = m.quoted ? m.quoted : m;
  let mime = (q.msg || q).mimetype || '';
  if (!mime) return conn.reply(m.chat, `❌ Por favor, responde a un archivo válido (imagen, video, etc.).`, m);

  await m.react('⏳');

  try {
    let media = await q.download();
    let isImage = /image\/(png|jpe?g|gif|webp)/.test(mime);

    let link;
    let servicio;
    if (isImage) {
      try {
        const imgBbLink = await uploadToImgBB(media);
        link = imgBbLink;
        servicio = 'ImgBB';
      } catch (e) {
        console.log("ImgBB falló, intentando con Freeimage.host...", e.message);
        const fiLink = await freeimage(media);
        link = fiLink;
        servicio = 'Freeimage.host (Fallback)';
      }
    } else {
      const fiLink = await freeimage(media);
      link = fiLink;
      servicio = 'Freeimage.host';
    }

    let txt = `*乂 U P L O A D E R 乂*\n\n`;
    txt += `*» Enlace:* ${link}\n`;
    txt += `*» Tamaño:* ${formatBytes(media.length)}\n`;
    txt += `*» Servicio:* ${servicio}\n`;

    await conn.reply(m.chat, txt, m);
    await m.react('✅');
  } catch (e) {
    console.error('Error en uploader:', e);
    await m.react('❌');
    await conn.reply(m.chat, '❌ Error al subir el archivo: ' + (e?.message || 'desconocido'), m);
  }
};

handler.help = ['tourl2'];
handler.tags = ['transformador'];
handler.command = ['catbox', 'tourl2', 'cbx', 'imgbb'];
export default handler;

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
}

async function uploadToImgBB(buffer) {
  const base64 = buffer.toString('base64');
  const boundary = '----ImgBBMitaBot' + crypto.randomBytes(8).toString('hex');

  const part1 = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="key"\r\n\r\n` +
    `${IMGBB_API_KEY}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="image"\r\n\r\n` +
    `${base64}\r\n`,
    'utf-8'
  );
  const part2 = Buffer.from(`--${boundary}--\r\n`, 'utf-8');
  const body = Buffer.concat([part1, part2]);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: body,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": body.length,
    },
  });

  const json = await response.json();
  if (!json.success) throw new Error(json.error?.message || 'Error al subir imagen');
  return json.data.url;
}

async function freeimage(content) {
  const { ext, mime } = (await fileTypeFromBuffer(content)) || { ext: 'bin', mime: 'application/octet-stream' };
  const randomName = crypto.randomBytes(5).toString("hex") + "." + ext;

  const form = new FormData();
  form.append('key', '6d207e02198a847aa98d0a2a901485a5');
  form.append('action', 'upload');
  form.append('format', 'json');
  form.append('source', content, { filename: randomName, contentType: mime });

  const response = await axios.post("https://freeimage.host/api/1/upload", form, {
    headers: {
      ...form.getHeaders()
    }
  });

  const responseData = response.data;
  console.log("[Fallback] Respuesta de Freeimage.host:", JSON.stringify(responseData));

  if (responseData && responseData.status_code === 200 && responseData.image && responseData.image.url) {
    return responseData.image.url;
  }
  throw new Error("Respuesta inválida de Freeimage.host");
}
