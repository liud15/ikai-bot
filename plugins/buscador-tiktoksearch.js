import axios from 'axios'

let handler = async (message, { conn, text, usedPrefix, command }) => {
    if (!text) return conn.reply(message.chat, `${emoji} Por favor, ingrese lo que desea buscar en tiktok.`, message)

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]
        }
    }

    try {
        await message.react(rwait)
        conn.reply(message.chat, `${emoji2} Descargando Su Video, espere un momento...`, message)

        let { data: response } = await axios.get(`https://api.evogb.org/search/tiktok?query=${encodeURIComponent(text)}&key=liu-ofc`)
        
        if (!response.status || !response.data || response.data.length === 0) {
            throw new Error('No se encontraron resultados.')
        }

        let searchResults = response.data
        shuffleArray(searchResults)
        let selectedResults = searchResults.slice(0, 7)

        // 1. Crear el Mensaje Padre (Álbum de Videos)
        const albumMessage = await conn.sendMessage(message.chat, {
            album: {
                expectedImageCount: 0,
                expectedVideoCount: selectedResults.length
            }
        }, { quoted: message })

        // 2. Enviar los videos agrupados en el álbum
        for (let i = 0; i < selectedResults.length; i++) {
            const result = selectedResults[i]
            await conn.sendMessage(message.chat, {
                video: { url: result.dl }, // La API usa 'dl' para el enlace del video
                caption: `${typeof emoji !== 'undefined' ? emoji : '✨'} *${result.title || 'TikTok Video'}*\n📹 Video ${i + 1}/${selectedResults.length}\n⪛✰ Tiktok - Búsquedas ✰⪜`,
                albumParentKey: albumMessage.key
            })
        }

        await message.react(done)
    } catch (error) {
        await conn.reply(message.chat, error.toString(), message)
    }
}

handler.help = ['tiktoksearch <txt>']
handler.tags = ['buscador']
handler.command = ['tiktoksearch', 'ttss', 'tiktoks']
handler.group = true

export default handler
