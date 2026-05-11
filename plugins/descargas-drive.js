import { google } from 'googleapis'
import axios from 'axios'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Ruta al archivo de credenciales del service account
const CREDENTIALS_PATH = join(__dirname, '..', 'drive-credentials.json')
const credentials = require(CREDENTIALS_PATH)

// Tipos MIME que se consideran videos
const VIDEO_MIMES = [
    'video/mp4', 'video/x-matroska', 'video/webm',
    'video/quicktime', 'video/x-msvideo', 'video/mpeg'
]

// Autenticación con service account
function getDriveClient() {
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
    })
    return google.drive({ version: 'v3', auth })
}

// Busca carpetas por nombre en Drive
async function buscarCarpetas(drive, nombre) {
    const res = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name contains '${nombre.replace(/'/g, "\\'")}' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 5
    })
    return res.data.files || []
}

// Lista los archivos de una carpeta
async function listarArchivos(drive, folderId) {
    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size)',
        pageSize: 50,
        orderBy: 'name'
    })
    return res.data.files || []
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!args[0]) throw `Ejemplo de uso:\n${usedPrefix}${command} Naruto Season 1`

    const query = args.join(' ')
    await m.react('🔍')

    const drive = getDriveClient()

    // 1. Buscar carpetas que coincidan con el nombre
    const carpetas = await buscarCarpetas(drive, query)

    if (!carpetas.length) {
        await m.react('❌')
        return m.reply(`❌ No encontré ninguna carpeta con el nombre *"${query}"* en mi Google Drive.\n\n_Asegúrate de que la carpeta fue compartida con la cuenta del bot._`)
    }

    // Si hay varias carpetas, mostrar opciones
    if (carpetas.length > 1) {
        let texto = `📂 *Encontré ${carpetas.length} carpetas con ese nombre:*\n\n`
        carpetas.forEach((c, i) => {
            texto += `*${i + 1}.* ${c.name}\n`
        })
        texto += `\n_Usa el comando con el nombre exacto para buscar en una carpeta específica._`
        await m.react('📂')
        return m.reply(texto)
    }

    // 2. Usar la primera carpeta encontrada
    const carpeta = carpetas[0]
    await m.reply(`📂 *Carpeta encontrada:* ${carpeta.name}\n⏳ Obteniendo archivos...`)

    const archivos = await listarArchivos(drive, carpeta.id)

    if (!archivos.length) {
        await m.react('❌')
        return m.reply(`❌ La carpeta *"${carpeta.name}"* está vacía.`)
    }

    // Filtrar solo videos (o todos los archivos si no hay videos)
    const videos = archivos.filter(f => VIDEO_MIMES.includes(f.mimeType))
    const lista = videos.length ? videos : archivos

    await m.reply(`✅ *${carpeta.name}*\n📦 ${lista.length} archivo(s) encontrado(s).\n\n⬇️ Iniciando descarga y envío...`)
    await m.react('📤')

    let enviados = 0
    let errores = 0

    for (const archivo of lista) {
        try {
            const fileSizeMB = archivo.size ? (parseInt(archivo.size) / 1024 / 1024).toFixed(1) : '?'

            // URL de descarga directa via Drive API
            const downloadUrl = `https://www.googleapis.com/drive/v3/files/${archivo.id}?alt=media`
            const authClient = await getDriveClient().context._options.auth.getClient()
            const token = await authClient.getAccessToken()

            const response = await axios.get(downloadUrl, {
                headers: { Authorization: `Bearer ${token.token}` },
                responseType: 'arraybuffer',
                maxContentLength: Infinity,  // sin límite de tamaño
                maxBodyLength: Infinity,
                timeout: 300000              // 5 minutos
            })

            const buffer = Buffer.from(response.data)
            const mime = archivo.mimeType || 'video/mp4'
            const fileSizeNum = archivo.size ? parseInt(archivo.size) / 1024 / 1024 : 0
            const esDocumento = fileSizeNum > 160
            const caption = `🎬 *${archivo.name}*\n📊 ${fileSizeMB} MB${esDocumento ? '\n📄 _Enviado como documento por superar 160 MB_' : ''}`

            await conn.sendFile(m.chat, buffer, archivo.name, caption, m, null, {
                mimetype: mime,
                asDocument: esDocumento
            })

            enviados++
        } catch (e) {
            errores++
            console.error(`[Drive] Error enviando ${archivo.name}:`, e.message)
        }
    }

    await m.react('✅')
    m.reply(`📊 *Resumen:*\n✅ Enviados: ${enviados}\n❌ Errores: ${errores}`)
}

handler.help = ['drive <nombre de carpeta>']
handler.tags = ['descargas']
handler.command = ['drive', 'gdrive']
handler.limit = true

export default handler
