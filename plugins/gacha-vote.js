import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveCharacter } from '../src/lib/gacha-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

const VOTE_COOLDOWN = 6 * 60 * 60 * 1000 // 6 horas entre votos
const VOTES_PER_UPGRADE = 10 // Cada 10 votos sube el valor
const VALUE_INCREMENT = 100 // Cuánto sube el valor por cada upgrade

let handler = async (m, { conn, args, text }) => {
    if (!args[0]) {
        return m.reply(`🗳️ *Uso:* #vote <ID o nombre del personaje>

*Ejemplo:* #vote 15
*Ejemplo:* #vote Makima
*Ejemplo:* #vote Zero Two

Vota por tu personaje favorito:
• Cada voto se registra en el personaje
• Cada *${VOTES_PER_UPGRADE} votos* acumulados, su valor sube *+${VALUE_INCREMENT}* 💰
• Solo puedes votar una vez cada *6 horas*
• ¡Tu voto ayuda a que el personaje sea más valioso!`)
    }

    const user = global.db.data.users[m.sender]
    const now = Date.now()

    // Cooldown de votación
    if (!user.lastGachaVote) user.lastGachaVote = 0
    const diff = now - user.lastGachaVote
    if (diff < VOTE_COOLDOWN) {
        const remaining = VOTE_COOLDOWN - diff
        const hours = Math.floor(remaining / 3600000)
        const mins = Math.floor((remaining % 3600000) / 60000)
        const secs = Math.floor((remaining % 60000) / 1000)
        return m.reply(`⏳ Debes esperar *${hours}h ${mins}m ${secs}s* para votar nuevamente.`)
    }

    const charInput = text.trim()

    // Leer personajes
    let characters
    try {
        const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
        const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
        characters = JSON.parse(clean)
    } catch (e) {
        return m.reply('❌ Error al leer la base de datos de personajes.')
    }

    // Resolver personaje por ID o nombre
    const result = resolveCharacter(characters, charInput)

    if (!result.char) {
        return m.reply(`❌ No se encontró ningún personaje con "*${charInput}*".

💡 Intenta con un nombre, apodo o ID.`)
    }

    const char = result.char
    const charIdx = characters.findIndex(c => String(c.id) === String(char.id))

    if (charIdx === -1) {
        return m.reply('❌ Error interno: personaje no encontrado en la base de datos.')
    }

    // Incrementar votos
    const prevVotes = parseInt(characters[charIdx].votes) || 0
    const newVotes = prevVotes + 1
    characters[charIdx].votes = newVotes

    // Verificar si se alcanzó un umbral de upgrade
    let valueUpgrade = false
    let prevValue = parseInt(characters[charIdx].value) || 0
    let newValue = prevValue

    // Calcular si cruzamos un múltiplo de VOTES_PER_UPGRADE
    if (Math.floor(newVotes / VOTES_PER_UPGRADE) > Math.floor(prevVotes / VOTES_PER_UPGRADE)) {
        newValue = prevValue + VALUE_INCREMENT
        characters[charIdx].value = String(newValue)
        valueUpgrade = true
    }

    // Guardar en characters.json
    try {
        fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters, null, 2), 'utf-8')
    } catch (e) {
        console.error('[gacha-vote] Error al guardar:', e.message)
        return m.reply('❌ Error al guardar el voto. Inténtalo de nuevo.')
    }

    // Actualizar cooldown del usuario
    user.lastGachaVote = now

    // Determinar rareza actual
    const displayValue = valueUpgrade ? newValue : prevValue
    let rarity
    if (displayValue >= 7000) rarity = '🌟 LEGENDARIO'
    else if (displayValue >= 4000) rarity = '💎 ÉPICO'
    else if (displayValue >= 2000) rarity = '💜 RARO'
    else if (displayValue >= 1000) rarity = '💙 POCO COMÚN'
    else rarity = '💚 COMÚN'

    const votesUntilNext = VOTES_PER_UPGRADE - (newVotes % VOTES_PER_UPGRADE)
    const fuzzyNote = (result.method === 'fuzzy_name' || result.method === 'fuzzy_alias')
        ? `\n│ 🔮 Encontrado por similitud: ${Math.round(result.similarity * 100)}%`
        : ''

    let upgradeMsg = ''
    if (valueUpgrade) {
        upgradeMsg = `│
│ 🎉 *¡UPGRADE DE VALOR!*
│ 💰 ${prevValue} → *${newValue}* (+${VALUE_INCREMENT})
│`
    }

    const userName = conn.getName(m.sender) || m.pushName || 'Usuario'

    const response = `
╭─⬣「 🗳️ VOTO REGISTRADO 」⬣
│
│ 🎴 *${char.name}*
│ 📺 ${char.source}
│ 🏷️ ${rarity}
│ 🆔 ID: ${char.id}
│
│ 👤 Votado por: *${userName}*
│ 📊 *Votos totales:* ${newVotes}
│ 💰 *Valor actual:* ${valueUpgrade ? newValue : prevValue}
│ 📈 *Próximo upgrade:* en ${votesUntilNext} voto${votesUntilNext !== 1 ? 's' : ''} más
│${upgradeMsg}${fuzzyNote}
╰─⬣ ¡Gracias por votar! ⬣
  `.trim()

    // Intentar enviar con imagen
    if (char.img && char.img.length > 0) {
        const randomImg = char.img[Math.floor(Math.random() * char.img.length)]
        try {
            await conn.sendMessage(m.chat, {
                image: { url: randomImg },
                caption: response
            }, { quoted: m })
            return
        } catch (e) { }
    }

    await conn.reply(m.chat, response, m)
}

handler.help = ['vote <id o nombre>', 'votar <id o nombre>']
handler.tags = ['gacha']
handler.command = ['vote', 'votar', 'votarchar', 'votechar']
handler.group = false

export default handler
