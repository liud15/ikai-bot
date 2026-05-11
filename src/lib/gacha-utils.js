/**
 * Utilidades compartidas para el sistema gacha
 * - Similitud de cadenas (Levenshtein normalizado)
 * - Búsqueda de personajes por ID o nombre con fuzzy matching
 */

/**
 * Calcula la distancia de Levenshtein entre dos cadenas
 */
function levenshtein(a, b) {
    const m = a.length, n = b.length
    if (m === 0) return n
    if (n === 0) return m

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            )
        }
    }
    return dp[m][n]
}

/**
 * Calcula la similitud entre dos cadenas (0.0 a 1.0)
 * 1.0 = idénticas, 0.0 = completamente diferentes
 */
export function similarity(a, b) {
    if (!a || !b) return 0
    const la = a.toLowerCase().trim()
    const lb = b.toLowerCase().trim()
    if (la === lb) return 1.0
    const maxLen = Math.max(la.length, lb.length)
    if (maxLen === 0) return 1.0
    return 1 - levenshtein(la, lb) / maxLen
}

/**
 * Normaliza los aliases de un personaje (pueden ser string vacío, string, o array)
 */
function getAliases(char) {
    if (!char.aliases) return []
    if (Array.isArray(char.aliases)) return char.aliases.filter(a => a && typeof a === 'string')
    if (typeof char.aliases === 'string' && char.aliases.trim()) return [char.aliases]
    return []
}

/**
 * Busca un personaje por ID o nombre con fuzzy matching
 * 
 * Orden de búsqueda:
 * 1. ID exacto
 * 2. Nombre exacto (case-insensitive)
 * 3. Alias exacto (case-insensitive)
 * 4. Nombre parcial (includes)
 * 5. Alias parcial (includes)
 * 6. Similitud >= threshold en nombre
 * 7. Similitud >= threshold en alias
 * 
 * @param {Array} characters - Array de personajes de characters.json
 * @param {string} input - ID o nombre a buscar
 * @param {number} threshold - Umbral de similitud (default: 0.9 = 90%)
 * @returns {{ char: object|null, method: string, similarity: number }}
 */
export function resolveCharacter(characters, input, threshold = 0.9) {
    if (!input || !characters || !characters.length) {
        return { char: null, method: 'none', similarity: 0 }
    }

    const query = input.trim()
    const queryLower = query.toLowerCase()

    // 1. ID exacto
    const byId = characters.find(c => String(c.id) === query)
    if (byId) return { char: byId, method: 'id', similarity: 1.0 }

    // 2. Nombre exacto
    const byExactName = characters.find(c => c.name && c.name.toLowerCase() === queryLower)
    if (byExactName) return { char: byExactName, method: 'exact_name', similarity: 1.0 }

    // 3. Alias exacto
    const byExactAlias = characters.find(c => {
        return getAliases(c).some(a => a.toLowerCase() === queryLower)
    })
    if (byExactAlias) return { char: byExactAlias, method: 'exact_alias', similarity: 1.0 }

    // 4. Nombre parcial (includes)
    const byPartialName = characters.find(c => c.name && c.name.toLowerCase().includes(queryLower))
    if (byPartialName) return { char: byPartialName, method: 'partial_name', similarity: 0.95 }

    // 5. Alias parcial (includes)
    const byPartialAlias = characters.find(c => {
        return getAliases(c).some(a => a.toLowerCase().includes(queryLower))
    })
    if (byPartialAlias) return { char: byPartialAlias, method: 'partial_alias', similarity: 0.95 }

    // 6. Fuzzy match en nombre (similitud >= threshold)
    let bestMatch = null
    let bestSim = 0

    for (const c of characters) {
        if (!c.name) continue
        const sim = similarity(queryLower, c.name.toLowerCase())
        if (sim >= threshold && sim > bestSim) {
            bestSim = sim
            bestMatch = c
        }
    }

    if (bestMatch) return { char: bestMatch, method: 'fuzzy_name', similarity: bestSim }

    // 7. Fuzzy match en aliases (similitud >= threshold)
    bestMatch = null
    bestSim = 0

    for (const c of characters) {
        for (const alias of getAliases(c)) {
            const sim = similarity(queryLower, alias.toLowerCase())
            if (sim >= threshold && sim > bestSim) {
                bestSim = sim
                bestMatch = c
            }
        }
    }

    if (bestMatch) return { char: bestMatch, method: 'fuzzy_alias', similarity: bestSim }

    return { char: null, method: 'not_found', similarity: 0 }
}

