import { existsSync, mkdirSync, statfsSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

// ── Directorios temporales del bot ─────────────────────────────────────────
//
// AMBOS directorios van al DISCO para evitar ENOSPC con archivos grandes.
// El bot maneja videos de hasta 1 GB — el tmpfs (RAM) no puede contenerlos.
//
//   • botTmpDir   (cwd/tmp)        → temporales generales del bot
//   • botMediaDir (cwd/tmp-media)  → videos y archivos grandes
//
// Se puede sobreescribir con variables de entorno:
//   IKAI_TMP_DIR    → carpeta temporal general
//   IKAI_MEDIA_DIR  → carpeta para archivos grandes
//   IKAI_LARGE_MB   → umbral MB para tmpPathFor() (default: 50)

// ─── Carpeta temporal general (en disco) ───────────────────────────────────
const defaultTmpDir = process.platform === 'win32'
  ? join(process.cwd(), 'tmp')
  : join(process.cwd(), 'tmp')   // Linux: disco del proyecto ✓
export const botTmpDir = resolve(process.env.IKAI_TMP_DIR || process.env.BOT_TMP_DIR || defaultTmpDir)

// ─── Carpeta para archivos grandes (videos, etc.) ──────────────────────────
const defaultMediaDir = join(process.cwd(), 'tmp-media')
export const botMediaDir = resolve(process.env.IKAI_MEDIA_DIR || defaultMediaDir)

// ─── Umbral en MB para tmpPathFor() ────────────────────────────────────────
export const LARGE_FILE_MB = parseInt(process.env.IKAI_LARGE_MB || '50')

// Informativo: indica si el SO usa tmpfs en /tmp (solo para logs)
export const tmpIsRam = false  // desactivado — usamos disco para seguridad



process.env.IKAI_TMP_DIR   = botTmpDir
process.env.IKAI_MEDIA_DIR = botMediaDir
process.env.BOT_TMP_DIR    = botTmpDir
process.env.TMPDIR         = botTmpDir
process.env.TMP            = botTmpDir
process.env.TEMP           = botTmpDir

// Crear ambas carpetas si no existen
if (!existsSync(botTmpDir))   mkdirSync(botTmpDir,   { recursive: true })
if (!existsSync(botMediaDir)) mkdirSync(botMediaDir, { recursive: true })

/**
 * Ruta en RAM (para archivos pequeños: stickers, thumbs, imágenes, audios cortos)
 */
export function tmpPath(...parts) {
  return join(botTmpDir, ...parts)
}

/**
 * Ruta en DISCO (para archivos grandes: videos de anime, música, documentos)
 */
export function mediaTmpPath(...parts) {
  return join(botMediaDir, ...parts)
}

/**
 * Elige automáticamente RAM o DISCO según el tamaño estimado del archivo.
 * @param {number} estimatedMB  - tamaño estimado en MB (usa 0 si no se sabe)
 * @param {...string} parts     - partes del nombre de archivo
 * @returns {string}            - ruta completa en la carpeta adecuada
 */
export function tmpPathFor(estimatedMB = 0, ...parts) {
  const useMedia = estimatedMB > LARGE_FILE_MB
  return join(useMedia ? botMediaDir : botTmpDir, ...parts)
}


export function getPathSpace(path = botTmpDir) {
  const stats = statfsSync(path)
  return {
    path,
    freeBytes: Number(stats.bavail) * Number(stats.bsize),
    totalBytes: Number(stats.blocks) * Number(stats.bsize)
  }
}

export function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}
