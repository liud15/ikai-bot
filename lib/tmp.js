import { existsSync, mkdirSync, statfsSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const defaultTmpDir = process.platform === 'win32' ? join(tmpdir(), 'ikai-bot') : '/tmp/ikai-bot'

export const botTmpDir = resolve(process.env.IKAI_TMP_DIR || process.env.BOT_TMP_DIR || defaultTmpDir)

process.env.IKAI_TMP_DIR = botTmpDir
process.env.BOT_TMP_DIR = botTmpDir
process.env.TMPDIR = botTmpDir
process.env.TMP = botTmpDir
process.env.TEMP = botTmpDir

if (!existsSync(botTmpDir)) mkdirSync(botTmpDir, { recursive: true })

export function tmpPath(...parts) {
  return join(botTmpDir, ...parts)
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
