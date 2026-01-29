import { appDataDir, join, homeDir } from '@tauri-apps/api/path'
import { copyFile, exists, mkdir, readDir } from '@tauri-apps/plugin-fs'
import { platform } from '@tauri-apps/plugin-os'

export interface BackupResult {
  success: boolean
  filePath?: string
  error?: string
  timestamp?: string
}

export interface DriveStatus {
  detected: boolean
  path?: string
  backupFolder?: string
  checkedPaths?: { path: string; exists: boolean }[]
}

export async function getDatabasePath(): Promise<string> {
  const appData = await appDataDir()
  return await join(appData, 'database.db')
}

export async function createBackup(destinoPath: string): Promise<BackupResult> {
  try {
    const dbPath = await getDatabasePath()

    if (!(await exists(dbPath))) {
      return { success: false, error: 'No se encontró la base de datos' }
    }

    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-')
    const fileName = `backup_${timestamp}.db`
    const destFile = await join(destinoPath, fileName)

    await copyFile(dbPath, destFile)

    return {
      success: true,
      filePath: destFile,
      timestamp: now.toLocaleString('es-ES')
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function detectGoogleDrivePath(): Promise<string | null> {
  const os = platform()
  const home = await homeDir()

  if (os === 'windows') {
    // Google Drive Desktop puede montarse como unidad virtual (G:\, H:\, etc.)
    // Buscar en todas las letras de unidad comunes
    const driveLetters = ['G', 'H', 'D', 'E', 'F', 'I', 'J', 'K', 'L']
    for (const letter of driveLetters) {
      // Probar variantes de nombres (español e inglés)
      const variants = [
        `${letter}:\\Mi unidad`,
        `${letter}:\\My Drive`,
        `${letter}:\\`
      ]
      for (const variant of variants) {
        try {
          if (await exists(variant)) {
            // Verificar que es Google Drive buscando archivo .desktop.ini o estructura típica
            const desktopIni = `${variant}\\.shortcut-targets-by-id`
            const isGoogleDrive = await exists(desktopIni) || await exists(`${variant}\\..\\Shared drives`)
            if (isGoogleDrive || variant.includes('Mi unidad') || variant.includes('My Drive')) {
              return variant
            }
          }
        } catch {
          // Continuar si la unidad no existe
        }
      }
    }

    // También buscar en las rutas tradicionales del home
    const homePaths = [
      'Google Drive\\Mi unidad',
      'Google Drive\\My Drive',
      'Google Drive',
      'GoogleDrive\\Mi unidad',
      'GoogleDrive\\My Drive'
    ]
    for (const p of homePaths) {
      const fullPath = await join(home, p)
      if (await exists(fullPath)) return fullPath
    }
  }

  if (os === 'macos') {
    const cloudStorage = await join(home, 'Library/CloudStorage')
    if (await exists(cloudStorage)) {
      const entries = await readDir(cloudStorage)
      for (const entry of entries) {
        if (entry.name?.startsWith('GoogleDrive-')) {
          const drivePath = await join(cloudStorage, entry.name, 'Mi unidad')
          if (await exists(drivePath)) return drivePath
        }
      }
    }
  }

  return null
}

export async function getGoogleDriveBackupFolder(): Promise<string | null> {
  const drivePath = await detectGoogleDrivePath()
  if (!drivePath) return null

  const backupFolder = await join(drivePath, 'Admin Edificios Backups')
  if (!(await exists(backupFolder))) {
    await mkdir(backupFolder, { recursive: true })
  }

  return backupFolder
}

export async function checkGoogleDriveStatus(): Promise<DriveStatus> {
  const drivePath = await detectGoogleDrivePath()

  if (!drivePath) {
    return { detected: false }
  }

  const backupFolder = await getGoogleDriveBackupFolder()

  return {
    detected: true,
    path: drivePath,
    backupFolder: backupFolder || undefined
  }
}

// Función de diagnóstico para ver qué rutas se están verificando
export async function diagnosticGoogleDrivePaths(): Promise<{ path: string; exists: boolean }[]> {
  const os = platform()
  const home = await homeDir()
  const results: { path: string; exists: boolean }[] = []

  if (os === 'windows') {
    // Verificar unidades virtuales
    const driveLetters = ['G', 'H', 'D', 'E', 'F', 'I', 'J', 'K', 'L']
    for (const letter of driveLetters) {
      const variants = [
        `${letter}:\\Mi unidad`,
        `${letter}:\\My Drive`
      ]
      for (const variant of variants) {
        try {
          const pathExists = await exists(variant)
          results.push({ path: variant, exists: pathExists })
        } catch {
          results.push({ path: variant, exists: false })
        }
      }
    }

    // Verificar rutas en home
    const homePaths = [
      'Google Drive\\Mi unidad',
      'Google Drive\\My Drive',
      'Google Drive',
      'GoogleDrive\\Mi unidad',
      'GoogleDrive\\My Drive'
    ]
    for (const p of homePaths) {
      const fullPath = await join(home, p)
      try {
        const pathExists = await exists(fullPath)
        results.push({ path: fullPath, exists: pathExists })
      } catch {
        results.push({ path: fullPath, exists: false })
      }
    }
  }

  if (os === 'macos') {
    const cloudStorage = await join(home, 'Library/CloudStorage')
    results.push({ path: cloudStorage, exists: await exists(cloudStorage) })
  }

  return results
}

// Función para respaldar a una ruta personalizada
export async function backupToCustomPath(customPath: string): Promise<BackupResult> {
  try {
    if (!(await exists(customPath))) {
      return {
        success: false,
        error: `La ruta no existe: ${customPath}`
      }
    }
    return await createBackup(customPath)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function backupToGoogleDrive(): Promise<BackupResult> {
  const folder = await getGoogleDriveBackupFolder()
  if (!folder) {
    return {
      success: false,
      error: 'Google Drive Desktop no detectado. Instálalo y vuelve a intentar.'
    }
  }
  return await createBackup(folder)
}

export async function getBackupHistory(folderPath: string): Promise<{ name: string; date: Date }[]> {
  try {
    if (!(await exists(folderPath))) {
      return []
    }

    const entries = await readDir(folderPath)
    const backups = entries
      .filter(entry => entry.name?.startsWith('backup_') && entry.name?.endsWith('.db'))
      .map(entry => {
        const timestampMatch = entry.name?.match(/backup_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/)
        let date = new Date()
        if (timestampMatch) {
          const isoString = timestampMatch[1].replace(/-/g, (match, offset) => {
            if (offset === 4 || offset === 7) return '-'
            if (offset === 13 || offset === 16) return ':'
            return match
          })
          date = new Date(isoString.slice(0, 10) + 'T' + isoString.slice(11).replace(/-/g, ':'))
        }
        return { name: entry.name || '', date }
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())

    return backups
  } catch {
    return []
  }
}
