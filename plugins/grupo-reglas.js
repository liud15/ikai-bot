// Sistema de Reglas del grupo
let handler = async (m, { conn, text, command, usedPrefix, isAdmin }) => {
    const chat = global.db.data.chats[m.chat]
    if (!chat.rules) chat.rules = ''

    // === VER REGLAS ===
    if (/^(reglas|rules)$/i.test(command)) {
        if (!chat.rules) {
            return m.reply(`📋 Este grupo no tiene reglas configuradas.\n\n${isAdmin ? `Un admin puede configurarlas con:\n*${usedPrefix}setreglas <texto>*` : 'Pide a un admin que las configure.'}`)
        }

        return conn.sendMessage(m.chat, {
            text: `📋 *REGLAS DEL GRUPO*\n━━━━━━━━━━━━━━━━━━\n\n${chat.rules}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ El incumplimiento puede resultar en advertencias (*${usedPrefix}warn*)`,
        }, { quoted: m })
    }

    // === ESTABLECER REGLAS ===
    if (/^(setreglas|setrules)$/i.test(command)) {
        if (!isAdmin) return m.reply('❌ Solo los *admins* pueden configurar las reglas.')
        if (!text) return m.reply(`✳️ Escribe las reglas después del comando.\n\nEjemplo:\n*${usedPrefix}setreglas*\n1. No spam\n2. Respetar a todos\n3. No contenido NSFW`)

        chat.rules = text.trim()

        return m.reply(`✅ *Reglas actualizadas*\n\nLos miembros pueden verlas con:\n*${usedPrefix}reglas*`)
    }

    // === AGREGAR REGLA ===
    if (/^(addregla|addrule)$/i.test(command)) {
        if (!isAdmin) return m.reply('❌ Solo los *admins* pueden modificar las reglas.')
        if (!text) return m.reply(`✳️ Uso: *${usedPrefix}addregla <nueva regla>*`)

        const currentRules = chat.rules || ''
        // Detectar el número de la última regla
        const lines = currentRules.split('\n').filter(l => l.trim())
        const lastNum = lines.reduce((max, line) => {
            const match = line.match(/^(\d+)[\.\)\-]/)
            return match ? Math.max(max, parseInt(match[1])) : max
        }, 0)

        const newRule = lastNum > 0 ? `${lastNum + 1}. ${text.trim()}` : text.trim()
        chat.rules = currentRules ? `${currentRules}\n${newRule}` : newRule

        return m.reply(`✅ Regla añadida:\n${newRule}`)
    }

    // === ELIMINAR REGLA ===
    if (/^(delregla|delrule)$/i.test(command)) {
        if (!isAdmin) return m.reply('❌ Solo los *admins* pueden modificar las reglas.')
        if (!chat.rules) return m.reply('❌ No hay reglas configuradas.')

        const num = parseInt(text)
        if (!Number.isFinite(num) || num < 1) {
            return m.reply(`✳️ Uso: *${usedPrefix}delregla <número>*\nEjemplo: *${usedPrefix}delregla 3*`)
        }

        const lines = chat.rules.split('\n').filter(l => l.trim())
        const targetLine = lines.findIndex(line => {
            const match = line.match(/^(\d+)[\.\)\-]/)
            return match && parseInt(match[1]) === num
        })

        if (targetLine === -1) return m.reply(`❌ No se encontró la regla número *${num}*.`)

        const removed = lines.splice(targetLine, 1)[0]

        // Renumerar
        let counter = 1
        const renumbered = lines.map(line => {
            const match = line.match(/^\d+[\.\)\-]\s*(.+)/)
            if (match) return `${counter++}. ${match[1]}`
            return line
        })

        chat.rules = renumbered.join('\n')

        return m.reply(`✅ Regla eliminada: _${removed}_\n\n${chat.rules ? `📋 Reglas actuales:\n${chat.rules}` : '📋 No quedan reglas.'}`)
    }

    // === LIMPIAR REGLAS ===
    if (/^(clearreglas|clearrules)$/i.test(command)) {
        if (!isAdmin) return m.reply('❌ Solo los *admins* pueden limpiar las reglas.')
        if (!chat.rules) return m.reply('❌ No hay reglas que limpiar.')

        chat.rules = ''
        return m.reply('✅ Todas las reglas han sido eliminadas.')
    }
}

handler.help = ['reglas', 'setreglas <texto>', 'addregla <regla>', 'delregla <número>', 'clearreglas']
handler.tags = ['grupo']
handler.command = ['reglas', 'rules', 'setreglas', 'setrules', 'addregla', 'addrule', 'delregla', 'delrule', 'clearreglas', 'clearrules']
handler.group = true

export default handler
