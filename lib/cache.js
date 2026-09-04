/**
 * lib/cache.js — Sistema de caché unificado con Redis + fallback a node-cache
 *
 * Estrategia:
 *   1. Intenta conectarse a Redis (localhost:6379) al arrancar.
 *   2. Si Redis no está disponible → usa node-cache en RAM (comportamiento anterior).
 *   3. La API es idéntica en ambos casos: get / set / del / flush / has
 *
 * Uso:
 *   import { botCache } from './lib/cache.js'
 *   await botCache.set('clave', valor, 300)   // TTL en segundos (opcional)
 *   const val = await botCache.get('clave')   // null si no existe
 *   await botCache.del('clave')
 *   const existe = await botCache.has('clave')
 *   await botCache.flush()                    // borrar todo
 */

import NodeCache from 'node-cache'

// ── Configuración ────────────────────────────────────────────────────────────
const REDIS_HOST    = process.env.REDIS_HOST     || '127.0.0.1'
const REDIS_PORT    = parseInt(process.env.REDIS_PORT || '6379')
const REDIS_TTL     = parseInt(process.env.REDIS_TTL  || '3600')   // 1h por defecto
const CACHE_PREFIX  = process.env.CACHE_PREFIX    || 'ikai:'

// ── Fallback (node-cache en RAM) ──────────────────────────────────────────────
const localCache = new NodeCache({ stdTTL: REDIS_TTL, useClones: false, checkperiod: 120 })

// ── Intento de conexión a Redis ───────────────────────────────────────────────
let redisClient = null
let usingRedis  = false

async function tryConnectRedis() {
  try {
    // Importación dinámica: no falla si ioredis no está instalado
    const { default: Redis } = await import('ioredis').catch(() => ({ default: null }))
    if (!Redis) {
      console.log('[Cache] ioredis no instalado — usando node-cache en RAM')
      return
    }

    const client = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })

    await client.connect()
    await client.ping()

    redisClient = client
    usingRedis  = true

    client.on('error', (err) => {
      if (usingRedis) {
        console.warn('[Cache] Redis error — fallback a node-cache:', err.message)
        usingRedis = false
      }
    })

    client.on('reconnecting', () => {
      console.log('[Cache] Redis reconectando...')
    })

    client.on('ready', () => {
      if (!usingRedis) {
        console.log('[Cache] Redis reconectado ✓')
        usingRedis = true
      }
    })

    console.log(`[Cache] ✅ Redis conectado en ${REDIS_HOST}:${REDIS_PORT} — caché en RAM (Redis)`)
  } catch (e) {
    console.log(`[Cache] Redis no disponible (${e.message}) — usando node-cache en RAM`)
    usingRedis = false
  }
}

// Conectar al inicio (sin bloquear el arranque del bot)
tryConnectRedis().catch(() => {})

// ── API pública ───────────────────────────────────────────────────────────────
function _key(k) { return `${CACHE_PREFIX}${k}` }

export const botCache = {
  /** Retorna el valor cacheado, o null si no existe / expiró */
  async get(key) {
    const k = _key(key)
    if (usingRedis && redisClient) {
      try {
        const raw = await redisClient.get(k)
        if (raw === null) return null
        try { return JSON.parse(raw) } catch { return raw }
      } catch {
        // Redis falló en esta operación → usar localCache
      }
    }
    const val = localCache.get(k)
    return val === undefined ? null : val
  },

  /** Guarda un valor. ttl en segundos (0 = sin expiración) */
  async set(key, value, ttl = REDIS_TTL) {
    const k = _key(key)
    if (usingRedis && redisClient) {
      try {
        const raw = JSON.stringify(value)
        if (ttl > 0) await redisClient.setex(k, ttl, raw)
        else          await redisClient.set(k, raw)
        return true
      } catch {
        // Redis falló → guardar también en localCache como respaldo
      }
    }
    return localCache.set(k, value, ttl)
  },

  /** Elimina una clave */
  async del(key) {
    const k = _key(key)
    if (usingRedis && redisClient) {
      try { await redisClient.del(k); return true } catch {}
    }
    return localCache.del(k)
  },

  /** Comprueba si una clave existe y no ha expirado */
  async has(key) {
    const val = await botCache.get(key)
    return val !== null
  },

  /** Borra todas las claves con el prefijo del bot */
  async flush() {
    if (usingRedis && redisClient) {
      try {
        const keys = await redisClient.keys(`${CACHE_PREFIX}*`)
        if (keys.length) await redisClient.del(...keys)
        return true
      } catch {}
    }
    localCache.flushAll()
    return true
  },

  /** Informa si Redis está activo */
  get isRedisActive() { return usingRedis },

  /** Expone el cliente Redis crudo para operaciones avanzadas */
  get redis() { return redisClient },
}

export default botCache
