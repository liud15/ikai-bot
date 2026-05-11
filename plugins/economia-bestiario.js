import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ANIMALES_PATH = path.join(__dirname, '..', 'src', 'database', 'rpg_animales.json')

let handler = async (m, { conn, args }) => {
    let animales = []
    try {
        const data = fs.readFileSync(ANIMALES_PATH, 'utf-8')
        animales = JSON.parse(data)
    } catch (e) {
        console.error('[bestiario] Error leyendo rpg_animales.json:', e)
        return m.reply('❌ La biblioteca del bestiario está sellada mágicamente o en mantenimiento.')
    }

    if (!args[0]) {
        // Mostrar la lista completa
        let txt = `📖 *BESTIARIO IKAI BOT* 📖\n\nDescubre a los monstruos que habitan este mundo. Usa *#bestiario [numero]* para ver los detalles de una criatura.\n\n`

        let currentTier = ''
        animales.forEach((a) => {
            if (a.tier !== currentTier) {
                currentTier = a.tier
                txt += `\n🌟 *TIER: ${currentTier.toUpperCase()}*\n`
            }
            txt += `➤ ${a.id}. ${a.nombre}\n`
        })

        txt += `\n> 💡 *Ejemplo:* #bestiario 4`
        return m.reply(txt)
    }

    // Mostrar una criatura específica
    let index = parseInt(args[0])
    if (isNaN(index) || index < 1 || index > animales.length) {
        return m.reply(`⚠️ Has ingresado un número de criatura inválido. Ingresa un número del *1 al ${animales.length}*.`)
    }

    let a = animales[index - 1] // El arreglo empieza en 0
    let peligroPje = (a.peligro * 100).toFixed(0) + '%'
    let recompensaPromedio = Math.floor((a.recompensaMin + a.recompensaMax) / 2)

    let caption = `
╭─⬣「 📖 BESTIARIO IKAI 」⬣
│
│ 🐉 *Criatura:* ${a.nombre}
│ 🏷️ *Rareza:* ${a.tier}
│ ⚠️ *Peligro de Muerte:* ${peligroPje}
│ 💰 *Valor Promedio:* ${recompensaPromedio} 🪙
│ 
╰─⬣ *Mátalo o huye.* ⬣
    `.trim()

    // Enviar como Thumbnail elegante
    try {
        await conn.sendMessage(m.chat, {
            text: caption,
            contextInfo: {
                externalAdReply: {
                    title: `📖 Bestiario Mágico`,
                    body: `ID: #${a.id} | ${a.nombre.split(' ')[1] || a.nombre}`,
                    thumbnailUrl: a.foto,
                    sourceUrl: "",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: m })
    } catch (e) {
        // Fallback si algo sale mal enviando el media
        m.reply(caption + `\n\n[Enlace a ilustración: ${a.foto}]`)
    }
}

handler.help = ['bestiario', 'bestiary']
handler.tags = ['economy']
handler.command = ['bestiario', 'bestiary', 'monstruos']
handler.group = true

export default handler