/**
 * Busca múltiples personajes que coincidan (para búsqueda/search)
 * Similar a resolveCharacter pero retorna array de resultados
 * 
 * @param {Array} characters
 * @param {string} query
 * @param {number} threshold - Umbral de similitud fuzzy (default: 0.9)
 * @param {number} limit - Máximo de resultados (default: 15)
 * @returns {Array<{ char: object, method: string, similarity: number }>}
 */
export function searchCharacters(characters, query, threshold = 0.9, limit = 15) {
    if (!query || !characters || !characters.length) return []

    const queryLower = query.trim().toLowerCase()
    const results = []
    const seen = new Set()

    function addResult(char, method, sim) {
        if (!seen.has(String(char.id))) {
            seen.add(String(char.id))
            results.push({ char, method, similarity: sim })
        }
    }

    // 1. Nombre exacto
    for (const c of characters) {
        if (c.name && c.name.toLowerCase() === queryLower) addResult(c, 'exact_name', 1.0)
    }

    // 2. Alias exacto
    for (const c of characters) {
        for (const alias of getAliases(c)) {
            if (alias.toLowerCase() === queryLower) addResult(c, 'exact_alias', 1.0)
        }
    }

    // 3. Nombre parcial
    for (const c of characters) {
        if (c.name && c.name.toLowerCase().includes(queryLower)) addResult(c, 'partial_name', 0.95)
    }

    // 4. Alias parcial
    for (const c of characters) {
        for (const alias of getAliases(c)) {
            if (alias.toLowerCase().includes(queryLower)) addResult(c, 'partial_alias', 0.95)
        }
    }

    // 5. Source parcial
    for (const c of characters) {
        if (c.source && c.source.toLowerCase().includes(queryLower)) addResult(c, 'source', 0.9)
    }

    // 6. Fuzzy match (si no hay suficientes resultados)
    if (results.length < 3) {
        const fuzzyResults = []
        for (const c of characters) {
            if (seen.has(String(c.id))) continue
            let bestSim = 0

            if (c.name) {
                bestSim = Math.max(bestSim, similarity(queryLower, c.name.toLowerCase()))
            }
            for (const alias of getAliases(c)) {
                bestSim = Math.max(bestSim, similarity(queryLower, alias.toLowerCase()))
            }

            if (bestSim >= threshold) {
                fuzzyResults.push({ char: c, method: 'fuzzy', similarity: bestSim })
            }
        }

        // Ordenar fuzzy por similitud descendente
        fuzzyResults.sort((a, b) => b.similarity - a.similarity)
        for (const r of fuzzyResults) {
            addResult(r.char, r.method, r.similarity)
        }
    }

    return results.slice(0, limit)
}

/**
 * Resuelve un charId buscando en los claimed del chat
 * Útil para plugins que operan sobre personajes del harem del usuario
 * Busca primero por ID directo en claimed, luego por nombre fuzzy en characters
 * y verifica que el personaje encontrado esté en claimed
 * 
 * @param {object} claimed - chat.gacha.claimed
 * @param {Array} characters - Array de personajes
 * @param {string} input - ID o nombre
 * @param {string} ownerJid - JID del dueño (para verificar propiedad)
 * @returns {{ charId: string|null, char: object|null, owned: boolean, method: string }}
 */
export function resolveClaimedChar(claimed, characters, input, ownerJid) {
    if (!input) return { charId: null, char: null, owned: false, method: 'none' }

    const query = input.trim()

    // 1. Buscar directamente por ID en claimed
    if (claimed[query]) {
        const char = characters.find(c => String(c.id) === query)
        const owned = claimed[query].owner === ownerJid
        return { charId: query, char: char || null, owned, method: 'id' }
    }

    // 2. Buscar por nombre/fuzzy en characters y ver si está claimed
    const result = resolveCharacter(characters, query)
    if (result.char) {
        const charId = String(result.char.id)
        if (claimed[charId]) {
            const owned = claimed[charId].owner === ownerJid
            return { charId, char: result.char, owned, method: result.method }
        }
        // Personaje existe pero no está claimed
        return { charId, char: result.char, owned: false, method: result.method }
    }

    return { charId: null, char: null, owned: false, method: 'not_found' }
}
