import { getUser, mention, uniqueJids, familyGroupTop, getRealJid, getGrandparents, getGrandchildren, getSiblings, getUnclesAunts, resolveJid } from '../src/lib/family-utils.js'

let handler = async (m, { conn, command, participants }) => {
    const senderJid = getRealJid(m.sender)
    const me = getUser(senderJid)

    // ─── VER FAMILIA ─────────────────────────────────────────
    if (/^familia$/i.test(command)) {
        const partner = me.marry ? await mention(me.marry, m) : 'Sin pareja'
        const parents = me.parents.length ? (await Promise.all(me.parents.map(p => mention(p, m)))).join(', ') : 'Sin padres'
        const children = me.children.length ? (await Promise.all(me.children.map(c => mention(c, m)))).join(', ') : 'Sin hijos'

        const allMentions = [...me.parents, ...me.children]
        if (me.marry) allMentions.push(me.marry)
        const resolvedMentions = await Promise.all(allMentions.map(j => resolveJid(j, m)))

        return conn.sendMessage(m.chat, {
            text: `👪 *Tu familia*\n\n` +
                `💞 Pareja: ${partner}\n` +
                `👨‍👩‍👧 Padres: ${parents}\n` +
                `🧒 Hijos: ${children}`,
            mentions: uniqueJids(resolvedMentions)
        }, { quoted: m })
    }

    // ─── ÁRBOL GENEALÓGICO ───────────────────────────────────
    if (/^(arbolfamilia|genealogia)$/i.test(command)) {
        const lines = [
            `🌳 *Árbol genealógico de ${await mention(senderJid, m)}*`,
            '',
        ]

        // Nivel padres
        if (me.parents.length) {
            lines.push(`📍 *Padres*`)
            for (const p of me.parents) {
                const pu = getUser(p)
                lines.push(`  └ ${await mention(p, m)} ${pu.marry && me.parents.includes(pu.marry) ? `💞 ${await mention(pu.marry, m)}` : ''}`)
            }
            lines.push('')
        }

        // Nivel actual
        lines.push(`📍 *Tú*`)
        lines.push(`  └ ${await mention(senderJid, m)} ${me.marry ? `💞 ${await mention(me.marry, m)}` : '(soltero/a)'}`)
        lines.push('')

        // Nivel hijos
        if (me.children.length) {
            lines.push(`📍 *Hijos*`)
            for (const c of me.children) {
                const cu = getUser(c)
                const grandchildren = cu.children.length ? ` → ${cu.children.length} nieto(s)` : ''
                lines.push(`  └ ${await mention(c, m)}${grandchildren}`)
            }
        }

        const allMentions = [senderJid, ...me.parents, ...me.children]
        if (me.marry) allMentions.push(me.marry)
        const resolvedMentions = await Promise.all(allMentions.map(j => resolveJid(j, m)))

        return conn.sendMessage(m.chat, { text: lines.join('\n'), mentions: uniqueJids(resolvedMentions) }, { quoted: m })
    }

    // ─── FAMILY TOP ──────────────────────────────────────────
    if (/^familiatop$/i.test(command)) {
        const ranking = familyGroupTop(participants || [])
        if (!ranking.length) return m.reply('❌ No hay familias suficientes para ranking (se necesitan al menos 2 miembros).')

        const textTop = (await Promise.all(ranking.map(async (r, i) =>
            `${i + 1}. ${(await Promise.all(r.members.map(mem => mention(mem, m)))).join(' + ')}\n   🏆 Puntaje: *${r.total}*`
        ))).join('\n\n')

        const rawMentions = ranking.flatMap(r => r.members)
        const resolvedMentions = await Promise.all(rawMentions.map(j => resolveJid(j, m)))
        return conn.sendMessage(m.chat, { text: `👑 *Top Familias del grupo*\n\n${textTop}`, mentions: uniqueJids(resolvedMentions) }, { quoted: m })
    }

    // ─── FAMILIA EXTENDIDA ───────────────────────────────────
    if (/^misabuelos$/i.test(command)) {
        const abuelos = getGrandparents(senderJid)
        if (!abuelos.length) return m.reply('👴👵 No tienes abuelos registrados en tu árbol genealógico.')
        return conn.sendMessage(m.chat, {
            text: `👴👵 *Tus Abuelos*\n\n${(await Promise.all(abuelos.map(a => mention(a, m)))).join('\n')}`,
            mentions: await Promise.all(abuelos.map(a => resolveJid(a, m)))
        }, { quoted: m })
    }

    if (/^misnietos$/i.test(command)) {
        const nietos = getGrandchildren(senderJid)
        if (!nietos.length) return m.reply('👶 No tienes nietos registrados actualmente.')
        return conn.sendMessage(m.chat, {
            text: `👶 *Tus Nietos*\n\n${(await Promise.all(nietos.map(n => mention(n, m)))).join('\n')}`,
            mentions: await Promise.all(nietos.map(n => resolveJid(n, m)))
        }, { quoted: m })
    }

    if (/^mishermanos$/i.test(command)) {
        const hermanos = getSiblings(senderJid)
        if (!hermanos.length) return m.reply('👫 No tienes hermanos registrados (hijos de tus mismos padres).')
        return conn.sendMessage(m.chat, {
            text: `👫 *Tus Hermanos*\n\n${(await Promise.all(hermanos.map(h => mention(h, m)))).join('\n')}`,
            mentions: await Promise.all(hermanos.map(h => resolveJid(h, m)))
        }, { quoted: m })
    }

    if (/^mistios$/i.test(command)) {
        const tios = getUnclesAunts(senderJid)
        if (!tios.length) return m.reply('👥 No tienes tíos/tías registrados (hermanos de tus padres).')
        return conn.sendMessage(m.chat, {
            text: `👥 *Tus Tíos/Tías*\n\n${(await Promise.all(tios.map(t => mention(t, m)))).join('\n')}`,
            mentions: await Promise.all(tios.map(t => resolveJid(t, m)))
        }, { quoted: m })
    }
}

handler.help = ['familia', 'arbolfamilia', 'familiatop', 'misabuelos', 'misnietos', 'mishermanos', 'mistios']
handler.tags = ['economy']
handler.command = ['familia', 'arbolfamilia', 'genealogia', 'familiatop', 'misabuelos', 'misnietos', 'mishermanos', 'mistios']
handler.group = true

export default handler
