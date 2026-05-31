import fetch from 'node-fetch'

const API_URL = 'https://api.evogb.org/ai/chatgpt'
const API_KEY = 'liu-ofc'
const TIMEOUT_MS = 30_000

let handler = async (m, { conn, text, usedPrefix, command }) => {
    const tema = text?.trim()

    await conn.sendMessage(m.chat, { react: { text: '📖', key: m.key } })

    try {
        const prompt = crearPrompt(tema)
        const respuesta = await consultarApi(prompt)
        const epigrafe = extraerEpigrafe(respuesta)

        if (!epigrafe.cita || !autorValido(epigrafe.autor) || !epigrafe.explicacion) {
            throw new Error('La API no devolvio un epigrafe completo')
        }

        const mensaje =
            `╭─「 🧠 *FRASE DE INSPIRACIÓN* 」\n` +
            `│\n` +
            `│ ❝${limpiarCita(epigrafe.cita)}❞\n` +
            `│\n` +
            `├─ ✦ *Inspiración*\n` +
            `│ ${limpiarTexto(epigrafe.autor)}\n` +
            `│\n` +
            `├─ ✧ *Interpretación*\n` +
            `│ ${formatearExplicacion(epigrafe.explicacion)}\n` +
            `╰───────────────`

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return m.reply(mensaje)
    } catch (e) {
        console.error('[fun-epigrafe] Error:', e.message)
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        return m.reply(
            `⚠️ No pude crear una frase ahora.\n\n` +
            `Prueba de nuevo con:\n` +
            `${usedPrefix + command}\n` +
            `${usedPrefix + command} poder\n` +
            `${usedPrefix + command} soledad`
        )
    }
}

function crearPrompt(tema) {
    return [
        'Genera una frase de inicio con tono de thriller psicologico escolar, estrategia social y filosofia.',
        'Debe sentirse como una cita filosofica de anime psicologico, sin copiar frases ni escenas de Classroom of the Elite.',
        'Devuelve SOLO JSON valido, sin markdown, sin texto extra.',
        'Usa exactamente estas claves: "cita", "autor", "explicacion".',
        'Reglas:',
        '- cita: frase filosofica original, elegante e intensa, maximo 28 palabras.',
        '- autor: nombre concreto de un pensador real, escritor clasico o escuela filosofica que encaje con la idea. Ejemplos validos: "Friedrich Nietzsche (inspiracion)", "Nicolas Maquiavelo (inspiracion)", "Estoicismo (inspiracion)".',
        '- nunca escribas solo "(inspiracion)" en autor.',
        '- explicacion: 3 o 4 oraciones en espanol, claras y detalladas, explicando la idea central de la cita y relacionandola con poder, ego, inteligencia, libertad, mentira, soledad o relaciones humanas.',
        tema
            ? `Tema elegido por el usuario: ${tema}.`
            : 'Tema: elige uno al azar entre poder, ego, merito, libertad, soledad, competencia, mentira o confianza.'
    ].join('\n')
}

async function consultarApi(prompt) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
        const url = `${API_URL}?text=${encodeURIComponent(prompt)}&key=${encodeURIComponent(API_KEY)}`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'IkaiBot/2.0' },
            signal: controller.signal
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()
        if (!data?.status || !data?.result) {
            throw new Error('Respuesta invalida de la API')
        }

        return String(data.result)
    } finally {
        clearTimeout(timeout)
    }
}

function extraerEpigrafe(raw) {
    const texto = String(raw || '')
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim()

    const matchJson = texto.match(/\{[\s\S]*\}/)
    if (matchJson) {
        try {
            const data = JSON.parse(matchJson[0])
            return {
                cita: data.cita || data.quote || '',
                autor: data.autor || data.author || '',
                explicacion: data.explicacion || data.explicación || data.explanation || ''
            }
        } catch {
            // Si la IA rompe el JSON, se intenta leer como texto plano.
        }
    }

    return {
        cita: buscarLinea(texto, /cita\s*:\s*(.+)/i),
        autor: buscarLinea(texto, /autor\s*:\s*(.+)/i),
        explicacion: buscarLinea(texto, /explicaci[oó]n\s*:\s*(.+)/i)
    }
}

function buscarLinea(texto, regex) {
    const match = texto.match(regex)
    return match ? match[1].trim() : ''
}

function limpiarCita(texto) {
    return limpiarTexto(texto).replace(/^["'“”]+|["'“”]+$/g, '')
}

function autorValido(texto) {
    const autor = limpiarTexto(texto)
    if (!autor) return false
    if (/^\(?inspiraci[oó]n\)?$/i.test(autor)) return false
    return /[a-záéíóúñ]{3,}/i.test(autor)
}

function formatearExplicacion(texto) {
    return limpiarTexto(texto)
        .replace(/\.\s+/g, '.\n│ ')
        .replace(/\n│\s*$/g, '')
}

function limpiarTexto(texto) {
    return String(texto || '')
        .replace(/\s+/g, ' ')
        .replace(/^\s*[-*]\s*/, '')
        .trim()
}

handler.help = ['citaelite [tema]', 'fraseelite [tema]', 'inspiracion [tema]']
handler.tags = ['fun']
handler.command = ['epigrafe', 'epigrafes', 'citaelite', 'fraseelite', 'inspiracion', 'cote']

export default handler
