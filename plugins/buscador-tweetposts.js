// By Jtxs 🐢
// https://whatsapp.com/channel/0029Vafoq2TFsn0kTerYC

import axios from 'axios';

let handler = async (m, { conn, text }) => {
    if (!text) { return conn.reply(m.chat, `${emoji} Por favor, ingresa el texto de Lo que quieres buscar en Twitter.`, m); }

    await m.react(rwait)
    conn.reply(m.chat, `${emoji} Buscando tweets, espere un momento...`, m)

    try {
        let api = await axios.get(`https://apis-starlights-team.koyeb.app/starlight/Twitter-Posts`, {
            params: { text: encodeURIComponent(text) },
            headers: { 'Content-Type': 'application/json' }
        });

        let json = api.data.result;
        let resultsToDisplay = json.slice(0, 7);

        for (let i = 0; i < resultsToDisplay.length; i++) {
            const res = resultsToDisplay[i]
            let caption = `👤 *User:* ${res.user}\n`
            caption += `📅 *Publicacion:* ${res.post}\n`
            caption += `☁️ *Perfil:* ${res.profile}\n`
            caption += `🔗 *Link:* ${res.user_link}\n`
            caption += `\n📌 Tweet ${i + 1}/${resultsToDisplay.length}\n⪛✰ Tweetposts - Búsquedas ✰⪜`

            await conn.sendMessage(m.chat, {
                image: { url: res.profile },
                caption: caption
            }, { quoted: i === 0 ? m : undefined })
            if (i < resultsToDisplay.length - 1) await new Promise(r => setTimeout(r, 1500))
        }

        await m.react(done)
    } catch (error) {
        console.error(error)
        await conn.reply(m.chat, '❌ Ocurrió un error al buscar los tweets.', m)
    }
}

handler.help = ['tweetposts']
handler.tags = ['buscador']
handler.command = ['tweetposts']

export default handler;
