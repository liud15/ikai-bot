let handler = async (m, { conn, text }) => {
    if (!text) {
        return m.reply(`📺 *Uso:* #ainfo <nombre del anime>

*Ejemplos:*
• #ainfo Chainsaw Man
• #ainfo Attack on Titan
• #ainfo Death Note

Busca información de un anime usando la API de MyAnimeList.`)
    }

    const query = text.trim()

    await m.reply('🔍 Buscando información del anime...')

    try {
        // Buscar anime en Jikan API (MyAnimeList)
        const searchRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1&sfw=true`)

        if (!searchRes.ok) {
            throw new Error(`API respondió con status ${searchRes.status}`)
        }

        const searchData = await searchRes.json()

        if (!searchData.data || searchData.data.length === 0) {
            return m.reply(`❌ No se encontró ningún anime con: *${query}*\n\nIntenta con otro nombre.`)
        }

        const anime = searchData.data[0]

        // Formatear géneros
        const genres = anime.genres?.map(g => g.name).join(', ') || 'Desconocido'

        // Formatear estudios
        const studios = anime.studios?.map(s => s.name).join(', ') || 'Desconocido'

        // Formatear estado
        const statusMap = {
            'Finished Airing': '✅ Finalizado',
            'Currently Airing': '📡 En emisión',
            'Not yet aired': '🔜 Por estrenar'
        }
        const status = statusMap[anime.status] || anime.status || 'Desconocido'

        // Formatear tipo
        const typeMap = {
            'TV': '📺 TV',
            'Movie': '🎬 Película',
            'OVA': '📀 OVA',
            'ONA': '🌐 ONA',
            'Special': '⭐ Especial',
            'Music': '🎵 Música'
        }
        const type = typeMap[anime.type] || anime.type || 'Desconocido'

        // Formatear temporada
        const season = anime.season
            ? `${anime.season.charAt(0).toUpperCase() + anime.season.slice(1)} ${anime.year || ''}`
            : (anime.year ? `${anime.year}` : 'Desconocido')

        // Formatear sinopsis (limitar largo)
        let synopsis = anime.synopsis || 'Sin sinopsis disponible.'
        if (synopsis.length > 500) {
            synopsis = synopsis.substring(0, 497) + '...'
        }
        // Limpiar sinopsis de tags HTML
        synopsis = synopsis.replace(/\[.*?\]/g, '').replace(/\n+/g, '\n').trim()

        // Rating
        const rating = anime.rating || 'No clasificado'

        // Títulos alternativos
        const altTitles = []
        if (anime.title_english && anime.title_english !== anime.title) altTitles.push(anime.title_english)
        if (anime.title_japanese) altTitles.push(anime.title_japanese)
        const altTitlesText = altTitles.length > 0 ? altTitles.join(' | ') : 'N/A'

        const caption = `
╭─⬣「 📺 INFO DE ANIME 」⬣
│
│ 🎴 *${anime.title}*
│ 🏷️ *Otros títulos:* ${altTitlesText}
│
│ 📊 *Tipo:* ${type}
│ 📺 *Episodios:* ${anime.episodes || '?'}
│ ⏱️ *Duración:* ${anime.duration || 'Desconocido'}
│ 📡 *Estado:* ${status}
│ 📅 *Temporada:* ${season}
│
│ ⭐ *Puntuación MAL:* ${anime.score || 'N/A'}/10
│ 👥 *Miembros:* ${anime.members?.toLocaleString() || 'N/A'}
│ 📊 *Ranking:* #${anime.rank || 'N/A'}
│ 💖 *Popularidad:* #${anime.popularity || 'N/A'}
│
│ 🎭 *Géneros:* ${genres}
│ 🎬 *Estudio:* ${studios}
│ 🔞 *Clasificación:* ${rating}
│
│ 📝 *Sinopsis:*
│ ${synopsis}
│
│ 🔗 ${anime.url || ''}
│
╰─⬣ Fuente: MyAnimeList ⬣
    `.trim()

        // Enviar con imagen de portada si existe
        if (anime.images?.jpg?.large_image_url) {
            try {
                await conn.sendMessage(m.chat, {
                    image: { url: anime.images.jpg.large_image_url },
                    caption: caption
                }, { quoted: m })
                return
            } catch (e) { }
        }

        await conn.reply(m.chat, caption, m)

    } catch (e) {
        console.error('[anime-info] Error:', e.message)

        if (e.message.includes('429') || e.message.includes('Too Many')) {
            return m.reply('⏳ La API está temporalmente saturada. Intenta de nuevo en unos segundos.')
        }

        return m.reply(`❌ Error al buscar información del anime.\n${e.message}`)
    }
}

handler.help = ['ainfo <anime>']
handler.tags = ['anime']
handler.command = ['ainfo', 'animeinfo', 'anime', 'mal']

export default handler
