// ╔══════════════════════════════════════════╗
// ║        _autosilencio.js                  ║
// ║  Elimina msgs de usuarios silenciados    ║
// ╚══════════════════════════════════════════╝

let handler = m => m

handler.before = async function (m, { conn, isAdmin, isBotAdmin, isOwner, isROwner }) {
    // Solo aplica en grupos
    if (!m.isGroup) return true

    // Si el bot no es admin no puede borrar mensajes de otros
    if (!isBotAdmin) return true

    // No aplicar al propio bot, al owner del bot ni a los admins del grupo
    if (m.fromMe || isOwner || isROwner || isAdmin) return true

    const chat = global.db.data.chats?.[m.chat]
    if (!chat) return true

    // Asegurar que el array existe
    if (!Array.isArray(chat.mutedUsers) || chat.mutedUsers.length === 0) return true

    // Verificar si el remitente está silenciado
    if (!chat.mutedUsers.includes(m.sender)) return true

    try {
        // Construir la key igual que en _antilink.js
        const key = {
            remoteJid:   m.chat,
            fromMe:      false,
            id:          m.key.id,
            participant: m.key.participant || m.sender || undefined,
        }
        if (!key.participant) delete key.participant

        await conn.sendMessage(m.chat, { delete: key })
    } catch (e) {
        console.error('[_autosilencio] Error al eliminar mensaje de usuario silenciado:', e)
    }

    // Retornar false para que el handler principal no procese el mensaje
    return false
}

export default handler
