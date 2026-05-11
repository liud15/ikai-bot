import axios from 'axios'

const GPT4_SESSION_ENDPOINT = 'https://api.evogb.org/ai/gpt4-session'
const API_KEY = 'liu-ofc'

let handler = async (m, { conn, usedPrefix, command, text }) => {
    const username = `${conn.getName(m.sender)}`

    // Usar el ID del grupo como session ID único (memoria compartida en el grupo)
    const sessionId = m.chat.split('@')[0]

    if (!text) {
        return conn.reply(m.chat, `${emoji} Ingrese una petición para que la IA lo responda.\n\n*Modo disponible:*\n• *${usedPrefix}ia* — Chat con GPT-4 (con memoria)`, m)
    }

    await m.react(rwait)

    try {
        const { key } = await conn.sendMessage(m.chat, {
            text: `${emoji2} Procesando, espera unos segundos...`
        }, { quoted: m })

        // Obtener el nombre del grupo
        const groupMeta = await conn.groupMetadata(m.chat).catch(() => null)
        const groupName = groupMeta?.subject || 'un grupo'

        // Construir la pregunta con contexto del bot
        const query = `Te llamas ${botname}, fuiste creada por Liu-Ofc. Hablas en español. El usuario se llama ${username}. Estás en el grupo de WhatsApp llamado "${groupName}". Sé amigable y divertida, asi como algo cariñosa y timida, en caso sea necesario usa uno que otro emoji, te gusta que te llamen Ikai.\n\nPregunta del usuario: ${text}`

        const { data } = await axios.get(GPT4_SESSION_ENDPOINT, {
            params: {
                text: query,
                session: sessionId,
                key: API_KEY
            },
            timeout: 30000
        })

        if (!data || !data.result) {
            throw new Error('Sin respuesta de la API')
        }

        await conn.sendMessage(m.chat, { text: data.result, edit: key })
        await m.react(done)
    } catch (e) {
        console.error('[ai-ia] Error:', e.message)
        await m.react(error)
        await conn.reply(m.chat, `✘ No se pudo obtener respuesta de la IA.\n${e.message || ''}`, m)
    }
}

handler.help = ['ia']
handler.tags = ['ai']
handler.command = ['ia', 'chatgpt', 'gpt4', 'ikai']
handler.group = true

export default handler
