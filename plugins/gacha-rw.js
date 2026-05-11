import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARACTERS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')

const COOLDOWN_RW = 20 * 60 * 1000 // 20 minutos
const ROLL_EXPIRY = 60 * 1000 // 1 minuto para reclamar antes de que expire

let handler = async (m, { conn }) => {
  const user = global.db.data.users[m.sender]
  const chat = global.db.data.chats[m.chat]

  // Inicializar gacha del chat si no existe
  if (!chat.gacha) chat.gacha = { claimed: {}, activeRolls: {} }
  if (!chat.gacha.claimed) chat.gacha.claimed = {}

  // Migración: convertir activeRoll (viejo) a activeRolls (nuevo)
  if (chat.gacha.activeRoll && !chat.gacha.activeRolls) {
    chat.gacha.activeRolls = {}
    if (chat.gacha.activeRoll.userId) {
      chat.gacha.activeRolls[chat.gacha.activeRoll.userId] = {
        charId: chat.gacha.activeRoll.charId,
        timestamp: chat.gacha.activeRoll.timestamp
      }
    }
    delete chat.gacha.activeRoll
  }
  if (!chat.gacha.activeRolls) chat.gacha.activeRolls = {}

  // Limpiar tiradas expiradas de otros usuarios (mantenimiento)
  const now = Date.now()
  for (const uid of Object.keys(chat.gacha.activeRolls)) {
    if (now - chat.gacha.activeRolls[uid].timestamp > ROLL_EXPIRY) {
      delete chat.gacha.activeRolls[uid]
    }
  }

  // Cooldown
  if (!user.lastRw) user.lastRw = 0
  const diff = now - user.lastRw
  if (diff < COOLDOWN_RW) {
    const remaining = COOLDOWN_RW - diff
    const mins = Math.floor(remaining / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    return m.reply(`⏳ Debes esperar *${mins}m ${secs}s* para hacer otra tirada.`)
  }

  // Verificar si el usuario ya tiene una tirada activa sin reclamar
  if (chat.gacha.activeRolls[m.sender]) {
    const existingRoll = chat.gacha.activeRolls[m.sender]
    if (now - existingRoll.timestamp <= ROLL_EXPIRY) {
      return m.reply(`⚠️ Ya tienes una tirada activa sin reclamar.\nUsa *#claim* para reclamarla o espera a que expire.`)
    } else {
      delete chat.gacha.activeRolls[m.sender]
    }
  }

  // Leer characters.json
  let characters
  try {
    const raw = fs.readFileSync(CHARACTERS_PATH, 'utf-8')
    // Eliminar BOM si existe
    const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
    characters = JSON.parse(clean)
  } catch (e) {
    console.error('[gacha-rw] Error al leer characters.json:', e.message)
    return m.reply(`❌ Error al leer la base de datos de personajes.\n${e.message}`)
  }

  // Filtrar personajes libres (no reclamados en este grupo) y que tengan imagen
  const claimedIds = Object.keys(chat.gacha.claimed)

  // También excluir personajes que están en tiradas activas de otros usuarios (evitar duplicados)
  const activeCharIds = Object.values(chat.gacha.activeRolls).map(r => r.charId)

  const available = characters.filter(c => {
    const hasImg = c.img && Array.isArray(c.img) && c.img.length > 0
    const notClaimed = !claimedIds.includes(String(c.id))
    const notInActiveRoll = !activeCharIds.includes(String(c.id))
    return hasImg && notClaimed && notInActiveRoll
  })

  if (available.length === 0) {
    return m.reply('😱 ¡No quedan personajes disponibles en este grupo! Todos han sido reclamados.')
  }

  // Seleccionar personaje aleatorio
  const char = available[Math.floor(Math.random() * available.length)]
  const randomImg = char.img[Math.floor(Math.random() * char.img.length)]

  // Determinar rareza visual según valor
  const value = parseInt(char.value) || 0
  let rarity, rarityEmoji
  if (value >= 7000) { rarity = '🌟 LEGENDARIO'; rarityEmoji = '🌟' }
  else if (value >= 4000) { rarity = '💎 ÉPICO'; rarityEmoji = '💎' }
  else if (value >= 2000) { rarity = '💜 RARO'; rarityEmoji = '💜' }
  else if (value >= 1000) { rarity = '💙 POCO COMÚN'; rarityEmoji = '💙' }
  else { rarity = '💚 COMÚN'; rarityEmoji = '💚' }

  // Guardar tirada activa POR USUARIO (no sobreescribe la de otros)
  chat.gacha.activeRolls[m.sender] = {
    charId: String(char.id),
    timestamp: now
  }

  // Actualizar cooldown
  user.lastRw = now

  const caption = `
╭─⬣「 ${rarityEmoji} GACHA ROLL 」⬣
│
│ 🎴 *${char.name}*
│ 📺 *Anime:* ${char.source}
│ ${char.gender === 'Mujer' ? '♀️' : char.gender === 'Hombre' ? '♂️' : '⚧️'} *Género:* ${char.gender}
│ 💰 *Valor:* ${char.value}
│ 🏷️ *Rareza:* ${rarity}
│ 🆔 *ID:* ${char.id}
│
╰─⬣ Usa *#claim* para reclamarlo ⬣
  `.trim()

  try {
    const sendWithThumbnail = async (imgUrl) => {
      await conn.sendMessage(m.chat, {
        image: { url: imgUrl },
        caption: caption,
        mentions: [m.sender]
      }, { quoted: m })
    }

    try {
      await sendWithThumbnail(randomImg)
    } catch (e) {
      // Fallback a otra imagen
      const fallbackImg = char.img.find(img => img !== randomImg) || randomImg
      await sendWithThumbnail(fallbackImg)
    }
  } catch (e2) {
    await conn.reply(m.chat, caption, m)
  }
}

handler.help = ['rw']
handler.tags = ['gacha']
handler.command = ['rw', 'roll', 'tirada', 'gacha']
handler.group = true

export default handler
