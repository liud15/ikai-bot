import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const LUGARES_PATH = path.join(__dirname, '..', 'src', 'database', 'rpg_lugares.json')

let handler = async (m, { conn, args }) => {
    let lugares = []
    try {
        const data = fs.readFileSync(LUGARES_PATH, 'utf-8')
        lugares = JSON.parse(data)
    } catch (e) {
        console.error('[mapa] Error leyendo rpg_lugares.json:', e)
        return m.reply('❌ El cartógrafo real ha perdido los mapas. Intenta más tarde.')
    }

    if (!args[0]) {
        // Mostrar la lista completa
        let txt = `🗺️ *ATLAS DE IKAI* 🗺️\n\nExplora las regiones descubiertas del mundo mágico antes de ir de aventura. Usa *#mapa [numero]* para ver una postal de la zona.\n\n`

        let currentBioma = ''
        lugares.forEach((l) => {
            if (l.bioma !== currentBioma) {
                currentBioma = l.bioma
                txt += `\n🌍 *${currentBioma.toUpperCase()}*\n`
            }
            txt += `➤ ${l.id}. ${l.nombre.split(' ')[1] || l.nombre}\n` // Remover emoji inicial para listar más limpio
        })

        txt += `\n> 💡 *Ejemplo:* #mapa 12`
        return m.reply(txt)
    }

    // Mostrar un lugar específico
    let index = parseInt(args[0])
    if (isNaN(index) || index < 1 || index > lugares.length) {
        return m.reply(`⚠️ Has ingresado un número de región inválido. Ingresa un número del *1 al ${lugares.length}*.`)
    }

    let l = lugares[index - 1] // El arreglo empieza en 0

    let caption = `
╭─⬣「 🗺️ ATLAS DE IKAI 」⬣
│
│ 📍 *Región:* ${l.nombre}
│ 🌍 *Bioma:* ${l.bioma}
│ 📝 *Nota:* ...${l.descripcion}.
│ 
╰─⬣ *Para viajar usa #aventura* ⬣
    `.trim()

    // Enviar como Thumbnail elegante
    try {
        await conn.sendMessage(m.chat, {
            text: caption,
            contextInfo: {
                externalAdReply: {
                    title: `🗺️ Atlas Explorador`,
                    body: `ID: #${l.id} | ${l.bioma}`,
                    thumbnailUrl: l.foto,
                    sourceUrl: "",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m })
    } catch (e) {
        // Fallback si algo sale mal enviando el media
        m.reply(caption + `\n\n[Enlace a ilustración: ${l.foto}]`)
    }
}

handler.help = ['mapa', 'atlas']
handler.tags = ['economy']
handler.command = ['mapa', 'atlas', 'regiones']
handler.group = true

export default handler
