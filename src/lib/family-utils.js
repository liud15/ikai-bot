// ── Constantes ──────────────────────────────────────────────
export const FAMILY_DAILY_CD = 24 * 60 * 60 * 1000   // 24h
export const REQUEST_TTL = 5 * 60 * 1000          // 5 min — las solicitudes expiran
export const MAX_PARENTS = 2
export const MAX_CHILDREN = 5

// Almacén global de solicitudes pendientes
export function getFamilyRequests() {
    if (!global.familyRequests) {
        global.familyRequests = { couple: {}, adoption: {} }
    }
    return global.familyRequests
}

// ── Helpers ─────────────────────────────────────────────────

/** Devuelve siempre el JID real (no LID) */
export function getRealJid(jidRaw) {
    if (!jidRaw) return null
    if (jidRaw.endsWith('@lid')) return jidRaw
    return `${global.getJidNum ? global.getJidNum(jidRaw) : jidRaw.split('@')[0]}@s.whatsapp.net`
}

/** Resuelve asíncronamente el LID a PN JID (Número de teléfono real) */
export async function resolveJid(jid, m) {
    if (!jid) return null;
    let realJid = getRealJid(jid);
    
    if (!realJid.includes('@lid')) return realJid;
    
    // Búsqueda rápida en cache
    if (global.db?.data?.lidmap?.[realJid]) {
        return global.db.data.lidmap[realJid];
    }

    // Fallback asíncrono
    if (m && global.conn && m.chat?.endsWith('@g.us')) {
        if (typeof String.prototype.resolveLidToRealJid === 'function') {
            try {
                realJid = await String.prototype.resolveLidToRealJid.call(realJid, m.chat, global.conn);
            } catch(e) {}
        }
    }
    return realJid;
}

/** Asegura que el objeto usuario tenga todas las propiedades de familia */
export function ensureUser(user) {
    if (!user) return
    user.coin = Number.isFinite(user.coin) ? user.coin : 0
    user.marry = typeof user.marry === 'string' ? user.marry : ''
    user.parents = Array.isArray(user.parents) ? user.parents : []
    user.children = Array.isArray(user.children) ? user.children : []
    user.lastFamilyClaim = Number.isFinite(user.lastFamilyClaim) ? user.lastFamilyClaim : 0
}

export async function mention(jid, m) {
    if (!jid) return '@Usuario';
    const resolvedJid = await resolveJid(jid, m);
    
    // Si se resolvió exitosamente a un PN (Phone Number), devolvemos @PN
    if (resolvedJid && !resolvedJid.includes('@lid')) {
        return `@${resolvedJid.split('@')[0]}`;
    }
    
    // Si sigue siendo LID o falló la resolución, usamos los fallbacks:
    const realJid = getRealJid(jid)
    const dbUser = global.db.data.users[realJid]
    
    let dbName = dbUser && dbUser.name ? dbUser.name.toString() : '';
    if (dbName && !/^\d{14,}$/.test(dbName)) {
        return `@${dbName}`
    }
    
    if (global.conn && typeof global.conn.getName === 'function') {
        try {
            const connName = await global.conn.getName(jid)
            if (connName && typeof connName === 'string' && !connName.startsWith('+') && !/^\d{10,}$/.test(connName.replace(/\D/g, ''))) {
                return `@${connName}`
            }
        } catch(e) {}
    }
    
    return `@Usuario`
}

