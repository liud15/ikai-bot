/**
 * ═══════════════════════════════════════════════════════════════
 *  gacha-malscraper.js — Plugin de scraping MAL para el bot
 * ═══════════════════════════════════════════════════════════════
 *
 * Comandos disponibles:
 *   #malscraper start=N        → Inicia scraping desde el ID N (lote de 100)
 *   #malscraper status         → Ver estado del último scraping
 *   #malscraper import         → Importar los personajes ya scrapeados
 *   #malscraper preview        → Ver los primeros 10 del lote actual
 *   #malscraper clear          → Borrar caché del lote actual
 *   #malscraper next           → Continúa desde donde paró el último lote
 *
 * Solo owner y gachaAdmins pueden usar este comando.
 * ═══════════════════════════════════════════════════════════════
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHARS_PATH = path.join(__dirname, '..', 'src', 'database', 'characters.json')
const STATE_PATH = path.join(__dirname, '..', 'src', 'database', 'mal-scraper-state.json')

// ═══════════════════════════════════════════════════════
//  JIKAN API — Fetch de personaje individual
// ═══════════════════════════════════════════════════════
const JIKAN_BASE = 'https://api.jikan.moe/v4'
const JIKAN_DELAY_MS = 1200  // ~50 req/min (límite oficial: 60/min)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Normalizar: quita tildes, lowercase, solo alfanumérico+espacios
function normalizeKey(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

// Invertir orden de palabras: "Nico Robin" → "Robin Nico"
const reverseWords = (str) => str.split(' ').reverse().join(' ')

// Token-set: mismas palabras sin importar orden
const tokenSet = (str) => str.split(' ').filter(Boolean).sort().join(' ')

function mapGender(g) {
    if (!g) return 'desconocido'
    const l = g.toLowerCase()
    if (l === 'female') return 'Mujer'
    if (l === 'male') return 'Hombre'
    return 'desconocido'
}

function getBestImage(images) {
    if (!images) return null
    return images.webp?.image_url || images.jpg?.image_url ||
           images.webp?.small_image_url || images.jpg?.small_image_url || null
}

async function fetchCharacter(malId) {
    try {
        const res = await fetch(`${JIKAN_BASE}/characters/${malId}/full`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'ikai-bot/1.0' },
            signal: AbortSignal.timeout(12000)
        })

        if (res.status === 404) return { skip: true, reason: '404' }
        if (res.status === 429) return { rateLimit: true }
        if (!res.ok) return { skip: true, reason: `HTTP ${res.status}` }

        const json = await res.json()
        const data = json.data
        if (!data?.name) return { skip: true, reason: 'sin datos' }

        const hasAnime = data.anime?.length > 0
        const hasManga = data.manga?.length > 0
        if (!hasAnime && !hasManga) return { skip: true, reason: 'no tiene anime/manga' }

        let source = ''
        if (hasAnime) source = data.anime[0]?.anime?.title || ''
        else if (hasManga) source = data.manga[0]?.manga?.title || ''
        if (!source) return { skip: true, reason: 'sin source' }

        const img = getBestImage(data.images)
        if (!img) return { skip: true, reason: 'sin imagen' }

        const aliases = (data.nicknames || []).filter(n => n?.trim())

        return {
            ok: true,
            char: {
                malId,
                name: data.name.trim(),
                gender: mapGender(data.gender),
                source: source.trim(),
                img,
                aliases
            }
        }
    } catch (e) {
        return { skip: true, reason: e.name === 'TimeoutError' ? 'timeout' : e.message }
    }
}

// ═══════════════════════════════════════════════════════
//  Estado persistente del scraper
// ═══════════════════════════════════════════════════════
function loadState() {
    try {
        if (fs.existsSync(STATE_PATH)) {
            return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'))
        }
    } catch (e) { /* sin estado */ }
    return {
        running: false,
        lastStartId: 1,
        lastEndId: 0,
        collected: [],
        stats: { found: 0, skipped: 0, duplicates: 0 }
    }
}

function saveState(state) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

