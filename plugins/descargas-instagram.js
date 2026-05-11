import { igdl } from 'ruhend-scraper';
import fetch from 'node-fetch';

const handler = async (m, { args, conn }) => {
  if (!args[0]) {
    return conn.reply(m.chat, `${emoji} Por favor, ingresa un enlace de Instagram.`, m);
  }

  try {
    await m.react(rwait);
    let data;
    try {
      const res = await igdl(args[0]);
      data = res.data;
      if (!data || data.length === 0) throw new Error('No data');
    } catch {
      const fallbackRes = await fetch(`https://api.evogb.org/dl/instagram?url=${encodeURIComponent(args[0])}&key=liu-ofc`);
      const fallbackJson = await fallbackRes.json();
      if (!fallbackJson.status) throw new Error('Fallback failed');
      data = fallbackJson.data;
    }

    if (!data || data.length === 0) throw new Error('No data found');

    for (let media of data) {
      await conn.sendFile(m.chat, media.url, '', `${emoji} Aqui tienes.`, m);
    }
    await m.react(done);
  } catch (e) {
    await m.react(error);
    return conn.reply(m.chat, `${msm} Ocurrió un error.`, m);
  }
};

handler.command = ['instagram', 'ig'];
handler.tags = ['descargas'];
handler.help = ['instagram', 'ig'];
handler.group = true;

export default handler;
