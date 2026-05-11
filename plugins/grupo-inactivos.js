// ══════════════════════════════════════════════════════
//   SISTEMA DE CONTROL DE USUARIOS INACTIVOS
//   Comandos: inactivos | alertainactivos | kickinactivos | activos | actividad
// ══════════════════════════════════════════════════════

const DIAS_INACTIVO_DEFAULT = 7

/**
 * Resuelve un JID (puede ser @lid) al JID real @s.whatsapp.net.
 * Usa el cache global de LID→phone construido en handler.js.
 */
function resolverJid(jid) {
    if (!jid) return null
    const num = global.getJidNum(jid)               // resuelve LID si aplica
    return `${num}@s.whatsapp.net`
}

/**
 * Devuelve la parte numérica del JID para mostrar en texto (@123456).
 */
function numJid(jid) {
    return global.getJidNum(jid)
}

/**
 * Determina la última vez que un usuario tuvo actividad.
 * Considera tanto los comandos del bot como mensajes en el grupo (_trackactividad).
 */
function getUltimaActividad(userData) {
    if (!userData) return 0
    const campos = [
        'spam',             // último mensaje al bot (handler.js)
        'lastMessage',      // último mensaje en el grupo (_trackactividad.js)
        'lastwork',
        'lastadventure',
        'lastclaim',
        'lastcofre',
        'lastdiamantes',
        'lastpago',
        'lastduel',
        'lastmining',
        'lastRw',
        'lastGachaClaim',
        'lastFamilyClaim',
        'lastcode',
        'lastcodereg',
    ]
    let maxTs = 0
    for (const campo of campos) {
        const val = userData[campo]
        if (typeof val === 'number' && val > 1000000000000 && val > maxTs) {
            // Solo valores que parecen timestamps válidos (> año 2001)
            maxTs = val
        }
    }
    return maxTs
}

/**
 * Convierte milisegundos de diferencia a texto legible.
 */
function tiempoDesde(ts) {
    if (!ts || ts <= 0) return '⚫ Nunca'
    const diff = Date.now() - ts
    if (diff < 0) return '🟢 Ahora'
    const minutos = Math.floor(diff / 60000)
    const horas = Math.floor(diff / 3600000)
    const dias = Math.floor(diff / 86400000)
    const meses = Math.floor(dias / 30)
    if (minutos < 60) return `🟢 Hace ${minutos}m`
    if (horas < 24) return `🟢 Hace ${horas}h`
    if (dias === 1) return `🟡 Ayer`
    if (dias < 7) return `🟡 Hace ${dias} días`
    if (dias < 30) return `🔴 Hace ${dias} días`
    return `🔴 Hace ${meses} mes(es)`
}