export function msToText(ms) {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${s}s`
}

export function uniqueJids(list = []) {
    return [...new Set(list.filter(Boolean))]
}

/** Obtiene un usuario de la DB, creándolo si no existe */
export function getUser(jidRaw) {
    const jid = getRealJid(jidRaw)
    if (!global.db.data.users[jid]) global.db.data.users[jid] = {}
    const u = global.db.data.users[jid]
    ensureUser(u)
    return u
}

// ── Relaciones: vincular / desvincular ──────────────────────

/** Empareja a dos personas (solo matrimonio) */
export function linkCouple(jidA, jidB) {
    const aJid = getRealJid(jidA)
    const bJid = getRealJid(jidB)
    const a = getUser(aJid)
    const b = getUser(bJid)
    a.marry = bJid
    b.marry = aJid
}

/** Desvincula SOLO el matrimonio, sin tocar padres/hijos */
export function unlinkCouple(jidRaw) {
    const jid = getRealJid(jidRaw)
    const a = getUser(jid)
    if (!a.marry) return null
    const exJid = getRealJid(a.marry)
    const b = getUser(exJid)
    if (getRealJid(b.marry) === jid) b.marry = ''
    a.marry = ''
    return exJid
}

/** Crea un vínculo padre → hijo */
export function linkParentChild(parentJid, childJid) {
    const pJid = getRealJid(parentJid)
    const cJid = getRealJid(childJid)
    const parent = getUser(pJid)
    const child = getUser(cJid)
    if (!parent.children.includes(cJid)) parent.children.push(cJid)
    if (!child.parents.includes(pJid)) child.parents.push(pJid)
    // Garantizar máximo de padres
    if (child.parents.length > MAX_PARENTS) child.parents = child.parents.slice(0, MAX_PARENTS)
}

/** Desvincula un hijo de un padre específico */
export function unlinkParentChild(parentJid, childJid) {
    const pJid = getRealJid(parentJid)
    const cJid = getRealJid(childJid)
    const parent = getUser(pJid)
    const child = getUser(cJid)
    parent.children = parent.children.filter(c => getRealJid(c) !== cJid)
    child.parents = child.parents.filter(p => getRealJid(p) !== pJid)
}

// ── Validaciones de adopción ────────────────────────────────

export function validateAdoption(parentJid, childJid) {
    const pJid = getRealJid(parentJid)
    const cJid = getRealJid(childJid)

    const parent = getUser(pJid)
    const child = getUser(cJid)

    if (pJid === cJid)
        return '❌ No puedes adoptarte a ti mismo.'

    if (child.parents.length >= MAX_PARENTS)
        return `❌ Esa persona ya tiene ${MAX_PARENTS} padres registrados.`

    if (parent.children.includes(cJid))
        return '✅ Ya forma parte de tus hijos.'

    if (parent.children.length >= MAX_CHILDREN)
        return `❌ Ya tienes el máximo de ${MAX_CHILDREN} hijos.`

    // No adoptar a tu pareja
    if (getRealJid(parent.marry) === cJid)
        return '❌ No puedes adoptar a tu propia pareja.'

    // No adoptar a tu padre/madre
    if (parent.parents.includes(cJid))
        return '❌ No puedes adoptar a tu propio padre/madre.'

    // No crear ciclos — el hijo ya es "ancestro" del padre
    if (child.children.includes(pJid))
        return '❌ No puedes adoptar a alguien que ya es tu padre/madre adoptivo.'

    return null // sin errores
}

// ── Búsqueda de Familia Extendida ───────────────────────────

export function getGrandparents(targetJid) {
    const jid = getRealJid(targetJid)
    const user = getUser(jid)
    const grandparents = []
    for (const parentJid of user.parents) {
        const parent = getUser(parentJid)
        grandparents.push(...parent.parents)
    }
    return uniqueJids(grandparents)
}

export function getGrandchildren(targetJid) {
    const jid = getRealJid(targetJid)
    const user = getUser(jid)
    const grandchildren = []
    for (const childJid of user.children) {
        const child = getUser(childJid)
        grandchildren.push(...child.children)
    }
    return uniqueJids(grandchildren)
}

export function getSiblings(targetJid) {
    const jid = getRealJid(targetJid)
    const user = getUser(jid)
    const siblings = []
    for (const parentJid of user.parents) {
        const parent = getUser(parentJid)
        siblings.push(...parent.children.filter(c => getRealJid(c) !== jid))
    }
    return uniqueJids(siblings)
}

export function getUnclesAunts(targetJid) {
    const jid = getRealJid(targetJid)
    const user = getUser(jid)
    const unclesAunts = []
    for (const parentJid of user.parents) {
        // Los hermanos de mis padres son mis tíos
        const parentSiblings = getSiblings(parentJid)
        unclesAunts.push(...parentSiblings)
    }
    return uniqueJids(unclesAunts)
}

// ── Solicitudes con TTL ─────────────────────────────────────

export function getRequest(type, targetJid) {
    const jid = getRealJid(targetJid)
    const reqs = getFamilyRequests()
    const req = reqs[type]?.[jid]
    if (!req) return null
    // Verificar expiración
    if (Date.now() - req.at > REQUEST_TTL) {
        delete reqs[type][jid]
        return null
    }
    return req
}

export function setRequest(type, targetJid, fromJid) {
    const tJid = getRealJid(targetJid)
    const fJid = getRealJid(fromJid)
    const reqs = getFamilyRequests()
    reqs[type][tJid] = { from: fJid, at: Date.now() }
}

export function deleteRequest(type, targetJid) {
    const jid = getRealJid(targetJid)
    const reqs = getFamilyRequests()
    if (reqs[type]) delete reqs[type][jid]
}

// ── Herencia ────────────────────────────────────────────────

export function distributeInheritance(userJid) {
    const jid = getRealJid(userJid)
    const users = global.db.data.users
    const user = getUser(jid)

    const recipients = []
    if (user.marry && users[user.marry]) recipients.push(user.marry)
    recipients.push(...(user.children || []).filter(c => users[c]))
    const targets = uniqueJids(recipients.map(getRealJid)).filter(t => t !== jid)

    if (!targets.length || user.coin <= 0) return { amount: 0, distributed: [] }

    const total = user.coin
    const base = Math.floor(total / targets.length)
    let left = total % targets.length

    for (const target of targets) {
        const t = getUser(target)
        const extra = left > 0 ? 1 : 0
        if (left > 0) left -= 1
        t.coin += base + extra
    }

    user.coin = 0
    return { amount: total, distributed: targets }
}

/** Elimina TODOS los vínculos familiares de un usuario (para cuando sale del grupo) */
export function removeAllFamilyLinks(userJid) {
    const jid = getRealJid(userJid)
    const user = getUser(jid)

    // Deshacer matrimonio
    unlinkCouple(jid)

    // Deshacer vínculos con padres
    for (const p of [...user.parents]) {
        unlinkParentChild(p, jid)
    }

    // Deshacer vínculos con hijos
    for (const c of [...user.children]) {
        unlinkParentChild(jid, c)
    }
}

// ── Family Top ──────────────────────────────────────────────

export function familyGroupTop(participants) {
    const users = global.db.data.users
    const memberIds = new Set(participants.map(p => getRealJid(p.id)))
    const processed = new Set()
    const results = []

    for (const jid of memberIds) {
        if (processed.has(jid)) continue
        const u = users[jid]
        if (!u) continue
        ensureUser(u)

        // Agrupar por pareja
        const group = new Set([jid])
        processed.add(jid)

        const partnerJid = getRealJid(u.marry)
        if (partnerJid && memberIds.has(partnerJid) && !processed.has(partnerJid)) {
            group.add(partnerJid)
            processed.add(partnerJid)
        }

        // Agregar hijos que estén en el grupo
        for (const member of [...group]) {
            const mu = users[member]
            if (!mu) continue
            ensureUser(mu)
            for (const childRaw of mu.children) {
                const child = getRealJid(childRaw)
                if (memberIds.has(child) && !processed.has(child)) {
                    group.add(child)
                    processed.add(child)
                }
            }
        }

        // Calcular puntaje
        let total = 0
        for (const member of group) {
            const mu = users[member]
            if (!mu) continue
            ensureUser(mu)
            total += mu.coin
        }
        // Bonos (una sola vez por grupo, no por miembro)
        const members = [...group]
        const hasCouple = members.some(m => {
            const mu = users[m]
            const pm = getRealJid(mu?.marry)
            return pm && group.has(pm)
        })
        if (hasCouple) total += 120

        // Contar hijos que están dentro del grupo
        const childCount = members.reduce((acc, m) => {
            const mu = users[m]
            if (!mu) return acc
            return acc + (mu.children || []).map(getRealJid).filter(c => group.has(c)).length
        }, 0)
        total += Math.floor(childCount / 2) * 60 // evitar doble-conteo padre↔hijo

        results.push({ members, total })
    }

    return results
        .filter(g => g.members.length > 1) // solo familias de ≥2
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
}
