import axios from 'axios';
import * as cheerio from 'cheerio';

const baseURL = 'https://tioanime.com';

async function search(query) {
  try {
    const { data } = await axios.get(`${baseURL}/directorio?q=${encodeURIComponent(query)}`);
    const $ = cheerio.load(data);
    const results = [];

    $('ul.row li').each((i, el) => {
      const article = $(el).find('article.anime');
      if (article.length) {
        const title = article.find('h3.title').text().trim();
        const link = baseURL + article.find('a').attr('href');
        let img = baseURL + article.find('img').attr('src');
        if (img.includes('/uploads/thumbs/')) {
            img = img.replace('/uploads/thumbs/', '/uploads/portadas/');
        }
        results.push({ title, link, img: img });
      }
    });
    return results;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function detail(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    const $ = cheerio.load(data);
    
    const title = $('h1.title').text().trim() || $('h1').first().text().trim();
    const img = baseURL + $('div.thumb img').attr('src');
    const description = $('p.sinopsis').text().trim() || $('div.sinopsis').text().trim();
    
    let episodes = [];
    const scriptRegex = /var anime_info = \[(.*?)\];\s*var episodes = \[(.*?)\];/s;
    const match = data.match(scriptRegex);
    if (match) {
      try {
        const animeInfo = JSON.parse(`[${match[1]}]`);
        const epsData = JSON.parse(`[${match[2]}]`);
        const slug = animeInfo[1];
        episodes = epsData.map(e => {
          const epNum = Array.isArray(e) ? e[0] : e;
          return {
            ep: String(epNum),
            img: '', // tioanime doesn't expose ep images easily here
            link: `${baseURL}/ver/${slug}-${epNum}`
          };
        }).reverse(); // Episodes are usually highest to lowest on tioanime script, so reverse to 1 -> end
      } catch (e) {
        console.error(e);
      }
    }
  
    return { 
        title, 
        description, 
        cover: img,
        episodes,
        total: episodes.length
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function download(url) {
  try {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });

    const $ = cheerio.load(data);
    const title = $('h1.anime-title').text().trim() || $('title').text().trim();

    const vidRegex = /var videos = (\[.*?\]);/s;
    const match = data.match(vidRegex);
    if (!match) return { title, error: 'No videos found' };
    
    let videos = [];
    try {
      videos = JSON.parse(match[1]);
    } catch (e) { return { title, error: 'Failed parsing video data' }; }
  
    let yourUploadUrl = '';
    let megaUrl = '';

    for (const v of videos) {
      if (v[0].toLowerCase() === 'mega') {
        megaUrl = v[1];
      }
      if (v[0].toLowerCase() === 'yourupload') {
        yourUploadUrl = v[1];
      }
    }
  
    // Prioritize Mega per user request
    if (megaUrl) {
        megaUrl = megaUrl.replace(/\\\//g, '/');
        // Convert /embed/!ID!KEY to /file/ID#KEY so megajs can parse it
        if (megaUrl.includes('/embed/!')) {
            const parts = megaUrl.split('!');
            megaUrl = `https://mega.nz/file/${parts[1]}#${parts[2]}`;
        } else if (megaUrl.includes('/embed#!')) {
            const parts = megaUrl.split('!');
            megaUrl = `https://mega.nz/file/${parts[1]}#${parts[2]}`;
        }
        return { title, dl: { sub: megaUrl }, type: 'mega' };
    }

    if (!yourUploadUrl) return { title, error: 'No se encontraron servidores Mega ni YourUpload para este episodio.' };
    yourUploadUrl = yourUploadUrl.replace(/\\\//g, '/');
    
    try {
      const { data: yuData } = await axios.get(yourUploadUrl, {
        headers: { 'Referer': baseURL + '/' }
      });
      const yu$ = cheerio.load(yuData);
      let mp4 = yu$('meta[property="og:video"]').attr('content');
      if (!mp4) {
        const jwMatch = yuData.match(/file:\s*'(https?:\/\/[^']+\.mp4[^']*)'/i);
        if (jwMatch) mp4 = jwMatch[1];
      }
      
      if (mp4) {
        return { title, dl: { sub: mp4 }, type: 'direct' };
      } else {
        return { title, error: 'No se pudo extraer el enlace directo de YourUpload.' };
      }
    } catch (e) {
      return { title, error: 'Error accediendo a YourUpload.' };
    }
  } catch (err) {
      return { error: err.message };
  }
}

export { search, detail, download };
