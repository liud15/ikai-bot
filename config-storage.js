/**
 * Configuración de almacenamiento de archivos temporales
 * Evita llenar /tmp del sistema
 */
import { tmpdir } from 'os'
import { join } from 'path'
import fs from 'fs'

// MODIFICA ESTO CON TU RUTA DE ALMACENAMIENTO DISPONIBLE
const STORAGE_PATH = process.env.STORAGE_PATH || join(process.cwd(), 'storage', 'tmp')

export function initStoragePath() {
    if (!fs.existsSync(STORAGE_PATH)) {
        fs.mkdirSync(STORAGE_PATH, { recursive: true })
        console.log(`✓ Carpeta de almacenamiento creada: ${STORAGE_PATH}`)
    }
    return STORAGE_PATH
}

export function getTempDir() {
    return STORAGE_PATH
}

export default STORAGE_PATH