// ═══════════════════════════════════════════════════════
// ═ Construir índice de personajes existentes
// ═══════════════════════════════════════════════════════
function buildExistingIndex() {
    const raw = fs.readFileSync(CHARS_PATH, 'utf-8')
    const chars = JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw)

    const names    = new Set(chars.map(c => normalizeKey(c.name)))
    const reversed = new Set(chars.map(c => reverseWords(normalizeKey(c.name))))
    const tokens   = new Set(chars.map(c => tokenSet(normalizeKey(c.name))))
    const aliases  = new Set(
        chars.flatMap(c => {
            if (!c.aliases) return []
            if (Array.isArray(c.aliases)) return c.aliases.map(normalizeKey)
            if (typeof c.aliases === 'string' && c.aliases.trim()) return [normalizeKey(c.aliases)]
            return []
        })
    )
    const maxId = chars.reduce((m, c) => Math.max(m, parseInt(c.id) || 0), 0)
    return { names, reversed, tokens, aliases, count: chars.length, maxId }
}

function isDuplicate(char, names, aliases, reversed, tokens) {
    const nk  = normalizeKey(char.name)
    const nrv = reverseWords(nk)
    const ntk = tokenSet(nk)

    // 1. Nombre exacto
    if (names.has(nk))    return `nombre exacto "${char.name}" ya existe`
    // 2. Nombre invertido (orden japonés ↔ occidental)
    if (names.has(nrv))   return `nombre invertido "${reverseWords(char.name)}" ya existe`
    // 3. Mismas palabras en diferente orden
    if (tokens && tokens.has(ntk)) return `mismas palabras ("${char.name}") ya existen`
    // 4. Nombre como alias existente
    if (aliases.has(nk))  return `nombre "${char.name}" ya existe como alias`
    if (aliases.has(nrv)) return `nombre invertido ya existe como alias`

    // 5. Aliases del personaje entrante
    for (const alias of (char.aliases || [])) {
        const ak  = normalizeKey(alias)
        const arv = reverseWords(ak)
        const atk = tokenSet(ak)
        if (names.has(ak))              return `alias "${alias}" coincide con nombre existente`
        if (names.has(arv))             return `alias invertido "${alias}" coincide con nombre existente`
        if (tokens && tokens.has(atk))  return `alias "${alias}" (mismas palabras) coincide con nombre existente`
        if (aliases.has(ak))            return `alias "${alias}" ya existe en otro personaje`
    }
    return null
}

// ═══════════════════════════════════════════════════════
//  SCRAPING en background (Promise que devuelve resultados)
// ═══════════════════════════════════════════════════════
async function runScrape(startId, batchSize, progressCallback) {
    const idx = buildExistingIndex()
    const { names, reversed, tokens, aliases } = idx

    const collected = []
    let currentId = startId
    let consecutiveEmpty = 0
    const MAX_EMPTY = 60
    let totalRequests = 0
    let skipped = 0
    let duplicates = 0
    let rateLimitHits = 0

    while (collected.length < batchSize && consecutiveEmpty < MAX_EMPTY) {
        if (totalRequests > 0) await sleep(JIKAN_DELAY_MS)
        totalRequests++

        let result
        let retries = 0
        do {
            result = await fetchCharacter(currentId)
            if (result.rateLimit) {
                rateLimitHits++
                await sleep(8000 + rateLimitHits * 2000)
                retries++
            }
        } while (result.rateLimit && retries < 4)

        if (result.skip || result.rateLimit) {
            skipped++
            consecutiveEmpty++
            currentId++
            continue
        }

        if (result.ok) {
            const char = result.char
            const dupReason = isDuplicate(char, names, aliases, reversed, tokens)

            if (dupReason) {
                duplicates++
                consecutiveEmpty = 0
                currentId++
                continue
            }

            // Personaje nuevo — agregar al índice temporal
            const nk = normalizeKey(char.name)
            names.add(nk)
            reversed.add(reverseWords(nk))
            tokens.add(tokenSet(nk))
            for (const alias of char.aliases) aliases.add(normalizeKey(alias))

            collected.push({
                name: char.name,
                gender: char.gender,
                source: char.source,
                img: [char.img],
                vid: [],
                aliases: char.aliases.length ? char.aliases : '',
                malId: char.malId
            })

            consecutiveEmpty = 0

            // Callback de progreso cada 10 personajes
            if (collected.length % 10 === 0) {
                await progressCallback(collected.length, batchSize, char.name, currentId)
            }
        }

        currentId++
    }

    return {
        collected,
        lastId: currentId,
        stats: { found: collected.length, skipped, duplicates, requests: totalRequests }
    }
}

