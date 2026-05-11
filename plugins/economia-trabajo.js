import fs from 'fs'
import { getRankLabel } from '../lib/levelRanks.js'

const WORK_COOLDOWN = 60 * 60 * 1000

// Convertimos la lista agrupada en la lista plana que necesita el bot
const WORKS = []

try {
  let fileContent = fs.readFileSync('./src/database/rpg_trabajos.json', 'utf8')
  let RAW_WORKS = JSON.parse(fileContent)

  for (let cat of RAW_WORKS) {
    for (let roleObj of cat.roles) {
      WORKS.push({
        career: cat.career,
        role: roleObj.name,
        image: roleObj.image,
        min: 100 + Math.floor(Math.random() * 100), // Random min entre 100-199
        max: 250 + Math.floor(Math.random() * 150)  // Random max entre 250-399
      })
    }
  }
} catch (e) {
  console.log("Error al cargar rpg_trabajos.json:", e)
}

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

function msToText(ms) {
  if (ms <= 0) return 'ahora'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

let handler = async (m, { conn }) => {
  const user = global.db.data.users[m.sender]
  const now = Date.now()

  if (!Number.isFinite(user.coin)) user.coin = 0
  if (!Number.isFinite(user.exp)) user.exp = 0
  if (!Number.isFinite(user.lastwork)) user.lastwork = 0

  const elapsed = now - user.lastwork
  const remaining = WORK_COOLDOWN - elapsed

  if (remaining > 0) {
    return m.reply(`⏳ Ya trabajaste hace poco.\nIntenta otra vez en *${msToText(remaining)}*.`)
  }

  const job = WORKS[rand(0, WORKS.length - 1)]
  const reward = rand(job.min, job.max)
  const xpGained = rand(25, 60)
  const rango = getRankLabel(Number.isFinite(user.level) ? user.level : 1)

  user.coin += reward
  user.exp += xpGained
  user.lastwork = now

  // Enviamos directamente el resultado con thumbnail, sin mensaje de carga
  await conn.sendMessage(m.chat, {
    text: `🛠️ Trabajas como *"${job.role}"*\n\n> 🪙 Ganas: *+${reward} coins*\n> ✨ XP: *+${xpGained} XP*\n> 💰 Wallet: *${user.coin} coins*\n> 🎖️ Rango: *${rango}*`,
    contextInfo: {
      externalAdReply: {
        title: `🏢 Carrera: ${job.career}`,
        body: `Certificado de trabajo de ${m.pushName || 'Usuario'}`,
        thumbnailUrl: job.image,
        sourceUrl: 'https://whatsapp.com/channel/0029Vafoq2TFsn0kTerYCJ17',
        mediaType: 1,
        renderLargerThumbnail: true
      }
    }
  }, { quoted: m })
}

handler.help = ['work', 'trabajo', 'w']
handler.tags = ['economy']
handler.command = ['work', 'trabajo', 'w']
handler.group = true

export default handler