/**
 * ═══════════════════════════════════════════════════════════════
 *  MyAnimeList Character Scraper  ·  scripts/mal-scraper.js
 * ═══════════════════════════════════════════════════════════════
 *
 * Extrae personajes de MAL (https://myanimelist.net/character/<id>)
 * y los guarda listos para importar con import-characters.js
 *
 * USO:
 *   node scripts/mal-scraper.js --start=1 --batch=100
 *   node scripts/mal-scraper.js --start=1 --batch=100 --out=personajes_lote.json
 *   node scripts/mal-scraper.js --start=500 --batch=100 --max-empty=30
 *
 * OPCIONES:
 *   --start=N        ID inicial de MAL (default: 1)
 *   --batch=N        Cuántos personajes NUEVOS obtener (default: 100)
 *   --out=FILE       Archivo de salida (default: mal-batch-<start>.json)
 *   --max-empty=N    IDs vacíos consecutivos antes de parar (default: 50)
 *   --delay=MS       Delay entre requests en ms (default: 800)
 *   --resume         Si existe el archivo de salida, continua desde donde paró
 *   --import         Tras scraping, importar automáticamente con --write
 *   --no-fuzzy       Deshabilitar verificación fuzzy al importar
 * ═══════════════════════════════════════════════════════════════
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '..')
const CHARS_PATH = path.join(rootDir, 'src', 'database', 'characters.json')

// ── Parsear argumentos ──────────────────────────────────────────
const args = Object.fromEntries(
    process.argv.slice(2)
        .filter(a => a.startsWith('--'))
        .map(a => {
            const [k, v] = a.replace('--', '').split('=')
            return [k, v === undefined ? true : v]
        })
)

const START_ID   = parseInt(args.start   || 1)
const BATCH_SIZE = parseInt(args.batch   || 100)
const MAX_EMPTY  = parseInt(args['max-empty'] || 50)
const DELAY_MS   = parseInt(args.delay   || 800)
const DO_IMPORT  = args.import === true
const NO_FUZZY   = args['no-fuzzy'] === true
const RESUME     = args.resume === true
const OUT_FILE   = args.out
    ? path.resolve(args.out)
    : path.join(rootDir, 'src', 'database', `mal-batch-${START_ID}.json`)

// ── Progress file (para --resume) ───────────────────────────────
const PROGRESS_FILE = OUT_FILE.replace('.json', '.progress.json')

// ── Constantes ──────────────────────────────────────────────────
const MAL_CHAR_URL = (id) => `https://myanimelist.net/character/${id}`
const MAL_API_URL  = (id) => `https://api.jikan.moe/v4/characters/${id}/full`
const JIKAN_DELAY  = 1000  // Jikan API tiene rate limit de 3 req/seg

// ── Colores para consola ─────────────────────────────────────────
const C = {
    reset:  '\x1b[0m',
    green:  '\x1b[32m',
    yellow: '\x1b[33m',
    red:    '\x1b[31m',
    cyan:   '\x1b[36m',
    dim:    '\x1b[2m',
    bold:   '\x1b[1m',
}
const log = {
    ok:   (msg) => console.log(`${C.green}✓${C.reset} ${msg}`),
    skip: (msg) => console.log(`${C.yellow}↷${C.reset} ${msg}`),
    err:  (msg) => console.log(`${C.red}✗${C.reset} ${msg}`),
    info: (msg) => console.log(`${C.cyan}ℹ${C.reset} ${msg}`),
    dim:  (msg) => console.log(`${C.dim}${msg}${C.reset}`),
}

// ── Cargar base de datos actual para verificación de duplicados ─
log.info(`Cargando base de datos actual...`)
const existingRaw = fs.readFileSync(CHARS_PATH, 'utf-8')
const existingChars = JSON.parse(existingRaw.charCodeAt(0) === 0xFEFF ? existingRaw.slice(1) : existingRaw)

// Normalizar: quita tildes, lowercase, solo alfanumérico+espacios
const normalizeKey = (str) =>
    String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

// Invertir el orden de palabras: "Nico Robin" → "Robin Nico"
const reverseWords = (str) => str.split(' ').reverse().join(' ')

// Token-set de palabras de un nombre (para comparación sin importar orden)
const tokenSet = (str) => str.split(' ').filter(Boolean).sort().join(' ')

const existingNames   = new Set(existingChars.map(c => normalizeKey(c.name)))
const existingReversed = new Set(existingChars.map(c => reverseWords(normalizeKey(c.name))))
const existingTokens  = new Set(existingChars.map(c => tokenSet(normalizeKey(c.name))))
const existingAliases = new Set(
    existingChars.flatMap(c => {
        if (!c.aliases) return []
        if (Array.isArray(c.aliases)) return c.aliases.map(normalizeKey)
        if (typeof c.aliases === 'string' && c.aliases.trim()) return [normalizeKey(c.aliases)]
        return []
    })
)

log.info(`Base de datos: ${C.bold}${existingChars.length}${C.reset} personajes existentes`)

// ── Función de delay ─────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ── Función de progreso visual ───────────────────────────────────
function printProgress(collected, target, currentId, empty) {
    const pct = Math.floor((collected / target) * 100)
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5))
    process.stdout.write(
        `\r${C.cyan}[${bar}]${C.reset} ${collected}/${target} (${pct}%) | ID: ${currentId} | Empty: ${empty}  `
    )
}

// ── Función para mapear género de MAL → formato del bot ─────────
function mapGender(malGender) {
    if (!malGender) return 'desconocido'
    const g = malGender.toLowerCase()
    if (g === 'female') return 'Mujer'
    if (g === 'male') return 'Hombre'
    return 'desconocido'
}

// ── Función para obtener imagen de MAL ──────────────────────────
function getBestImage(malChar) {
    const imgs = malChar.images
    if (!imgs) return null

    // Intentar webp primero (mejor calidad), luego jpg
    const candidates = [
        imgs.webp?.image_url,
        imgs.jpg?.image_url,
        imgs.webp?.small_image_url,
        imgs.jpg?.small_image_url,
    ].filter(Boolean)

    return candidates[0] || null
}

// ── Función principal de scraping via Jikan API ──────────────────
async function fetchCharacterFromJikan(id) {
    // Usar /full para obtener campos anime y manga
    const url = MAL_API_URL(id)
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'ikai-bot-scraper/1.0 (WhatsApp Bot)',
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(15000)
        })

        if (res.status === 404) return { skip: true, reason: '404 - No existe' }
        if (res.status === 429) {
            log.err(`Rate limit alcanzado en ID ${id}, esperando 10s...`)
            await sleep(10000)
            return { retry: true }
        }
        if (!res.ok) return { skip: true, reason: `HTTP ${res.status}` }

        const json = await res.json()
        const data = json.data

        if (!data) return { skip: true, reason: 'Sin datos' }
        if (!data.name) return { skip: true, reason: 'Sin nombre' }

        // Solo queremos personajes de anime/manga (no "people")
        // El endpoint /full incluye los arrays anime y manga
        const hasAnime  = Array.isArray(data.anime) && data.anime.length > 0
        const hasManga  = Array.isArray(data.manga) && data.manga.length > 0

        if (!hasAnime && !hasManga) {
            return { skip: true, reason: 'Sin anime/manga asociado' }
        }

        // Obtener source: preferir anime
        let source = ''
        if (hasAnime) {
            source = data.anime[0]?.anime?.title || ''
        } else if (hasManga) {
            source = data.manga[0]?.manga?.title || ''
        }

        if (!source) return { skip: true, reason: 'Sin source' }

        // Obtener imagen
        const img = getBestImage(data)
        if (!img) return { skip: true, reason: 'Sin imagen' }

        // Obtener nicknames como aliases
        const aliases = (data.nicknames || []).filter(n => n && n.trim())

        return {
            ok: true,
            character: {
                malId: id,
                name: data.name.trim(),
                gender: mapGender(data.gender),
                source: source.trim(),
                img,
                aliases
            }
        }

    } catch (err) {
        if (err.name === 'TimeoutError') return { skip: true, reason: 'Timeout' }
        return { skip: true, reason: err.message }
    }
}

// ── Verificar si un personaje ya existe (verificación estricta) ──
function isExisting(char) {
    const nameKey     = normalizeKey(char.name)
    const nameRev     = reverseWords(nameKey)       // "robin nico" → "nico robin"
    const nameTokens  = tokenSet(nameKey)            // "nico robin" y "robin nico" → "nico robin"

    // 1. Nombre exacto
    if (existingNames.has(nameKey))
        return `nombre exacto "${char.name}" ya existe`

    // 2. Nombre con palabras invertidas (orden japonés vs occidental)
    if (existingNames.has(nameRev))
        return `nombre invertido "${reverseWords(char.name)}" ya existe`

    // 3. Mismo conjunto de tokens (sin importar orden)
    if (existingTokens.has(nameTokens))
        return `mismas palabras en diferente orden ("${char.name}")`

    // 4. Nombre aparece como alias existente
    if (existingAliases.has(nameKey))
        return `nombre "${char.name}" existe como alias`
    if (existingAliases.has(nameRev))
        return `nombre invertido "${reverseWords(char.name)}" existe como alias`

    // 5. Verificar aliases del personaje entrante
    for (const alias of char.aliases) {
        const aliasKey    = normalizeKey(alias)
        const aliasRev    = reverseWords(aliasKey)
        const aliasTokens = tokenSet(aliasKey)
        if (existingNames.has(aliasKey))   return `alias "${alias}" coincide con nombre existente`
        if (existingNames.has(aliasRev))   return `alias invertido "${alias}" coincide con nombre existente`
        if (existingTokens.has(aliasTokens)) return `alias "${alias}" (mismas palabras) coincide con nombre existente`
        if (existingAliases.has(aliasKey)) return `alias "${alias}" ya existe en otro personaje`
    }

    return null // no es duplicado
}

// ── Cargar progreso previo si existe ────────────────────────────
let collectedChars = []
let nextMalId = START_ID
let previouslyScraped = new Set()

if (RESUME && fs.existsSync(PROGRESS_FILE)) {
    try {
        const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
        collectedChars = progress.collected || []
        nextMalId = progress.nextId || START_ID
        previouslyScraped = new Set(progress.scraped || [])
        log.info(`Resumiendo desde ID ${nextMalId}, ${collectedChars.length} personajes ya recolectados`)
    } catch (e) {
        log.err(`No se pudo leer el progreso: ${e.message}`)
    }
}

// ── BUCLE PRINCIPAL ───────────────────────────────────────────────
log.info(`Iniciando scraping desde ID: ${C.bold}${nextMalId}${C.reset}`)
log.info(`Objetivo: ${C.bold}${BATCH_SIZE}${C.reset} personajes NUEVOS`)
log.info(`Output: ${C.dim}${OUT_FILE}${C.reset}`)
console.log()

let consecutiveEmpty = 0
let totalRequests = 0
let totalSkipped = 0
let totalDuplicates = 0

while (collectedChars.length < BATCH_SIZE && consecutiveEmpty < MAX_EMPTY) {
    const currentId = nextMalId

    printProgress(collectedChars.length, BATCH_SIZE, currentId, consecutiveEmpty)

    // Delay entre requests para no abusar de la API
    if (totalRequests > 0) {
        await sleep(Math.max(DELAY_MS, JIKAN_DELAY))
    }
    totalRequests++

    let result
    let retries = 0
    do {
        result = await fetchCharacterFromJikan(currentId)
        if (result.retry) {
            retries++
            await sleep(5000 * retries)
        }
    } while (result.retry && retries < 3)

    nextMalId++

    if (result.skip || result.retry) {
        consecutiveEmpty++
        totalSkipped++
        log.dim(`  ID ${currentId}: omitido (${result.reason || 'error'})`)
        continue
    }

    if (result.ok) {
        const char = result.character
        const dupReason = isExisting(char)

        if (dupReason) {
            consecutiveEmpty = 0 // sí existe, pero no está vacío
            totalDuplicates++
            log.skip(`  ID ${currentId}: "${char.name}" — ${dupReason}`)
            continue
        }

        // ¡Personaje nuevo!
        consecutiveEmpty = 0
        collectedChars.push({
            name: char.name,
            gender: char.gender,
            source: char.source,
            img: [char.img],
            vid: [],
            aliases: char.aliases.length ? char.aliases : '',
            malId: char.malId
        })

        // Agregar al índice local para evitar duplicados entre el mismo lote
        const nk = normalizeKey(char.name)
        existingNames.add(nk)
        existingReversed.add(reverseWords(nk))
        existingTokens.add(tokenSet(nk))
        for (const alias of char.aliases) {
            existingAliases.add(normalizeKey(alias))
        }

        log.ok(`  ID ${currentId}: "${char.name}" (${char.source}) — ${char.gender}`)

        // Guardar progreso cada 10 personajes
        if (collectedChars.length % 10 === 0) {
            saveProgress()
        }
    }
}

console.log() // nueva línea después del progress bar

// ── Guardar resultado final ──────────────────────────────────────
function saveProgress() {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
        collected: collectedChars,
        nextId: nextMalId,
        scraped: [...previouslyScraped, ...collectedChars.map(c => c.malId)]
    }, null, 2))
}

// Guardar el JSON final para import
fs.writeFileSync(OUT_FILE, JSON.stringify(collectedChars, null, 2))
log.ok(`Guardado: ${OUT_FILE}`)

// Limpiar archivo de progreso si terminó correctamente
if (fs.existsSync(PROGRESS_FILE) && collectedChars.length >= BATCH_SIZE) {
    fs.unlinkSync(PROGRESS_FILE)
}

// ── Resumen ──────────────────────────────────────────────────────
console.log()
console.log(`${C.bold}═══════════════════════════════════════${C.reset}`)
console.log(`${C.bold} RESUMEN DE SCRAPING${C.reset}`)
console.log(`${C.bold}═══════════════════════════════════════${C.reset}`)
console.log(`  IDs procesados:    ${totalRequests}`)
console.log(`  Personajes nuevos: ${C.green}${collectedChars.length}${C.reset}`)
console.log(`  Duplicados:        ${C.yellow}${totalDuplicates}${C.reset}`)
console.log(`  Omitidos/vacíos:   ${C.dim}${totalSkipped}${C.reset}`)
console.log(`  Último ID MAL:     ${nextMalId - 1}`)
console.log(`${C.bold}═══════════════════════════════════════${C.reset}`)

if (collectedChars.length === 0) {
    log.err('No se encontraron personajes nuevos en este rango.')
    process.exit(0)
}

// ── Importar automáticamente si se pidió ────────────────────────
if (DO_IMPORT) {
    console.log()
    log.info('Importando automáticamente con import-characters.js...')
    const fuzzyFlag = NO_FUZZY ? '--no-fuzzy' : ''
    try {
        const cmd = `node "${path.join(__dirname, 'import-characters.js')}" "${OUT_FILE}" --write ${fuzzyFlag}`
        const output = execSync(cmd, { cwd: rootDir, encoding: 'utf-8' })
        console.log(output)
        log.ok('¡Importación completada!')
    } catch (e) {
        log.err(`Error al importar: ${e.message}`)
    }
} else {
    console.log()
    log.info(`Para importar, ejecuta:`)
    console.log(`  ${C.cyan}node scripts/import-characters.js "${OUT_FILE}" --write${C.reset}`)
    log.info(`Para simular primero (sin escribir):`)
    console.log(`  ${C.cyan}node scripts/import-characters.js "${OUT_FILE}"${C.reset}`)
}