// ═══════════════════════════════════════════════════════
//  Importar personajes al characters.json
// ═══════════════════════════════════════════════════════
function importCharacters(newChars) {
    const raw = fs.readFileSync(CHARS_PATH, 'utf-8')
    const chars = JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw)

    // Verificación final de duplicados con índice actualizado
    const idx = buildExistingIndex()
    let nextId = idx.maxId + 1

    const added = []
    const rejected = []

    for (const raw of newChars) {
        const dupReason = isDuplicate(raw, idx.names, idx.aliases, idx.reversed, idx.tokens)
        if (dupReason) {
            rejected.push({ name: raw.name, reason: dupReason })
            continue
        }

        const newChar = {
            id: String(nextId++),
            name: raw.name,
            gender: raw.gender,
            value: String(Math.floor(Math.random() * 2501) + 500),
            source: raw.source,
            img: raw.img,
            vid: raw.vid || [],
            user: null,
            status: 'Libre',
            votes: 0,
            aliases: raw.aliases || ''
        }

        chars.push(newChar)
        idx.names.add(normalizeKey(raw.name))
        if (Array.isArray(raw.aliases)) {
            for (const alias of raw.aliases) idx.aliases.add(normalizeKey(alias))
        }
        added.push(newChar)
    }

    if (added.length > 0) {
        fs.writeFileSync(CHARS_PATH, JSON.stringify(chars, null, 2))
    }

    return { added, rejected, total: chars.length }
}

// ═══════════════════════════════════════════════════════
//  HANDLER DEL PLUGIN
// ═══════════════════════════════════════════════════════
// Mapa para rastrear scrapings activos por chat
const activeScrapes = new Map()

