/**
 * migrate-to-lid.js
 * ═══════════════════════════════════════════════════════════════════
 * Script de migración directa: fusiona todos los usuarios JID → LID
 * 
 * Reglas:
 *  1. Lee el lidmap: { "NUM@lid": "NUM@s.whatsapp.net" }
 *  2. Para cada par detectado, fusiona los datos eligiendo los mejores
 *  3. El registro final siempre queda con clave @lid
 *  4. Los usuarios sin LID en el mapa permanecen igual (@s.whatsapp.net)
 *  5. Actualiza referencias en marry, parents, children
 * 
 * Uso:
 *   node migrate-to-lid.js            (modo preview)
 *   node migrate-to-lid.js --apply    (aplica y guarda)
 * ═══════════════════════════════════════════════════════════════════
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH   = resolve(__dirname, 'src/database/database.json')
const BAK_PATH  = resolve(__dirname, 'src/database/database.BACKUP-pre-lid-migration.json')

// ── Reglas de fusión ────────────────────────────────────────────────
const NUM_MAX = [
    'exp','coin','diamond','health','bank','level','bankLimit',
    'lastGachaVote','lastGachaClaim','lastRw','lastwork','lastclaim',
    'lastcofre','lastadventure','lastmining','lastrobbed','lastrob',
    'lastFamilyClaim','lastMessage','bankInterestTime','lastcazar',
    'lastgift','lastduel','lastpago','lastcode','lastcodereg',
    'lastdiamantes','dailyStreak','warn','crime','commands',
    '_pptWins','_pptLosses','_pptTies','_pptStreak',
    '_pptBestStreak','_pptTotalEarned','_pptTotalLost','_lastPpt',
    'premiumTime','spam','regTime',
]
const BOOL_OR    = ['premium','banned','muto','registered','useDocument']
const STR_PREFER = ['name','genre','birth','marry','description',
                    'packstickers','role','text1','text2','bannedReason','afkReason']
const ARR_UNION  = ['parents','children']
const OBJ_MERGE  = ['achievements','inventory','daily','carrera',
                    'slots','ruleta','dados','volados']

function mergeUsers(old, cur) {
    const out = { ...cur }

    for (const f of NUM_MAX) {
        const a = Number(old[f] ?? 0), b = Number(cur[f] ?? 0)
        if (!isNaN(a) && !isNaN(b)) out[f] = Math.max(a, b)
        else if (!isNaN(a))         out[f] = a
    }
    for (const f of BOOL_OR) {
        out[f] = !!(old[f] || cur[f])
    }
    for (const f of STR_PREFER) {
        const a = old[f], b = cur[f]
        if (a && a !== '' && a !== null) out[f] = a
        else if (b && b !== '' && b !== null) out[f] = b
    }
    for (const f of ARR_UNION) {
        const a = Array.isArray(old[f]) ? old[f] : []
        const b = Array.isArray(cur[f]) ? cur[f] : []
        out[f] = [...new Set([...a, ...b])]
    }
    for (const f of OBJ_MERGE) {
        const a = (old[f] && typeof old[f]==='object') ? old[f] : {}
        const b = (cur[f] && typeof cur[f]==='object') ? cur[f] : {}
        const m = { ...a }
        for (const [k,v] of Object.entries(b)) {
            if (typeof v==='number' && typeof m[k]==='number') m[k] = Math.max(m[k],v)
            else if (v !== undefined && v !== null) m[k] = v
        }
        out[f] = m
    }

    // afk: preferir el positivo (activo)
    if ((old.afk ?? -1) > -1 && (cur.afk ?? -1) < 0) out.afk = old.afk
    else if ((cur.afk ?? -1) > -1) out.afk = cur.afk
    else out.afk = -1

    // age: preferir el válido
    if ((old.age ?? -1) > -1 && (cur.age ?? -1) < 0) out.age = old.age

    // Limpiar campos de migración ya innecesarios
    delete out.jidViejo
    delete out._mergedFrom

    return out
}

// ── Main ────────────────────────────────────────────────────────────
const apply = process.argv.includes('--apply')

console.log(`\n🔗 Migración JID → LID  [modo: ${apply ? '✅ APLICAR' : '👁 PREVIEW'}]\n`)

// Leer DB
const raw = readFileSync(DB_PATH, 'utf-8')
const db  = JSON.parse(raw)

const users  = db.users  || {}
const lidmap = db.lidmap || {}

// Construir mapa bidireccional
// lidmap: "NUM@lid" → "NUM@s.whatsapp.net"
const lidToReal = {}   // "NUM@lid"               → "NUM@s.whatsapp.net"
const realToLid = {}   // "NUM@s.whatsapp.net"     → "NUM@lid"
const lidAsJidToLid = {} // "NUM@s.whatsapp.net" (largo) → "NUM@lid"

for (const [lid, real] of Object.entries(lidmap)) {
    if (!lid.endsWith('@lid') || !real.endsWith('@s.whatsapp.net')) continue
    lidToReal[lid]  = real
    realToLid[real] = lid
    const lidAsJid  = lid.replace('@lid', '@s.whatsapp.net')
    lidAsJidToLid[lidAsJid] = lid
}

// Detectar todos los pares y acciones a tomar
// Resultado esperado: todo queda en @lid
const actions = []  // { lid, sources: [key,...], mergeData: {...} }
const processed = new Set()

for (const [lid, real] of Object.entries(lidToReal)) {
    if (processed.has(lid)) continue

    const lidAsJid = lid.replace('@lid', '@s.whatsapp.net')
    const sources  = []

    // Recopilar todas las fuentes que existen
    if (users[real])      sources.push({ key: real,      data: users[real]      })
    if (users[lidAsJid] && lidAsJid !== real) 
                          sources.push({ key: lidAsJid,  data: users[lidAsJid]  })
    if (users[lid])       sources.push({ key: lid,       data: users[lid]       })

    if (sources.length === 0) continue  // nadie tiene datos, saltar

    // Fusionar todas las fuentes en una sola
    let merged = {}
    for (const src of sources) {
        if (Object.keys(merged).length === 0) merged = { ...src.data }
        else merged = mergeUsers(src.data, merged)
    }

    actions.push({
        lid,
        real,
        lidAsJid,
        sources: sources.map(s => s.key),
        toDelete: sources.map(s => s.key).filter(k => k !== lid),
        merged,
    })

    for (const s of sources) processed.add(s.key)
    processed.add(lid)
}

// Construir mapa de reemplazos JID → LID para actualizar referencias
const jidToLidMap = {}
for (const a of actions) {
    for (const src of a.sources) {
        if (src !== a.lid) jidToLidMap[src] = a.lid
    }
    // también el real sin importar si tiene datos
    if (a.real) jidToLidMap[a.real] = a.lid
}

// ── Reporte ─────────────────────────────────────────────────────────
console.log(`📊 Estadísticas:`)
console.log(`   Total entradas en lidmap  : ${Object.keys(lidmap).length}`)
console.log(`   Total usuarios en DB      : ${Object.keys(users).length}`)
console.log(`   Pares a procesar          : ${actions.length}`)

const merges    = actions.filter(a => a.sources.length >= 2 && a.sources.some(s => s !== a.lid))
const renames   = actions.filter(a => a.sources.length >= 1 && !a.sources.includes(a.lid))
const untouched = Object.keys(users).filter(k => !processed.has(k))

console.log(`   Fusiones (2+ registros)   : ${merges.length}`)
console.log(`   Renombrados (sólo JID)    : ${renames.length}`)
console.log(`   Sin LID en mapa (quedan)  : ${untouched.length}`)
console.log()

// Mostrar detalle de fusiones
if (merges.length > 0) {
    console.log(`\n🔀 FUSIONES (muestra primeras 20):`)
    for (const a of merges.slice(0, 20)) {
        console.log(`   [MERGE] ${a.sources.join(' + ')}`)
        console.log(`        → ${a.lid}`)
        console.log(`        exp:${a.merged.exp ?? 0}  coin:${a.merged.coin ?? 0}  bank:${a.merged.bank ?? 0}  lv:${a.merged.level ?? 0}  name:${a.merged.name || '—'}`)
    }
    if (merges.length > 20) console.log(`   ... y ${merges.length - 20} más`)
}

if (renames.length > 0) {
    console.log(`\n✏️  RENOMBRADOS (muestra primeras 20):`)
    for (const a of renames.slice(0, 20)) {
        console.log(`   ${a.sources[0]}  →  ${a.lid}`)
    }
    if (renames.length > 20) console.log(`   ... y ${renames.length - 20} más`)
}

if (!apply) {
    console.log(`\n⚠️  PREVIEW completado. Para aplicar los cambios ejecuta:`)
    console.log(`   node migrate-to-lid.js --apply\n`)
    process.exit(0)
}

// ── Aplicar cambios ─────────────────────────────────────────────────
console.log(`\n💾 Aplicando cambios...`)

// 1. Backup
copyFileSync(DB_PATH, BAK_PATH)
console.log(`   ✓ Backup guardado en: ${BAK_PATH}`)

// 2. Aplicar cada acción
let applied = 0
for (const a of actions) {
    // Guardar en @lid con datos fusionados
    db.users[a.lid] = a.merged

    // Eliminar duplicados
    for (const key of a.toDelete) {
        delete db.users[key]
    }
    applied++
}

// 3. Actualizar referencias internas (marry, parents, children)
console.log(`   ✓ Actualizando referencias internas...`)
let refUpdates = 0
for (const [uid, udata] of Object.entries(db.users)) {
    let changed = false

    // marry
    if (udata.marry && jidToLidMap[udata.marry]) {
        udata.marry = jidToLidMap[udata.marry]
        changed = true
    }

    // parents
    if (Array.isArray(udata.parents)) {
        const newParents = udata.parents.map(p => jidToLidMap[p] || p)
        if (JSON.stringify(newParents) !== JSON.stringify(udata.parents)) {
            udata.parents = [...new Set(newParents)]
            changed = true
        }
    }

    // children
    if (Array.isArray(udata.children)) {
        const newChildren = udata.children.map(c => jidToLidMap[c] || c)
        if (JSON.stringify(newChildren) !== JSON.stringify(udata.children)) {
            udata.children = [...new Set(newChildren)]
            changed = true
        }
    }

    if (changed) refUpdates++
}

// 4. Actualizar referencias en warn (gacha-warn, etc.) si existe
if (db.chats) {
    for (const [cid, cdata] of Object.entries(db.chats)) {
        if (Array.isArray(cdata.warned)) {
            cdata.warned = cdata.warned.map(w => jidToLidMap[w] || w)
        }
    }
}

// 5. Guardar DB
const output = JSON.stringify(db, null, 2)
writeFileSync(DB_PATH, output)

console.log(`\n✅ Migración completada:`)
console.log(`   • Pares procesados       : ${applied}`)
console.log(`   • Referencias actualizadas: ${refUpdates}`)
console.log(`   • Usuarios finales en DB : ${Object.keys(db.users).length}`)
console.log(`   • Backup en              : database.BACKUP-pre-lid-migration.json`)
console.log()
