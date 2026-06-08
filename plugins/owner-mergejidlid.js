// ══════════════════════════════════════════════════════════════════════
// 🔗 PLUGIN: FUSIÓN JID ↔ LID  (owner-mergejidlid.js)
// ══════════════════════════════════════════════════════════════════════
// Soluciona usuarios con datos duplicados por la transición JID → LID:
//
//  Ejemplo del problema:
//   "73345777328326@s.whatsapp.net"  ← LID guardado como JID (NUEVO)
//   "51976467097@s.whatsapp.net"     ← número real (ANTIGUO)
//   lidmap: "73345777328326@lid" → "51976467097@s.whatsapp.net"
//
//  El plugin detecta estos pares usando el lidmap y fusiona los datos
//  eligiendo siempre los valores más ricos (mayor exp, coins, etc.)
//
//  Comandos:
//   #mergelid            → lista pares detectados
//   #mergelid preview N  → muestra cómo quedaría el par N
//   #mergelid confirmar  → aplica la fusión (guarda la DB)
// ══════════════════════════════════════════════════════════════════════

// ── Campos numéricos: se elige el MAYOR ───────────────────────────────
const NUM_MAX = [
    'exp', 'coin', 'diamond', 'health', 'bank', 'level', 'bankLimit',
    'lastGachaVote', 'lastGachaClaim', 'lastRw', 'lastwork', 'lastclaim',
    'lastcofre', 'lastadventure', 'lastmining', 'lastrobbed', 'lastrob',
    'lastFamilyClaim', 'lastMessage', 'bankInterestTime', 'lastcazar',
    'lastgift', 'lastduel', 'lastpago', 'lastcode', 'lastcodereg',
    'lastdiamantes', 'dailyStreak', 'warn', 'crime', 'commands',
    '_pptWins', '_pptLosses', '_pptTies', '_pptStreak',
    '_pptBestStreak', '_pptTotalEarned', '_pptTotalLost', '_lastPpt',
    'premiumTime', 'spam', 'regTime',
]

// ── Booleanos: OR lógico ───────────────────────────────────────────────
const BOOL_OR = ['premium', 'banned', 'muto', 'registered', 'useDocument']

// ── Strings: preferir el no vacío ─────────────────────────────────────
const STR_PREFER = ['name', 'genre', 'birth', 'marry', 'description',
    'packstickers', 'role', 'text1', 'text2', 'bannedReason', 'afkReason']

// ── Arrays: unión sin duplicados ──────────────────────────────────────
const ARR_UNION = ['parents', 'children']

// ── Objetos: merge con max en numéricos ───────────────────────────────
const OBJ_MERGE = ['achievements', 'inventory', 'daily', 'carrera', 'slots', 'ruleta', 'dados', 'volados']

/**
 * Fusiona dos registros de usuario escogiendo los datos más ricos.
 * @param {object} a - datos del registro "viejo" (a eliminar)
 * @param {object} b - datos del registro "destino" (a conservar)
 */
function mergeUsers(a, b) {
    const out = { ...b }

    for (const f of NUM_MAX) {
        const va = Number(a[f] ?? 0), vb = Number(b[f] ?? 0)
        if (!isNaN(va) && !isNaN(vb)) out[f] = Math.max(va, vb)
        else if (!isNaN(va)) out[f] = va
    }

    for (const f of BOOL_OR) {
        out[f] = !!(a[f] || b[f])
    }

    for (const f of STR_PREFER) {
        const va = a[f], vb = b[f]
        const emA = !va || va === '' || va === null
        const emB = !vb || vb === '' || vb === null
        if (!emA) out[f] = va
        else if (!emB) out[f] = vb
    }

    for (const f of ARR_UNION) {
        const va = Array.isArray(a[f]) ? a[f] : []
        const vb = Array.isArray(b[f]) ? b[f] : []
        out[f] = [...new Set([...va, ...vb])]
    }

    for (const f of OBJ_MERGE) {
        const va = (a[f] && typeof a[f] === 'object') ? a[f] : {}
        const vb = (b[f] && typeof b[f] === 'object') ? b[f] : {}
        const merged = { ...va }
        for (const [k, v] of Object.entries(vb)) {
            if (typeof v === 'number' && typeof merged[k] === 'number') {
                merged[k] = Math.max(merged[k], v)
            } else if (v !== undefined && v !== null) {
                merged[k] = v
            }
        }
        out[f] = merged
    }

    // afk: preferir -1 solo si el otro también es -1
    if ((a.afk ?? -1) > -1 && (b.afk ?? -1) < 0) out.afk = a.afk
    else if ((b.afk ?? -1) > -1) out.afk = b.afk
    else out.afk = -1

    // edad: preferir el válido
    if ((a.age ?? -1) > -1 && (b.age ?? -1) < 0) out.age = a.age

    // Historial de fusiones
    if (!Array.isArray(out._mergedFrom)) out._mergedFrom = []
    if (!out._mergedFrom.includes(a._sourceKey)) out._mergedFrom.push(a._sourceKey)

    return out
}

