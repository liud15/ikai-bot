import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '..')
const charactersPath = path.join(rootDir, 'src', 'database', 'characters.json')
const reportPath = path.join(rootDir, 'src', 'database', 'characters.import-report.json')

const args = process.argv.slice(2)
const inputArg = args.find(arg => !arg.startsWith('--'))
const shouldWrite = args.includes('--write')
const allowFuzzy = !args.includes('--no-fuzzy')
const fuzzyThreshold = Number(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1] || 0.8)

if (!inputArg) {
  console.error('Uso: node scripts/import-characters.js <archivo.json|archivo.csv> [--write] [--no-fuzzy] [--threshold=0.8]')
  process.exit(1)
}

const inputPath = path.resolve(inputArg)
const characters = JSON.parse(fs.readFileSync(charactersPath, 'utf8'))
const incoming = readIncoming(inputPath)
const existingIndex = buildExistingIndex(characters)
let nextId = getNextId(characters)

const added = []
const skipped = []
const warnings = []

for (const raw of incoming) {
  const char = normalizeIncoming(raw)
  const problems = validateCharacter(char)

  if (problems.length) {
    skipped.push({ input: raw, reason: 'invalid', problems })
    continue
  }

  const duplicate = findDuplicate(char, existingIndex, allowFuzzy, fuzzyThreshold)
  if (duplicate) {
    skipped.push({ input: raw, normalized: char, reason: 'duplicate', duplicate })
    continue
  }

  const newChar = {
    id: String(nextId++),
    name: char.name,
    gender: char.gender,
    value: char.value,
    source: char.source,
    img: char.img,
    vid: char.vid,
    user: null,
    status: 'Libre',
    votes: 0,
    aliases: char.aliases
  }

  added.push(newChar)
  addToIndex(newChar, existingIndex)
}

const report = {
  input: inputPath,
  write: shouldWrite,
  fuzzy: allowFuzzy,
  fuzzyThreshold,
  existingBefore: characters.length,
  incoming: incoming.length,
  added: added.length,
  skipped: skipped.length,
  nextIdAfterImport: String(nextId),
  addedCharacters: added,
  skippedCharacters: skipped,
  warnings
}

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')

if (shouldWrite && added.length) {
  const updated = characters.concat(added)
  fs.writeFileSync(charactersPath, JSON.stringify(updated, null, 2) + '\n')
}

console.log(`Existentes: ${characters.length}`)
console.log(`Entrada: ${incoming.length}`)
console.log(`Agregados: ${added.length}`)
console.log(`Omitidos: ${skipped.length}`)
console.log(`Reporte: ${reportPath}`)
if (!shouldWrite) console.log('Simulacion completa. Usa --write para modificar characters.json.')

function readIncoming(file) {
  const text = fs.readFileSync(file, 'utf8')
  if (file.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error('El JSON de entrada debe ser un array de personajes.')
    return parsed
  }
  if (file.toLowerCase().endsWith('.csv')) return parseCsv(text)
  throw new Error('Formato no soportado. Usa .json o .csv.')
}

function normalizeIncoming(raw) {
  const name = pick(raw, ['name', 'nombre'])
  const gender = pick(raw, ['gender', 'genero', 'género']) || 'desconocido'
  const source = pick(raw, ['source', 'anime', 'serie', 'origen'])
  const value = pick(raw, ['value', 'valor']) || String(randomValue())
  const img = normalizeList(pick(raw, ['img', 'image', 'images', 'imagen', 'imagenes', 'imágenes']))
  const vid = normalizeList(pick(raw, ['vid', 'video', 'videos']))
  const aliases = normalizeAliases(pick(raw, ['aliases', 'alias', 'apodos', 'keyword', 'tag']))

  return {
    name: cleanText(name),
    gender: normalizeGender(gender),
    value: String(value).replace(/[^\d]/g, '') || String(randomValue()),
    source: cleanText(source),
    img,
    vid,
    aliases
  }
}

