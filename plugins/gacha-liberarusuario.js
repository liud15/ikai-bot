import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

let handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!args[0]) {
        return m.reply(`📋 *Uso:* ${usedPrefix + command} <nombre del usuario | ausentes> [confirmar]
        
*Ejemplo 1:* ${usedPrefix + command} Liu
*Ejemplo 2:* ${usedPrefix + command} ausentes
*Ejemplo 3:* ${usedPrefix + command} ausentes confirmar

Permite liberar personajes de un usuario por su nombre registrado, o liberar de una vez todos los personajes de los usuarios que *ya no están en el grupo* usando la opción "ausentes".
⚠️ ¡Esta acción no se puede deshacer y solo puede ser usada por el owner!`)
    }

    const chat = global.db.data.chats[m.chat]
    if (!chat.gacha || !chat.gacha.claimed) {
        return m.reply('❌ No hay personajes reclamados en este grupo aún.')
    }

    // Detectar si "confirmar/confirm" está al final
    const lastArg = args[args.length - 1]?.toLowerCase()
    const hasConfirm = lastArg === 'confirmar' || lastArg === 'confirm'
    const inputArgs = hasConfirm ? args.slice(0, -1) : args
    const nameToSearch = inputArgs.join(' ').trim().toLowerCase()

    // LÓGICA PARA USUARIOS QUE SALIERON DEL GRUPO
    if (nameToSearch === 'ausentes' || nameToSearch === 'abandonados') {
        let groupMetadata = await conn.groupMetadata(m.chat)
        let participants = groupMetadata.participants.map(p => p.id)
        
        let absentUsers = new Set()
        let charsToRelease = []

        for (let charId in chat.gacha.claimed) {
            let claimData = chat.gacha.claimed[charId]
            let jid = typeof claimData === 'string' ? claimData : claimData.owner
            
            if (!participants.includes(jid)) {
                absentUsers.add(jid)
                charsToRelease.push(charId)
            }
        }

        if (charsToRelease.length === 0) {
            return m.reply('✅ No hay personajes retenidos por usuarios que hayan abandonado el grupo.')
        }

        if (!hasConfirm) {
            let text = `⚠️ Se han encontrado *${charsToRelease.length} personajes* retenidos por *${absentUsers.size} usuarios* que ya no están en el grupo.\n\n`
            text += `👥 *Lista de usuarios ausentes:*\n`
            
            let userStats = {}
            for (let charId of charsToRelease) {
                let claimData = chat.gacha.claimed[charId]
                let jid = typeof claimData === 'string' ? claimData : claimData.owner
                
                if (!userStats[jid]) userStats[jid] = 0
                userStats[jid]++
            }
            
            let i = 1
            for (let jid of absentUsers) {
                let user = global.db.data.users[jid]
                let name = user && user.name ? user.name : String(jid).split('@')[0]
                text += `${i}. *${name}* - ${userStats[jid]} personajes\n`
                i++
            }

            text += `\nPara liberar a un usuario específico, usa:\n*${usedPrefix + command} <nombre> confirmar*\n\n`
            text += `Para liberar a TODOS los de la lista de una vez, usa:\n*${usedPrefix + command} ausentes confirmar*`
            return m.reply(text)
        }

        // Confirmado: liberar masivamente
        for (let charId of charsToRelease) {
            delete chat.gacha.claimed[charId]
        }

        return conn.reply(m.chat, `
╭─⬣「 🕊️ LIMPIEZA DE AUSENTES 」⬣
│
│ 👥 *Usuarios eliminados:* ${absentUsers.size}
│ 🗑️ *Personajes liberados:* ${charsToRelease.length}
│
│ Todos los personajes retenidos por usuarios
│ que abandonaron el grupo han sido devueltos
│ a las tiradas disponibles.
│
╰─⬣ ⬣
        `.trim(), m)
    }

    // LÓGICA ORIGINAL PARA BUSCAR POR NOMBRE
    let targetJid = null
    let targetName = null
    let claimedChars = []

    for (let charId in chat.gacha.claimed) {
        let claimData = chat.gacha.claimed[charId]
        let jid = typeof claimData === 'string' ? claimData : claimData.owner
        
        let user = global.db.data.users[jid]
        let phoneNum = String(jid).split('@')[0]
        
        let matchName = user && user.name && user.name.toLowerCase() === nameToSearch
        let matchPhone = phoneNum === nameToSearch
        
        if (matchName || matchPhone) {
            targetJid = jid
            targetName = user && user.name ? user.name : phoneNum
            break
        }
    }

    if (!targetJid) {
        return m.reply(`❌ No se encontró ningún usuario con el nombre registrado "*${inputArgs.join(' ').trim()}*" que tenga personajes en este grupo.\n\nAsegúrate de escribir el nombre exacto con el que se registró en el bot.`)
    }

    // Recolectar todos los personajes de ese usuario en este grupo
    for (let charId in chat.gacha.claimed) {
        let claimData = chat.gacha.claimed[charId]
        let jid = typeof claimData === 'string' ? claimData : claimData.owner
        
        if (jid === targetJid) {
            claimedChars.push(charId)
        }
    }

    if (claimedChars.length === 0) {
        return m.reply(`❌ El usuario "*${targetName}*" no tiene personajes en este grupo.`)
    }

    if (!hasConfirm) {
        return m.reply(`⚠️ ¿Estás seguro de liberar TODOS los personajes (${claimedChars.length}) del usuario *${targetName}* en este grupo?
        
Escribe *${usedPrefix + command} ${targetName} confirmar* para confirmar.`)
    }

    // Liberar los personajes
    for (let charId of claimedChars) {
        delete chat.gacha.claimed[charId]
    }

    await conn.reply(m.chat, `
╭─⬣「 🕊️ PERSONAJES LIBERADOS 」⬣
│
│ 👤 *Usuario:* ${targetName}
│ 🗑️ *Cantidad:* ${claimedChars.length} personajes
│
│ Todos los personajes de este usuario en 
│ el grupo han sido liberados y ahora
│ pueden volver a aparecer en las tiradas.
│
╰─⬣ ⬣
  `.trim(), m)
}

handler.help = ['liberaruser <nombre | ausentes> confirmar']
handler.tags = ['gacha', 'owner']
handler.command = ['liberaruser', 'releaseuser', 'freeroster']
handler.group = true
handler.owner = true // Solo el owner puede usarlo

export default handler