// ── Detectar pares duplicados usando el lidmap ────────────────────────
function detectPairs() {
    const users  = global.db.data.users  || {}
    const lidmap = global.db.data.lidmap || {}

    // lidmap: "NUM@lid" → "NUM@s.whatsapp.net"
    // También puede existir el LID almacenado como @s.whatsapp.net en users

    const lidToReal = {}  // clave normalizada → JID real (@s.whatsapp.net corto)
    const realToLid = {}  // JID real            → clave de LID en users

    for (const [lid, real] of Object.entries(lidmap)) {
        if (!lid.endsWith('@lid') || !real.endsWith('@s.whatsapp.net')) continue
        const lidNum = lid.replace('@lid', '')

        // El LID puede vivir en users como "@lid" o como "@s.whatsapp.net"
        const lidAsLid = lid                              // NUM@lid
        const lidAsJid = lidNum + '@s.whatsapp.net'       // NUM@s.whatsapp.net

        if (users[lidAsLid])  { lidToReal[lidAsLid] = real;  realToLid[real] = lidAsLid }
        if (users[lidAsJid])  { lidToReal[lidAsJid] = real;  realToLid[real] = realToLid[real] || lidAsJid }
    }

    const pairs  = []
    const seen   = new Set()

    // Caso A: iterar usuarios con @lid → buscar su real
    for (const key of Object.keys(users)) {
        if (seen.has(key)) continue
        const realKey = lidToReal[key]
        if (realKey && users[realKey] && realKey !== key) {
            const pId = [key, realKey].sort().join('|')
            if (!seen.has(pId)) {
                pairs.push({ lidKey: key, realKey })
                seen.add(pId); seen.add(key); seen.add(realKey)
            }
        }
    }

    // Caso B: iterar usuarios con JID real → buscar su LID duplicado
    for (const key of Object.keys(users)) {
        if (seen.has(key)) continue
        if (!key.endsWith('@s.whatsapp.net')) continue
        const lidKey = realToLid[key]
        if (lidKey && users[lidKey] && lidKey !== key) {
            const pId = [key, lidKey].sort().join('|')
            if (!seen.has(pId)) {
                pairs.push({ lidKey, realKey: key })
                seen.add(pId); seen.add(key); seen.add(lidKey)
            }
        }
    }

    return pairs
}

