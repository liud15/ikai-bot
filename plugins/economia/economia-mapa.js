import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const LUGARES_PATH = path.join(__dirname, '..', '..', 'src', 'database', 'rpg_lugares.json')

let handler = async (m, { conn, args }) => {
    let lugares = []
    try {
        const data = fs.readFileSync(LUGARES_PATH, 'utf-8')
        lugares = JSON.parse(data)
    } catch (e) {
        console.error('[mapa] Error leyendo rpg_lugares.json:', e)
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` 🗺️ *ERROR DE MAPA* 🗺️\n\n` +
            ` ⌲ El cartógrafo real ha perdido\n` +
            `    los pergaminos.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
    }

    if (!args[0]) {
        // Mostrar la lista completa
        let txt = `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
                  ` 🗺️ *ATLAS DE IKAI* 🗺️\n\n` +
                  ` ⌲ Explora las regiones del mundo mágico.\n\n`

        let currentBioma = ''
        lugares.forEach((l) => {
            if (l.bioma !== currentBioma) {
                currentBioma = l.bioma
                txt += ` ◈ *${currentBioma.toUpperCase()}*\n`
            }
            txt += ` ⌲ ${l.id}. ${l.nombre.split(' ')[1] || l.nombre}\n` // Remover emoji inicial para listar más limpio
        })

        txt += `\n> ✧ Postal de zona: #mapa [número] ✧\n*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        return m.reply(txt)
    }

    // Mostrar un lugar específico
    let index = parseInt(args[0])
    if (isNaN(index) || index < 1 || index > lugares.length) {
        return m.reply(
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*\n` +
            ` ❌ *COORDENADAS INVÁLIDAS* ❌\n\n` +
            ` ⌲ Ingresa un número del *1 al ${lugares.length}*.\n` +
            `*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*`
        )
    }

    let l = lugares[index - 1] // El arreglo empieza en 0

    let caption = `
*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*
 🗺️ *ATLAS DE IKAI* 🗺️

 ⌲ *Destino:* ${l.nombre}
 ⌲ *Bioma:* ${l.bioma}
 ⌲ *Nota:* ...${l.descripcion}.

> ✧ Para viajar usa #aventura ✧
*₊˚ ✧ ‿︵‿୨ ୧‿︵‿ ✧ ˚₊*
`.trim()

    // Enviar como imagen directa (en lugar de miniatura de link preview)
    try {
        let imgBuffer = null
        if (l.foto) {
            try {
                const res = await fetch(l.foto)
                if (res.ok) imgBuffer = Buffer.from(await res.arrayBuffer())
            } catch { /* foto no disponible */ }
        }
        if (imgBuffer) {
            await conn.sendMessage(m.chat, { image: imgBuffer, caption }, { quoted: m })
        } else {
            await conn.sendMessage(m.chat, { text: caption }, { quoted: m })
        }
    } catch (e) {
        m.reply(caption)
    }
}

handler.help = ['mapa', 'atlas']
handler.tags = ['economy']
handler.command = ['mapa', 'atlas', 'regiones']
handler.group = true

export default handler