// ──────────────────────────────────────────────────────
let handler = async (m, { conn, command, args, usedPrefix, participants, isAdmin, isBotAdmin }) => {

    if (!isAdmin) return m.reply('❌ Solo los *admins* pueden usar este comando.')

    const users = global.db.data.users
    const ahora = Date.now()

    // Obtener IDs reales (resolviendo @lid → @s.whatsapp.net)
    const adminsIds = participants.filter(p => p.admin).map(p => resolverJid(p.id)).filter(Boolean)
    const memberIds = participants.map(p => resolverJid(p.id)).filter(Boolean)
        .filter(jid => jid !== conn.user.jid)  // excluir bot

    // ══════════════════════════════════════════
    //  #inactivos [días]  — Lista usuarios inactivos
    // ══════════════════════════════════════════
    if (/^inactivos$/i.test(command)) {
        const dias = Math.max(1, parseInt(args[0]) || DIAS_INACTIVO_DEFAULT)
        const umbralMs = dias * 86400000

        const inactivos = []
        for (const jid of memberIds) {
            const userData = users[jid]
            const ultimaAct = getUltimaActividad(userData)
            const diff = ultimaAct > 0 ? ahora - ultimaAct : Infinity
            if (diff >= umbralMs) {
                inactivos.push({ jid, ultimaAct, diff })
            }
        }
        inactivos.sort((a, b) => b.diff - a.diff)

        if (inactivos.length === 0) {
            return m.reply(`✅ ¡No hay usuarios inactivos por más de *${dias} días*! 🎉`)
        }

        const maxMostrar = 30
        const visibles = inactivos.slice(0, maxMostrar)

        const lista = visibles.map((u, i) =>
            `${i + 1}. @${numJid(u.jid)} — ${tiempoDesde(u.ultimaAct)}`
        ).join('\n')

        const extraMsg = inactivos.length > maxMostrar
            ? `\n_(y ${inactivos.length - maxMostrar} más...)_`
            : ''

        return conn.sendMessage(m.chat, {
            text: `😴 *USUARIOS INACTIVOS (+${dias} días)*\n━━━━━━━━━━━━━━━━\n${lista}${extraMsg}\n━━━━━━━━━━━━━━━━\n📊 Total: *${inactivos.length}* de *${memberIds.length}* miembros\n\n💡 Usa *${usedPrefix}alertainactivos ${dias}* para avisarles\n🔴 Usa *${usedPrefix}kickinactivos ${dias}* para expulsarlos`,
            mentions: visibles.map(u => resolverJid(u.jid))
        }, { quoted: m })
    }

    // ══════════════════════════════════════════
    //  #activos [días]  — Lista de usuarios activos recientemente
    // ══════════════════════════════════════════
    if (/^activos$/i.test(command)) {
        const dias = Math.max(1, parseInt(args[0]) || 3)
        const umbralMs = dias * 86400000

        const activos = []
        for (const jid of memberIds) {
            const userData = users[jid]
            const ultimaAct = getUltimaActividad(userData)
            const diff = ultimaAct > 0 ? ahora - ultimaAct : Infinity
            if (diff < umbralMs) {
                activos.push({ jid, ultimaAct, diff })
            }
        }
        activos.sort((a, b) => a.diff - b.diff)

        if (activos.length === 0) {
            return m.reply(`😶 Nadie ha tenido actividad en los últimos *${dias} días*.`)
        }

        const maxMostrar = 25
        const visibles = activos.slice(0, maxMostrar)

        const lista = visibles.map((u, i) =>
            `${i + 1}. @${numJid(u.jid)} — ${tiempoDesde(u.ultimaAct)}`
        ).join('\n')

        return conn.sendMessage(m.chat, {
            text: `✅ *USUARIOS ACTIVOS (últimos ${dias} días)*\n━━━━━━━━━━━━━━━━\n${lista}\n━━━━━━━━━━━━━━━━\n🎯 Activos: *${activos.length}* | Total: *${memberIds.length}*`,
            mentions: visibles.map(u => resolverJid(u.jid))
        }, { quoted: m })
    }

    // ══════════════════════════════════════════
    //  #alertainactivos [días]  — Mencionarlos con aviso
    // ══════════════════════════════════════════
    if (/^alertainactivos$/i.test(command)) {
        const dias = Math.max(1, parseInt(args[0]) || DIAS_INACTIVO_DEFAULT)
        const umbralMs = dias * 86400000

        const inactivos = []
        for (const jid of memberIds) {
            const userData = users[jid]
            const ultimaAct = getUltimaActividad(userData)
            const diff = ultimaAct > 0 ? ahora - ultimaAct : Infinity
            if (diff >= umbralMs) inactivos.push(jid)
        }

        if (inactivos.length === 0) {
            return m.reply(`✅ No hay usuarios inactivos por más de *${dias} días*.`)
        }

        const jidsReales = inactivos.map(j => resolverJid(j))
        const menciones = inactivos.map(j => `@${numJid(j)}`).join(' ')

        return conn.sendMessage(m.chat, {
            text: `⚠️ *ALERTA DE INACTIVIDAD*\n━━━━━━━━━━━━━━━━\n👋 Los siguientes miembros llevan más de *${dias} días* sin actividad:\n\n${menciones}\n\n━━━━━━━━━━━━━━━━\n⏰ ¡Tienen *24 horas* para dar señales de vida o serán expulsados!\n📊 Total afectados: *${inactivos.length}*`,
            mentions: jidsReales
        }, { quoted: m })
    }

    // ══════════════════════════════════════════
    //  #kickinactivos [días]  — Expulsar inactivos (no admins)
    // ══════════════════════════════════════════
    if (/^kickinactivos$/i.test(command)) {
        if (!isBotAdmin) return m.reply('❌ El bot necesita ser *admin* para poder expulsar usuarios.')

        const dias = Math.max(1, parseInt(args[0]) || DIAS_INACTIVO_DEFAULT)
        const umbralMs = dias * 86400000

        const inactivos = []
        for (const jid of memberIds) {
            if (adminsIds.includes(jid)) continue   // never kick admins
            const userData = users[jid]
            const ultimaAct = getUltimaActividad(userData)
            const diff = ultimaAct > 0 ? ahora - ultimaAct : Infinity
            if (diff >= umbralMs) inactivos.push(jid)
        }

        if (inactivos.length === 0) {
            return m.reply(`✅ No hay miembros no-admin inactivos por más de *${dias} días*.`)
        }

        await conn.sendMessage(m.chat, {
            text: `🔴 *LIMPIEZA DE INACTIVOS*\n━━━━━━━━━━━━━━━━\n🗑️ Expulsando *${inactivos.length}* usuario(s) con más de *${dias} días* sin actividad...\n⏳ Por favor espera...`,
        }, { quoted: m })

        let expulsados = 0
        let errores = 0

        for (const jid of inactivos) {
            try {
                // Usar el JID original del participante para la acción de grupo
                await conn.groupParticipantsUpdate(m.chat, [jid], 'remove')
                expulsados++
                await new Promise(r => setTimeout(r, 600))  // pausa anti-spam
            } catch {
                errores++
            }
        }

        return conn.sendMessage(m.chat, {
            text: `✅ *LIMPIEZA COMPLETADA*\n━━━━━━━━━━━━━━━━\n👢 Expulsados: *${expulsados}*\n❌ Errores: *${errores}*\n🕐 Criterio: +*${dias} días* sin actividad`,
        }, { quoted: m })
    }

    // ══════════════════════════════════════════
    //  #actividad [@user]  — Perfil de actividad de un usuario
    // ══════════════════════════════════════════
    if (/^(actividad|estadoactividad)$/i.test(command)) {
        const rawTarget = m.mentionedJid?.[0] || m.quoted?.sender || m.sender
        const target = resolverJid(rawTarget)
        const userData = users[target] || users[rawTarget]

        if (!userData) {
            return conn.sendMessage(m.chat, {
                text: `❓ No hay datos registrados para @${numJid(rawTarget)}\n_(Nunca ha interactuado con el bot)_`,
                mentions: [resolverJid(rawTarget)]
            }, { quoted: m })
        }

        const ultimaAct = getUltimaActividad(userData)
        const diasInactivo = ultimaAct > 0 ? Math.floor((ahora - ultimaAct) / 86400000) : 9999

        // Barra visual de actividad
        const score = Math.max(0, Math.min(10, 10 - Math.min(diasInactivo, 10)))
        const barra = '█'.repeat(score) + '░'.repeat(10 - score)
        const estado = diasInactivo === 9999
            ? '⚫ SIN DATOS'
            : diasInactivo >= 14 ? '🔴 MUY INACTIVO'
                : diasInactivo >= 7 ? '🟠 INACTIVO'
                    : diasInactivo >= 3 ? '🟡 POCO ACTIVO'
                        : '🟢 ACTIVO'

        // Fuentes de actividad conocidas
        const detalles = []
        if (userData.lastMessage > 0) detalles.push(`💬 Último msj en grupo: ${tiempoDesde(userData.lastMessage)}`)
        if (userData.spam > 0) detalles.push(`⌨️ Último cmd bot: ${tiempoDesde(userData.spam)}`)
        if (userData.lastwork > 0) detalles.push(`💼 Último trabajo: ${tiempoDesde(userData.lastwork)}`)
        if (userData.lastadventure > 0) detalles.push(`🗺️ Última aventura: ${tiempoDesde(userData.lastadventure)}`)
        if (userData.lastclaim > 0) detalles.push(`🎁 Último daily: ${tiempoDesde(userData.lastclaim)}`)

        const detalleStr = detalles.length > 0 ? '\n' + detalles.join('\n') : '\n_Sin historial de actividad_'

        return conn.sendMessage(m.chat, {
            text: `📊 *PERFIL DE ACTIVIDAD*\n━━━━━━━━━━━━━━━━\n👤 @${numJid(rawTarget)}\n━━━━━━━━━━━━━━━━\n🕐 Última actividad: *${tiempoDesde(ultimaAct)}*\n📅 Días inactivo: *${diasInactivo === 9999 ? 'Desconocido' : diasInactivo}*\n\n📈 Actividad: [${barra}] ${score * 10}%\n🏷️ Estado: *${estado}*\n━━━━━━━━━━━━━━━━${detalleStr}\n━━━━━━━━━━━━━━━━\n🎯 Nivel: *${userData.level || 0}* | XP: *${userData.exp || 0}*\n💰 Coins: *${userData.coin || 0}* | 🏦 Banco: *${userData.bank || 0}*`,
            mentions: [resolverJid(rawTarget)]
        }, { quoted: m })
    }
}

handler.help = [
    'inactivos [días]',
    'activos [días]',
    'alertainactivos [días]',
    'kickinactivos [días]',
    'actividad [@user]'
]
handler.tags = ['grupo']
handler.command = ['inactivos', 'activos', 'alertainactivos', 'kickinactivos', 'actividad', 'estadoactividad']
handler.group = true

export default handler
