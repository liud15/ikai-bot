// ╔══════════════════════════════════════════╗
// ║          grupo-delete.js                 ║
// ║  Elimina el mensaje citado del grupo     ║
// ╚══════════════════════════════════════════╝

let handler = async (m, { conn, usedPrefix, command }) => {
    // Verificar que se esté citando un mensaje
    if (!m.quoted) {
        return m.reply(`❌ Debes *responder* al mensaje que deseas eliminar.\nUso: *${usedPrefix + command}*`)
    }

    try {
        // Construir la key del mensaje citado usando fakeObj (vM) de simple.js
        const fakeObj = m.quoted.fakeObj
        const key = {
            remoteJid: fakeObj?.key?.remoteJid || m.chat,
            fromMe:    fakeObj?.key?.fromMe    ?? m.quoted.fromMe,
            id:        fakeObj?.key?.id        || m.quoted.id,
            participant: fakeObj?.key?.participant || m.quoted.sender || undefined,
        }

        // Si el participant está vacío, eliminarlo para no enviar campo vacío
        if (!key.participant) delete key.participant

        await conn.sendMessage(m.chat, { delete: key })

        // Confirmar silenciosamente con una reacción ✅
        await m.react('🗑️')

    } catch (e) {
        console.error('[grupo-delete] Error al eliminar mensaje:', e)
        m.reply('❌ No se pudo eliminar el mensaje. Puede que sea demasiado antiguo o no tengo permisos suficientes.')
    }
}

handler.help    = ['del', 'delete', 'borrar']
handler.tags    = ['grupo']
handler.command = ['del', 'delete', 'borrar', 'eliminar']
handler.group   = true
handler.admin   = true
handler.botAdmin = true

export default handler
