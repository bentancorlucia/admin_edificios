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
    const paths = ['Google Drive\\Mi unidad', 'Google Drive']
    for (const p of paths) {
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