function validateCharacter(char) {
  const problems = []
  if (!char.name) problems.push('missing_name')
  if (!char.source) problems.push('missing_source')
  if (!['Mujer', 'Hombre', 'Desconocido'].includes(char.gender)) problems.push('invalid_gender')
  if (!Array.isArray(char.img)) problems.push('invalid_img')
  if (!Array.isArray(char.vid)) problems.push('invalid_vid')
  return problems
}

function buildExistingIndex(chars) {
  const index = { names: new Map(), aliases: new Map(), nameSource: new Map(), allKeys: [] }
  for (const char of chars) addToIndex(char, index)
  return index
}

function addToIndex(char, index) {
  const nameKey = key(char.name)
  const sourceKey = key(char.source)
  if (nameKey) index.names.set(nameKey, slim(char))
  if (nameKey && sourceKey) index.nameSource.set(`${nameKey}|${sourceKey}`, slim(char))
  for (const alias of getAliases(char)) {
    const aliasKey = key(alias)
    if (aliasKey) index.aliases.set(aliasKey, slim(char))
  }
  if (nameKey) index.allKeys.push({ key: nameKey, type: 'name', char: slim(char) })
  for (const alias of getAliases(char)) {
    const aliasKey = key(alias)
    if (aliasKey) index.allKeys.push({ key: aliasKey, type: 'alias', char: slim(char) })
  }
}

function findDuplicate(char, index, fuzzy, threshold) {
  const nameKey = key(char.name)
  const sourceKey = key(char.source)
  const sameNameSource = index.nameSource.get(`${nameKey}|${sourceKey}`)
  if (sameNameSource) return { type: 'same_name_source', match: sameNameSource }

  const sameName = index.names.get(nameKey)
  if (sameName) return { type: 'same_name', match: sameName }

  for (const alias of char.aliases) {
    const aliasHit = index.aliases.get(key(alias))
    if (aliasHit) return { type: 'same_alias', alias, match: aliasHit }
  }

  if (fuzzy && nameKey) {
    let best = null
    for (const item of index.allKeys) {
      const score = similarity(nameKey, item.key)
      if (score >= threshold && (!best || score > best.score)) {
        best = { type: `fuzzy_${item.type}`, score, match: item.char }
      }
    }
    if (best) return best
  }

  return null
}

function getAliases(char) {
  if (!char.aliases) return []
  if (Array.isArray(char.aliases)) return char.aliases.filter(Boolean).map(String)
  if (typeof char.aliases === 'string' && char.aliases.trim()) return [char.aliases.trim()]
  return []
}

function normalizeAliases(value) {
  const list = normalizeList(value).map(cleanText).filter(Boolean)
  return list.length ? [...new Set(list)] : ''
}

function normalizeList(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean)
  return String(value).split(/[;,]/).map(s => s.trim()).filter(Boolean)
}

function normalizeGender(value) {
  const gender = key(value)
  if (['mujer', 'female', 'femenino', 'waifu'].includes(gender)) return 'Mujer'
  if (['hombre', 'male', 'masculino', 'husbando'].includes(gender)) return 'Hombre'
  return 'Desconocido'
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
  }
  return ''
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function key(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function slim(char) {
  return { id: String(char.id), name: char.name, source: char.source }
}

function getNextId(chars) {
  const max = chars.reduce((highest, char) => {
    const id = Number(char.id)
    return Number.isFinite(id) && id > highest ? id : highest
  }, 0)
  return max + 1
}

function randomValue() {
  return Math.floor(Math.random() * 4500) + 500
}

function parseCsv(text) {
  const rows = []
  let row = []
  let current = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"' && quoted && next === '"') {
      current += '"'
      i++
    } else if (ch === '"') {
      quoted = !quoted
    } else if (ch === ',' && !quoted) {
      row.push(current)
      current = ''
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++
      row.push(current)
      if (row.some(cell => cell.trim())) rows.push(row)
      row = []
      current = ''
    } else {
      current += ch
    }
  }

  row.push(current)
  if (row.some(cell => cell.trim())) rows.push(row)
  if (!rows.length) return []

  const headers = rows.shift().map(h => h.trim())
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] || ''])))
}

function similarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return 1 - dp[m][n] / Math.max(m, n)
}
