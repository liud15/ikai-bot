/**
 * ╔══════════════════════════════════════════════╗
 * ║       🚫 PLUGIN BLACKLIST - IKAI BOT         ║
 * ║  Ignora completamente a usuarios en lista    ║
 * ╚══════════════════════════════════════════════╝
 *
 * 📄 CONFIGURACIÓN MANUAL → blacklist.json (raíz del bot)
 *
 * Agrega LIDs o JIDs al archivo blacklist.json así:
 *  {
 *    "usuarios": [
 *      "123456789012345@lid",
 *      "5712345678@s.whatsapp.net"
 *    ]
 *  }
 *
 * ✅ El bot NO responderá NADA a esos usuarios.
 * ✅ El owner puede gestionar la lista también con comandos:
 *    .blagregarid <lid>     → agrega un ID a la lista
 *    .blaeliminarid <lid>   → elimina un ID de la lista
 *    .blaver                → muestra la lista actual
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Ruta al archivo de configuración ───────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BLACKLIST_PATH = path.join(__dirname, '../blacklist.json')

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Lee la blacklist del disco (sin caché, siempre fresca) */
function readBlacklist() {
    try {
        const raw = fs.readFileSync(BLACKLIST_PATH, 'utf-8')
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed.usuarios) ? parsed.usuarios : []
    } catch {
        return []
    }
}

/** Guarda la blacklist en disco */
function saveBlacklist(lista) {
    const data = {
        _comentario: 'Agrega aquí los LIDs o JIDs de usuarios que el bot debe IGNORAR completamente.',
        _formato: "Ejemplos: '123456789012345@lid'  o  '5712345678@s.whatsapp.net'",
        usuarios: lista,
    }
    fs.writeFileSync(BLACKLIST_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

/** Normaliza un JID quitando el sufijo de dispositivo (":X") */
function normalizeJid(jid = '') {
    return String(jid).replace(/:\d+(?=@)/, '').trim().toLowerCase()
}

/** Comprueba si un sender está en la blacklist */
function isBlacklisted(sender) {
    const lista = readBlacklist()
    const norm = normalizeJid(sender)
    return lista.some(id => normalizeJid(id) === norm)
}

// ─── Handler principal ───────────────────────────────────────────────────────

let handler = async (m, { conn, isROwner, text, command }) => {
    // Comandos de gestión (solo owner)
    const cmd = command?.toLowerCase()

    if (cmd === 'blagregarid') {
        // .blagregarid <jid>
        const target = (text || '').trim()
        if (!target) return m.reply('⚠️ Debes especificar el LID o JID.\n\nEjemplo: .blagregarid 123456@lid')

        const lista = readBlacklist()
        const normTarget = normalizeJid(target)

        if (lista.some(id => normalizeJid(id) === normTarget)) {
            return m.reply(`⚠️ *${target}* ya está en la blacklist.`)
        }

        lista.push(normTarget)
        saveBlacklist(lista)
        return m.reply(`✅ *${normTarget}* agregado a la blacklist.\nEl bot ignorará completamente a este usuario.`)
    }

    if (cmd === 'blaeliminarid') {
        // .blaeliminarid <jid>
        const target = (text || '').trim()
        if (!target) return m.reply('⚠️ Debes especificar el LID o JID.\n\nEjemplo: .blaeliminarid 123456@lid')

        const lista = readBlacklist()
        const normTarget = normalizeJid(target)
        const nuevaLista = lista.filter(id => normalizeJid(id) !== normTarget)

        if (nuevaLista.length === lista.length) {
            return m.reply(`⚠️ *${target}* NO está en la blacklist.`)
        }

        saveBlacklist(nuevaLista)
        return m.reply(`✅ *${normTarget}* eliminado de la blacklist.`)
    }

    if (cmd === 'blaver') {
        // .blaver → muestra la lista
        const lista = readBlacklist()
        if (!lista.length) return m.reply('📋 La blacklist está vacía.\n\nUsa *.blagregarid <lid>* para agregar usuarios.')

        const texto = lista.map((id, i) => `  *${i + 1}.* \`${id}\``).join('\n')
        return m.reply(`🚫 *BLACKLIST — Usuarios Ignorados*\n\n${texto}\n\n_Total: ${lista.length} usuario(s)_`)
    }
}

// ─── Metadatos del handler (comandos owner) ──────────────────────────────────
handler.command = /^bla(gregarid|eliminarid|ver)$/i
handler.rowner = true
handler.help = ['blagregarid <lid>', 'blaeliminarid <lid>', 'blaver']
handler.tags = ['owner']

// ─── Hook BEFORE: se ejecuta en CADA mensaje antes que cualquier plugin ──────
handler.before = async function (m) {
    // El owner nunca es bloqueado
    if (m.fromMe) return false

    const lista = readBlacklist()
    if (!lista.length) return false

    const norm = normalizeJid(m.sender)
    const bloqueado = lista.some(id => normalizeJid(id) === norm)

    if (bloqueado) {
        // Silencio total: devolvemos true para cortar el procesamiento
        return true
    }

    return false
}

export default handler
