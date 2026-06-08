let handler = async (m, { conn, text, usedPrefix, command }) => {
    let user = global.db.data.users[m.sender]
    
    if (!text) {
        return m.reply(`> ⚠️ *Uso incorrecto*\n\nEscribe el nombre que deseas usar en el bot.\n\nEjemplo:\n*${usedPrefix + command} Liu*`)
    }

    let newName = text.trim()

    // Limitar longitud del nombre (max 20 caracteres)
    if (newName.length > 20) {
        return m.reply('> ⚠️ *Tu nombre es demasiado largo.*\n\nEl límite máximo es de 20 caracteres.')
    }

    if (newName.length < 3) {
        return m.reply('> ⚠️ *Tu nombre es demasiado corto.*\n\nDebe tener al menos 3 caracteres.')
    }

    // Expresión regular para permitir solo letras, números, espacios y caracteres básicos en español
    // Esto evita fuentes raras, zalgo text, caracteres invisibles, etc.
    let validRegex = /^[a-zA-Z0-9\s\-_.,!¡?¿@ñÑáéíóúÁÉÍÓÚ]+$/
    
    if (!validRegex.test(newName)) {
        return m.reply('> ⚠️ *Caracteres no permitidos*\n\nPor favor, usa solo letras normales, números y signos de puntuación básicos. No se permiten emojis ni fuentes especiales.')
    }

    user.name = newName

    m.reply(`> ✅ *Nombre actualizado*\n\nTu nombre en el bot ahora es:\n*${newName}*`)
}

handler.help = ['name <nombre>']
handler.tags = ['user']
handler.command = ['name', 'nombre', 'setname']
// handler.register = true // Removido para que todos puedan usarlo sin registrarse

export default handler
