// ══════════════════════════════════════════════════════
//   _trackactividad.js
//   Registra pasivamente el timestamp del último mensaje
//   de cada miembro en grupos → campo `lastMessage` en DB.
//   Alimenta automáticamente el sistema #inactivos.
// ══════════════════════════════════════════════════════

let handler = m => m

handler.before = async function (m, { conn }) {
    // Solo mensajes reales en grupos, no del bot
    if (!m.isGroup || m.fromMe || m.isBaileys) return
    if (!m.sender || m.sender.endsWith('@g.us')) return

    // Evitar mensajes del sistema (sin texto ni media)
    const tieneContenido = m.text || m.message?.imageMessage || m.message?.videoMessage ||
        m.message?.audioMessage || m.message?.stickerMessage || m.message?.documentMessage
    if (!tieneContenido) return

    // Asegurar que el usuario existe en la DB
    if (!global.db.data.users[m.sender]) {
        global.db.data.users[m.sender] = {}
    }

    const now = Date.now()
    const user = global.db.data.users[m.sender]

    // Solo actualizar si es más reciente (evitar retrocesos)
    if (!user.lastMessage || now > user.lastMessage) {
        user.lastMessage = now
    }
}

export default handler
