//Recuerda registrarte en https://dash.swallox.com
import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'
import fs from 'fs'
import cheerio from 'cheerio'
import fetch from 'node-fetch'
import axios from 'axios'
import moment from 'moment-timezone'

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

//BETA: Si quiere evitar escribir el número que será bot en la consola, agregué desde aquí entonces:
//Sólo aplica para opción 2 (ser bot con código  de texto de 8 digitos)
global.botNumber = '' //Ejemplo: 5732000000

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.owner = [
  ['51944263887', '🜲 LiuOFC 🜲', true],
  ['']
];
global.mods = []
global.suittag = ["51944263887"]
global.prems = [""]

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.vs = '1.0.0'
global.nameqr = 'IkaiBot-MD'
global.namebot = 'IkaiBot'
global.sessions = 'Sessions'
global.jadi = 'JadiBots'
global.mitaJadibts = true

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.packname = '⪛✰ IkaiBot ✰⪜'
global.botname = 'IkaiBot-MD'
global.wm = ''
global.author = 'Made With By Liu'
global.dev = 'Made With By Liu'
global.textbot = 'Ikaibot • Made With By Liu'
global.etiqueta = 'Liu'

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.moneda = 'IkaiCoins'
global.welcom1 = '☟︎︎︎ Edita Con El Comando setwelcome'
global.welcom2 = '☟︎︎︎ Edita Con El Comando setbye'
global.banner = 'https://files.catbox.moe/9k1y4j.jpg'
global.avatar = 'https://tinyurl.com/258ghupn'

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.cn = 'https://whatsapp.com/channel/0029Vafoq2TFsn0kTerYC';

// ⚠️ API KEY DE VERTEX AI (Google Cloud)
// Funciona con: Gemini, Lyria, Imagen, TTS
// Usa créditos de $300 de Google Cloud
global.VERTEX_API_KEY = 'AQ.Ab8RN6L8IlVb_DB1R-iZHVSyHAVdu1JxDI1SEHVhhEkXVOP5mw'
// ID del proyecto de Google Cloud (necesario para Lyria/música)
global.VERTEX_PROJECT_ID = 'drive-api-490903'

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

global.cheerio = cheerio
global.fs = fs
global.fetch = fetch
global.axios = axios
global.moment = moment


//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'settings.js'"))
  import(`${file}?update=${Date.now()}`)
})
