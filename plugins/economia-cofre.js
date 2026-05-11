const COFRE_CD = 4 * 60 * 60 * 1000

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

function ensureUser(user) {
  user.coin = Number.isFinite(user.coin) ? user.coin : 0
  user.exp = Number.isFinite(user.exp) ? user.exp : 0
  user.diamond = Number.isFinite(user.diamond) ? user.diamond : 0
  user.lastcofre = Number.isFinite(user.lastcofre) ? user.lastcofre : 0
}

function msToText(ms) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

let handler = async (m, { conn }) => {
  const user = global.db.data.users[m.sender]
  ensureUser(user)

  const elapsed = Date.now() - user.lastcofre
  const remaining = COFRE_CD - elapsed
  if (remaining > 0) return m.reply(`⏳ Tu cofre está en recarga.\nIntenta en *${msToText(remaining)}*.`)

  const loading = await conn.sendMessage(m.chat, { text: '📦 Abriendo cofre misterioso...' }, { quoted: m })

  const roll = Math.random()
  let result = ''
  if (roll < 0.68) {
    const coins = rand(180, 380)
    user.coin += coins
    result = `🪙 Recompensa: *${coins} coins*`
  } else if (roll < 0.93) {
    const exp = rand(220, 450)
    user.exp += exp
    result = `✨ Recompensa: *${exp} exp*`
  } else {
    const diamonds = rand(2, 5)
    user.diamond += diamonds
    result = `💎 Recompensa rara: *${diamonds} diamante(s)*`
  }

  user.lastcofre = Date.now()

  await conn.sendMessage(m.chat, {
    text: `📦 *Cofre abierto*\n${result}\n\n> 💰 Coins: *${user.coin}* \n> 💎 Diamantes: *${user.diamond}*`,
    edit: loading.key
  })
}

handler.help = ['cofre']
handler.tags = ['economy']
handler.command = ['cofre', 'chest']
handler.group = true

export default handler