// ══════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════
let handler = async (m, { conn, args, isROwner }) => {
    if (!isROwner) return m.reply('> ⚠️ Solo el owner puede ejecutar este comando.')

    const subcmd = (args[0] || '').toLowerCase()

    // ── Sin argumento: listar pares ────────────────────────────────────
    if (!subcmd) {
        const pairs = detectPairs()
        if (pairs.length === 0) {
            return m.reply(
                `> ✅ *No se encontraron usuarios duplicados.*\n\n` +
                `Todos los datos JID/LID ya están unificados o no hay pares en el lidmap.`
            )
        }
        const users = global.db.data.users || {}
        const lines = pairs.map((p, i) => {
            const a = users[p.lidKey]  || {}
            const b = users[p.realKey] || {}
            return (
                `*${i + 1}.* LID: \`${p.lidKey}\`\n` +
                `     exp:${a.exp ?? 0} coin:${a.coin ?? 0} lv:${a.level ?? 0} name:${a.name || '—'}\n` +
                `     REAL: \`${p.realKey}\`\n` +
                `     exp:${b.exp ?? 0} coin:${b.coin ?? 0} lv:${b.level ?? 0} name:${b.name || '—'}`
            )
        }).join('\n\n')

        return m.reply(
            `> 🔗 *Fusión JID ↔ LID — ${pairs.length} par(es) detectado(s)*\n\n` +
            lines + '\n\n' +
            `> • *#mergelid preview N* → ver detalle del par N\n` +
            `> • *#mergelid confirmar* → aplicar fusión`
        )
    }

    // ── Preview de un par ──────────────────────────────────────────────
    if (subcmd === 'preview') {
        const pairs = detectPairs()
        const idx = parseInt(args[1]) - 1
        if (isNaN(idx) || idx < 0 || idx >= pairs.length) {
            return m.reply(`> ⚠️ Escribe un número entre 1 y ${pairs.length}.`)
        }
        const users = global.db.data.users || {}
        const p = pairs[idx]
        const aRaw = { ...(users[p.lidKey]  || {}), _sourceKey: p.lidKey  }
        const bRaw = { ...(users[p.realKey] || {}) }
        const merged = mergeUsers(aRaw, bRaw)

        return m.reply([
            `*🔍 Preview Par #${idx + 1}*`,
            ``,
            `*LID (a eliminar):* \`${p.lidKey}\``,
            `  exp:${aRaw.exp ?? 0} | coin:${aRaw.coin ?? 0} | bank:${aRaw.bank ?? 0} | lv:${aRaw.level ?? 0}`,
            `  name:${aRaw.name || '—'} | marry:${aRaw.marry || '—'}`,
            `  parents:[${(aRaw.parents || []).join(', ')}] children:[${(aRaw.children || []).join(', ')}]`,
            ``,
            `*REAL (destino):* \`${p.realKey}\``,
            `  exp:${bRaw.exp ?? 0} | coin:${bRaw.coin ?? 0} | bank:${bRaw.bank ?? 0} | lv:${bRaw.level ?? 0}`,
            `  name:${bRaw.name || '—'} | marry:${bRaw.marry || '—'}`,
            `  parents:[${(bRaw.parents || []).join(', ')}] children:[${(bRaw.children || []).join(', ')}]`,
            ``,
            `*✨ Resultado final (en REAL):*`,
            `  exp:${merged.exp} | coin:${merged.coin} | bank:${merged.bank} | lv:${merged.level}`,
            `  name:${merged.name || '—'} | marry:${merged.marry || '—'}`,
            `  parents:[${(merged.parents || []).join(', ')}] children:[${(merged.children || []).join(', ')}]`,
            ``,
            `> El registro LID será *eliminado* tras la fusión.`,
        ].join('\n'))
    }

    // ── Confirmar fusión ───────────────────────────────────────────────
    if (subcmd === 'confirmar') {
        const pairs = detectPairs()
        if (pairs.length === 0) return m.reply('> ✅ Nada que fusionar.')

        let ok = 0
        const log = []

        for (const p of pairs) {
            try {
                const aRaw = { ...(global.db.data.users[p.lidKey]  || {}), _sourceKey: p.lidKey  }
                const bRaw = { ...(global.db.data.users[p.realKey] || {}) }
                const merged = mergeUsers(aRaw, bRaw)

                // Guardar fusión en el registro REAL y eliminar el LID
                global.db.data.users[p.realKey] = merged
                delete global.db.data.users[p.lidKey]

                log.push(`✓ ${p.lidKey} ↔ ${p.realKey}`)
                ok++
            } catch (e) {
                log.push(`✗ Error en ${p.lidKey}: ${e.message}`)
                console.error('[mergelid confirmar]', e)
            }
        }

        global.db.save()

        const reporte = log.slice(0, 25).join('\n') + (log.length > 25 ? `\n... y ${log.length - 25} más` : '')
        return m.reply(
            `> 🔗 *Fusión Completada*\n\n` +
            `✅ *${ok}/${pairs.length}* usuarios fusionados.\n\n` +
            `*Detalle:*\n${reporte}\n\n` +
            `> La base de datos fue guardada automáticamente.`
        )
    }

    // ── Ayuda ──────────────────────────────────────────────────────────
    return m.reply(
        `> 🔗 *Fusión JID ↔ LID*\n\n` +
        `• *#mergelid* — Lista pares duplicados detectados\n` +
        `• *#mergelid preview N* — Detalle del par N\n` +
        `• *#mergelid confirmar* — Aplica la fusión ⚠️ (irreversible sin backup)`
    )
}

handler.command = /^mergelid$/i
handler.help    = ['mergelid - Fusiona datos duplicados JID/LID']
handler.tags    = ['owner']
handler.rowner  = true

export default handler