let handler = async (m, { conn, text, isOwner }) => {
    const settings = global.db?.data?.settings?.[conn.user.jid] || {}
    const gachaAdmins = settings.gachaAdmins || []
    const isGachaAdmin = gachaAdmins.includes(m.sender)

    if (!isOwner && !isGachaAdmin) {
        return m.reply('❌ Solo el *owner* o los *admins de gacha* pueden usar este comando.')
    }

    const cmd = (text || '').trim().toLowerCase()
    const state = loadState()

    // ─── HELP ───────────────────────────────────────────────────
    if (!cmd || cmd === 'help') {
        return m.reply(`╭─⬣「 🔍 MAL SCRAPER 」⬣
│
│ *Comandos disponibles:*
│
│ 📥 *#malscraper start=N*
│   Inicia scraping desde ID N de MAL
│   Extrae 100 personajes nuevos
│
│ ▶️ *#malscraper next*
│   Continúa desde el último ID scrapeado
│
│ 📊 *#malscraper status*
│   Ver estado del lote actual
│
│ 👁️ *#malscraper preview*
│   Ver los primeros 10 personajes del lote
│
│ ✅ *#malscraper import*
│   Importar lote actual a characters.json
│
│ 🗑️ *#malscraper clear*
│   Borrar el lote actual sin importar
│
╰─⬣ Fuente: MyAnimeList via Jikan API ⬣

💡 *Ejemplo:* #malscraper start=1
💡 *Para continuar:* #malscraper next`)
    }

    // ─── STATUS ─────────────────────────────────────────────────
    if (cmd === 'status') {
        const isActive = activeScrapes.has(m.chat)
        const idx = buildExistingIndex()

        return m.reply(`╭─⬣「 📊 ESTADO DEL SCRAPER 」⬣
│
│ 🔄 *Scraping activo:* ${isActive ? '✅ SÍ' : '❌ No'}
│ 📦 *Lote en caché:* ${state.collected.length} personajes
│ 🆔 *Último ID MAL:* ${state.lastEndId || 'N/A'}
│ 🎴 *Total en BD:* ${idx.count} personajes
│
│ *Último scraping:*
│   ✅ Encontrados: ${state.stats?.found || 0}
│   ↷ Duplicados: ${state.stats?.duplicates || 0}
│   ⚠️ Omitidos: ${state.stats?.skipped || 0}
│
╰─⬣ Próximo ID: ${state.lastEndId + 1 || 1} ⬣`)
    }

    // ─── PREVIEW ────────────────────────────────────────────────
    if (cmd === 'preview') {
        if (!state.collected || state.collected.length === 0) {
            return m.reply('⚠️ No hay personajes en el lote actual.\n\nUsa *#malscraper start=N* para iniciar.')
        }

        const preview = state.collected.slice(0, 10)
        const genderEmoji = (g) => g === 'Mujer' ? '♀️' : g === 'Hombre' ? '♂️' : '⚧️'

        let msg = `╭─⬣「 👁️ PREVIEW DEL LOTE 」⬣\n│\n│ Total: ${state.collected.length} personajes\n│\n`
        for (let i = 0; i < preview.length; i++) {
            const c = preview[i]
            msg += `│ ${i + 1}. ${genderEmoji(c.gender)} *${c.name}*\n│    📺 ${c.source}\n`
        }
        if (state.collected.length > 10) {
            msg += `│ ... y ${state.collected.length - 10} más\n`
        }
        msg += `│\n╰─⬣ Usa #malscraper import para agregar ⬣`

        return m.reply(msg)
    }

    // ─── CLEAR ──────────────────────────────────────────────────
    if (cmd === 'clear') {
        const count = state.collected?.length || 0
        state.collected = []
        state.stats = { found: 0, skipped: 0, duplicates: 0 }
        saveState(state)
        return m.reply(`🗑️ Lote eliminado. Se descartaron *${count}* personajes.`)
    }

    // ─── IMPORT ─────────────────────────────────────────────────
    if (cmd === 'import') {
        if (!state.collected || state.collected.length === 0) {
            return m.reply('⚠️ No hay personajes en el lote para importar.\n\nEjecuta primero *#malscraper start=N*')
        }

        await m.react('⏳')
        await m.reply(`⏳ Importando *${state.collected.length}* personajes con verificación de duplicados...`)

        try {
            const result = importCharacters(state.collected)

            // Limpiar el lote después de importar
            state.collected = []
            saveState(state)

            await m.react('✅')

            const msg = `╭─⬣「 ✅ IMPORTACIÓN COMPLETADA 」⬣
│
│ ✅ *Agregados:* ${result.added.length}
│ ↷ *Rechazados:* ${result.rejected.length} (duplicados)
│ 🎴 *Total BD:* ${result.total}
│
${result.rejected.length > 0 ? `│ *Rechazados:*\n${result.rejected.slice(0, 5).map(r => `│   ⚠️ ${r.name}: ${r.reason}`).join('\n')}\n${result.rejected.length > 5 ? `│   ... y ${result.rejected.length - 5} más\n` : ''}` : ''}│
╰─⬣ ¡Personajes listos en el gacha! ⬣`

            return conn.reply(m.chat, msg, m)

        } catch (e) {
            await m.react('❌')
            return m.reply('❌ Error al importar: ' + e.message)
        }
    }

    // ─── NEXT ───────────────────────────────────────────────────
    if (cmd === 'next') {
        const nextStart = (state.lastEndId || 0) + 1
        if (nextStart <= 0) {
            return m.reply('⚠️ No hay un scraping previo. Usa *#malscraper start=N*')
        }
        // Redirigir a start con el siguiente ID
        text = `start=${nextStart}`
        // Caer al bloque de start abajo
    }

    // ─── START ──────────────────────────────────────────────────
    const startMatch = (text || cmd).match(/start=(\d+)/i)
    if (!startMatch) {
        return m.reply('❌ Uso: *#malscraper start=N*\n\nEjemplo: *#malscraper start=1*\n\nPara más ayuda: *#malscraper help*')
    }

    const startId = parseInt(startMatch[1])
    if (isNaN(startId) || startId < 1) {
        return m.reply('❌ El ID debe ser un número mayor a 0.')
    }

    // Verificar si ya hay un scraping activo
    if (activeScrapes.has(m.chat)) {
        return m.reply(`⚠️ Ya hay un scraping activo en este chat.

📊 Usa *#malscraper status* para ver el progreso.
👁️ Usa *#malscraper preview* para ver los personajes encontrados.`)
    }

    // Si hay personajes en caché, preguntar
    if (state.collected && state.collected.length > 0) {
        return m.reply(`⚠️ Ya hay *${state.collected.length}* personajes en el lote actual (ID ${state.lastStartId} al ${state.lastEndId}).

*Opciones:*
• *#malscraper import* — Importar los actuales y luego inicia uno nuevo
• *#malscraper clear* — Descartar y empezar desde cero
• *#malscraper next* — Continuar desde donde paró`)
    }

    // ── Iniciar scraping ─────────────────────────────────────────
    const idx = buildExistingIndex()
    await m.react('🔍')

    const startMsg = `╭─⬣「 🔍 SCRAPING INICIADO 」⬣
│
│ 🆔 *ID inicio MAL:* ${startId}
│ 🎯 *Objetivo:* 100 personajes nuevos
│ 🎴 *BD actual:* ${idx.count} personajes
│
│ ⏳ Esto puede tardar 3-5 minutos...
│ Usa *#malscraper status* para ver progreso
│
╰─⬣ Jikan API · Rate limit: ~50 req/min ⬣`

    await conn.reply(m.chat, startMsg, m)

    // Actualizar estado
    state.running = true
    state.lastStartId = startId
    state.collected = []
    saveState(state)

    // Marcar como activo
    activeScrapes.set(m.chat, { startId, startTime: Date.now() })

    // ── Ejecutar scraping asíncrono ───────────────────────────────
    const progressCallback = async (found, total, lastName, currentMalId) => {
        // Guardar progreso
        state.lastEndId = currentMalId
        saveState(state)

        // Notificar cada 25 personajes
        if (found % 25 === 0) {
            try {
                await conn.reply(m.chat,
                    `📊 *Progreso:* ${found}/${total}\n🆔 ID MAL actual: ${currentMalId}\n📝 Último: _${lastName}_`,
                    m
                )
            } catch (e) { /* ignorar errores de notificación */ }
        }
    }

    // Ejecutar en background
    runScrape(startId, 100, progressCallback)
        .then(async (result) => {
            activeScrapes.delete(m.chat)

            // Guardar en estado persistente
            state.running = false
            state.collected = result.collected
            state.lastEndId = result.lastId
            state.stats = result.stats
            saveState(state)

            const elapsed = Math.round((Date.now() - activeScrapes.get?.(m.chat)?.startTime || 0) / 1000)

            const doneMsg = `╭─⬣「 ✅ SCRAPING COMPLETADO 」⬣
│
│ ✅ *Nuevos encontrados:* ${result.stats.found}
│ ↷ *Duplicados:* ${result.stats.duplicates}
│ ⚠️ *Omitidos:* ${result.stats.skipped}
│ 🆔 *Último ID MAL:* ${result.lastId - 1}
│
│ *¿Qué deseas hacer?*
│ • *#malscraper preview* — Ver personajes
│ • *#malscraper import* — Agregar a la BD
│ • *#malscraper next* — Continuar scraping
│ • *#malscraper clear* — Descartar
│
╰─⬣ Lote listo para importar ⬣`

            try {
                await conn.reply(m.chat, doneMsg, m)
                await m.react('✅')
            } catch (e) { /* ignorar */ }
        })
        .catch(async (e) => {
            activeScrapes.delete(m.chat)
            state.running = false
            saveState(state)

            try {
                await conn.reply(m.chat, `❌ Error durante el scraping: ${e.message}`, m)
                await m.react('❌')
            } catch (_) { /* ignorar */ }
        })
}

handler.help = ['malscraper [start=N|status|import|preview|clear|next]']
handler.tags = ['gacha']
handler.command = ['malscraper', 'malchar', 'scrapmal']
handler.owner = false

export default handler
