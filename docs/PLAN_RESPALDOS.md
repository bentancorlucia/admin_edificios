# Plan: Sistema de Respaldo a Google Drive

## Resumen

Sistema simple de respaldo de la base de datos SQLite a Google Drive, usando Google Drive Desktop para sincronización automática.

---

## Arquitectura

- **Framework**: Next.js 14 + Tauri 2.x
- **Base de datos**: SQLite (`database.db`)
- **Destino**: Google Drive (via Google Drive Desktop)
- **Sincronización**: Automática por Drive Desktop

---

## Fase 1: Respaldo Local Básico

### Objetivo
Crear la infraestructura base para copiar `database.db` a una carpeta destino.

### Archivos a Crear

#### 1. `/src/lib/backup.ts`
```typescript
import { appDataDir, join } from '@tauri-apps/api/path'
import { copyFile, exists, mkdir } from '@tauri-apps/plugin-fs'

export interface BackupResult {
  success: boolean
  filePath?: string
  error?: string
}

export async function getDatabasePath(): Promise<string> {
  const appData = await appDataDir()
  return await join(appData, 'database.db')
}

export async function createBackup(destinoPath: string): Promise<BackupResult> {
  try {
    const dbPath = await getDatabasePath()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup_${timestamp}.db`
    const destFile = await join(destinoPath, fileName)

    await copyFile(dbPath, destFile)

    return { success: true, filePath: destFile }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
```

#### 2. `/src/app/respaldos/page.tsx`
```typescript
import { RespaldosClient } from './respaldos-client'

export default function RespaldosPage() {
  return <RespaldosClient />
}
```

#### 3. `/src/app/respaldos/respaldos-client.tsx`
Componente cliente con botón para respaldar.

### Archivos a Modificar

- **`/src/components/layout/sidebar.tsx`**: Agregar enlace "Respaldos"

---

## Fase 2: Integración con Google Drive

### Enfoque
Detectar la carpeta de Google Drive Desktop y guardar respaldos ahí. Drive sincroniza automáticamente.

### Requisitos del Usuario
- Tener **Google Drive Desktop** instalado
- La app detecta la carpeta automáticamente

### Ubicaciones de Google Drive Desktop

| OS | Ruta |
|----|------|
| **Windows** | `C:\Users\{usuario}\Google Drive\Mi unidad\` |
| **macOS** | `~/Library/CloudStorage/GoogleDrive-{email}/Mi unidad/` |

### Implementación

```typescript
import { homeDir, join } from '@tauri-apps/api/path'
import { exists, readDir, mkdir } from '@tauri-apps/plugin-fs'
import { platform } from '@tauri-apps/plugin-os'

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
```

### UI

```
┌─ Respaldos ─────────────────────────────────────────────┐
│                                                         │
│  [Google Drive Icon]  Google Drive                      │
│                                                         │
│  ✅ Detectado: Mi unidad/Admin Edificios Backups/       │
│                                                         │
│  [Button: Respaldar Ahora]                              │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Último respaldo: 29/01/2026 14:30                      │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─ Si NO está instalado ──────────────────────────────────┐
│                                                         │
│  ⚠️ Google Drive Desktop no detectado                   │
│                                                         │
│  1. Descarga Google Drive Desktop                       │
│  2. Inicia sesión con tu cuenta                         │
│  3. Vuelve aquí                                         │
│                                                         │
│  [Link: Descargar Google Drive]                         │
│  [Button: Reintentar detección]                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Flujo de Uso

```
1. Usuario abre "Respaldos"
         ↓
2. App detecta Google Drive Desktop
         ↓
3. Si detectado → Botón "Respaldar Ahora"
   Si no → Instrucciones para instalar
         ↓
4. Usuario hace clic en "Respaldar"
         ↓
5. Se copia database.db a la carpeta de Drive
         ↓
6. Google Drive sincroniza automáticamente a la nube ✓
```

---

## Archivos a Crear/Modificar

| Acción | Archivo |
|--------|---------|
| Crear | `src/lib/backup.ts` |
| Crear | `src/app/respaldos/page.tsx` |
| Crear | `src/app/respaldos/respaldos-client.tsx` |
| Modificar | `src/components/layout/sidebar.tsx` |

---

## Ventajas de este Enfoque

1. **Sin OAuth**: No requiere configuración de Google Cloud
2. **Sin tokens**: No hay que manejar autenticación
3. **Automático**: Drive Desktop sincroniza los archivos
4. **Historial**: Google Drive guarda versiones anteriores
5. **15 GB gratis**: Espacio suficiente para respaldos de SQLite
