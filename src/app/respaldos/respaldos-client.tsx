"use client"

import { useState, useEffect } from "react"
import { BackToHome } from "@/components/back-to-home"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Clock,
  FolderSync,
  RotateCcw,
  Upload,
  AlertTriangle,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { join } from "@tauri-apps/api/path"
import { relaunch } from "@tauri-apps/plugin-process"
import {
  checkGoogleDriveStatus,
  backupToGoogleDrive,
  backupToSelectedFolder,
  selectBackupFolder,
  selectBackupFile,
  restoreBackup,
  getBackupHistory,
  diagnosticGoogleDrivePaths,
  type DriveStatus,
  type BackupResult,
  type RestoreResult,
} from "@/lib/backup"

export function RespaldosClient() {
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [backing, setBacking] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null)
  const [backupHistory, setBackupHistory] = useState<{ name: string; date: Date }[]>([])
  const [customPath, setCustomPath] = useState<string>("")
  const [useCustomPath, setUseCustomPath] = useState(false)
  const [diagnosticPaths, setDiagnosticPaths] = useState<{ path: string; exists: boolean }[]>([])
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const checkStatus = async () => {
    setLoading(true)
    try {
      const status = await checkGoogleDriveStatus()
      setDriveStatus(status)

      // Si no se detectó y hay ruta personalizada guardada, usarla
      const savedPath = localStorage.getItem('backup_custom_path')
      if (savedPath) {
        setCustomPath(savedPath)
        setUseCustomPath(true)
      }

      const folderToCheck = useCustomPath && customPath ? customPath : status.backupFolder
      if (folderToCheck) {
        const history = await getBackupHistory(folderToCheck)
        setBackupHistory(history)
        if (history.length > 0) {
          setLastBackup(history[0].date.toLocaleString('es-ES'))
        }
      }

      // Si no se detectó, obtener diagnóstico
      if (!status.detected) {
        const paths = await diagnosticGoogleDrivePaths()
        setDiagnosticPaths(paths)
      }
    } catch (error) {
      console.error('Error checking drive status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Cargar ruta personalizada guardada
    const savedPath = localStorage.getItem('backup_custom_path')
    if (savedPath) {
      setCustomPath(savedPath)
      setUseCustomPath(true)
    }
    checkStatus()
  }, [])

  const handleBackup = async () => {
    setBacking(true)
    setBackupResult(null)
    try {
      let result: BackupResult
      if (useCustomPath && customPath) {
        result = await backupToSelectedFolder(customPath)
      } else {
        result = await backupToGoogleDrive()
      }
      setBackupResult(result)
      if (result.success && result.timestamp) {
        setLastBackup(result.timestamp)
        await checkStatus()
      }
    } catch (error) {
      setBackupResult({ success: false, error: String(error) })
    } finally {
      setBacking(false)
    }
  }

  const handleSelectFolder = async () => {
    setVerifying(true)
    setPathError(null)

    try {
      const selectedPath = await selectBackupFolder()
      if (selectedPath) {
        localStorage.setItem('backup_custom_path', selectedPath)
        setCustomPath(selectedPath)
        setUseCustomPath(true)
        setPathError(null)
        checkStatus()
      }
    } catch (error) {
      setPathError(`Error: ${String(error)}`)
    } finally {
      setVerifying(false)
    }
  }

  const handleClearCustomPath = () => {
    localStorage.removeItem('backup_custom_path')
    setCustomPath("")
    setUseCustomPath(false)
    checkStatus()
  }

  // ============ RESTAURACIÓN ============
  const [restoreTarget, setRestoreTarget] = useState<{ path: string; displayName: string; isExternal: boolean } | null>(null)
  const [restoreConfirmed, setRestoreConfirmed] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)

  const folderActiva = useCustomPath && customPath ? customPath : driveStatus?.backupFolder

  const handleRestoreFromHistory = async (backupName: string) => {
    if (!folderActiva) return
    const path = await join(folderActiva, backupName)
    setRestoreTarget({ path, displayName: backupName, isExternal: false })
    setRestoreConfirmed(false)
    setRestoreResult(null)
  }

  const handleRestoreFromFile = async () => {
    const file = await selectBackupFile()
    if (!file) return
    const displayName = file.split(/[\\/]/).pop() || file
    setRestoreTarget({ path: file, displayName, isExternal: true })
    setRestoreConfirmed(false)
    setRestoreResult(null)
  }

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    setRestoreResult(null)
    try {
      const result = await restoreBackup(restoreTarget.path)
      setRestoreResult(result)
      if (result.success) {
        // Reiniciar la app después de 3 segundos para que cargue la DB nueva
        setTimeout(async () => {
          try {
            await relaunch()
          } catch (e) {
            console.error("Error al reiniciar:", e)
          }
        }, 3000)
      }
    } catch (error) {
      setRestoreResult({ success: false, error: String(error) })
    } finally {
      setRestoring(false)
    }
  }

  const closeRestoreDialog = () => {
    if (restoring) return
    if (restoreResult?.success) return // mientras se reinicia, no permitir cerrar
    setRestoreTarget(null)
    setRestoreConfirmed(false)
    setRestoreResult(null)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <span className="ml-2 text-slate-500">Detectando Google Drive...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <BackToHome />
        <h1 className="text-2xl font-bold">Respaldos</h1>
        <p className="text-slate-500">Respalda tu base de datos a Google Drive</p>
      </div>

      {/* Estado de Google Drive */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${driveStatus?.detected ? 'bg-green-100' : 'bg-orange-100'}`}>
                <Cloud className={`h-6 w-6 ${driveStatus?.detected ? 'text-green-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <CardTitle className="text-lg">Google Drive</CardTitle>
                <CardDescription>
                  {driveStatus?.detected
                    ? 'Conectado y listo para respaldar'
                    : 'No detectado'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={driveStatus?.detected ? 'default' : 'secondary'}>
              {driveStatus?.detected ? 'Detectado' : 'No disponible'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {driveStatus?.detected || (useCustomPath && customPath) ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                <FolderSync className="h-4 w-4" />
                <span className="font-medium">Carpeta de respaldos:</span>
                <code className="text-xs bg-slate-200 px-2 py-0.5 rounded">
                  {useCustomPath && customPath ? customPath : driveStatus?.backupFolder}
                </code>
                {useCustomPath && (
                  <Badge variant="secondary" className="text-xs">Personalizada</Badge>
                )}
              </div>

              {/* Opción para cambiar ruta */}
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                  Cambiar carpeta de respaldo
                </summary>
                <div className="mt-2 p-3 bg-blue-50 rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSelectFolder} disabled={verifying}>
                      {verifying ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <FolderSync className="h-4 w-4 mr-1" />
                      )}
                      Seleccionar carpeta
                    </Button>
                    {useCustomPath && (
                      <Button size="sm" variant="ghost" onClick={handleClearCustomPath}>
                        Usar auto-detección
                      </Button>
                    )}
                  </div>
                </div>
              </details>

              {lastBackup && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="h-4 w-4" />
                  <span>Último respaldo: {lastBackup}</span>
                </div>
              )}

              {/* Resultado del respaldo */}
              {backupResult && (
                <Alert variant={backupResult.success ? 'default' : 'destructive'}>
                  {backupResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {backupResult.success ? 'Respaldo exitoso' : 'Error al respaldar'}
                  </AlertTitle>
                  <AlertDescription>
                    {backupResult.success
                      ? `Archivo guardado. Google Drive lo sincronizará automáticamente.`
                      : backupResult.error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleBackup}
                  disabled={backing}
                  className="flex-1"
                >
                  {backing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Respaldando...
                    </>
                  ) : (
                    <>
                      <HardDrive className="mr-2 h-4 w-4" />
                      Respaldar Ahora
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={checkStatus}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Google Drive Desktop no detectado automáticamente</AlertTitle>
                <AlertDescription>
                  Puedes ingresar la ruta manualmente o instalar Google Drive Desktop.
                </AlertDescription>
              </Alert>

              {/* Selección de carpeta */}
              <div className="bg-blue-50 p-4 rounded-lg space-y-3 border border-blue-200">
                <h4 className="font-medium flex items-center gap-2">
                  <FolderSync className="h-4 w-4" />
                  Seleccionar carpeta de respaldo
                </h4>
                <p className="text-sm text-slate-600">
                  Selecciona la carpeta donde quieres guardar los respaldos (puede ser tu carpeta de Google Drive u otra ubicación):
                </p>
                <Button onClick={handleSelectFolder} disabled={verifying} className="w-full">
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <FolderSync className="h-4 w-4 mr-2" />
                      Seleccionar carpeta
                    </>
                  )}
                </Button>
                {pathError && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{pathError}</AlertDescription>
                  </Alert>
                )}
                {useCustomPath && customPath && (
                  <div className="flex items-center justify-between bg-green-100 p-2 rounded">
                    <span className="text-sm text-green-800">
                      Carpeta seleccionada: <code className="font-mono text-xs">{customPath}</code>
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleClearCustomPath}>
                      Limpiar
                    </Button>
                  </div>
                )}
              </div>

              {/* Botón de respaldar si hay ruta personalizada */}
              {useCustomPath && customPath && (
                <div className="space-y-3">
                  {backupResult && (
                    <Alert variant={backupResult.success ? 'default' : 'destructive'}>
                      {backupResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertTitle>
                        {backupResult.success ? 'Respaldo exitoso' : 'Error al respaldar'}
                      </AlertTitle>
                      <AlertDescription>
                        {backupResult.success
                          ? `Archivo guardado en la ruta personalizada.`
                          : backupResult.error}
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button
                    onClick={handleBackup}
                    disabled={backing}
                    className="w-full"
                  >
                    {backing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Respaldando...
                      </>
                    ) : (
                      <>
                        <HardDrive className="mr-2 h-4 w-4" />
                        Respaldar Ahora
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Diagnóstico */}
              <div className="border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDiagnostic(!showDiagnostic)}
                  className="text-slate-500"
                >
                  {showDiagnostic ? 'Ocultar' : 'Mostrar'} rutas verificadas
                </Button>
                {showDiagnostic && diagnosticPaths.length > 0 && (
                  <div className="mt-2 bg-slate-100 p-3 rounded text-xs font-mono max-h-48 overflow-y-auto">
                    {diagnosticPaths.map((p, i) => (
                      <div key={i} className={`flex items-center gap-2 ${p.exists ? 'text-green-600' : 'text-slate-400'}`}>
                        <span>{p.exists ? '✓' : '✗'}</span>
                        <span>{p.path}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium">¿No tienes Google Drive Desktop?</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                  <li>Descarga e instala Google Drive Desktop</li>
                  <li>Inicia sesión con tu cuenta de Google</li>
                  <li>Espera a que se complete la sincronización inicial</li>
                  <li>Vuelve aquí y presiona "Reintentar"</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" asChild>
                  <a
                    href="https://www.google.com/drive/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Descargar Google Drive
                  </a>
                </Button>
                <Button onClick={checkStatus}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reintentar detección
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de respaldos + Restauración */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Historial y Restauración</CardTitle>
              <CardDescription>
                Restaurá la base de datos desde un respaldo previo. Se hará un backup automático de la DB actual antes de pisarla.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRestoreFromFile}>
              <Upload className="h-4 w-4 mr-2" />
              Restaurar desde archivo...
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {backupHistory.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay respaldos previos en la carpeta configurada. Podés restaurar desde un archivo externo (.db) con el botón de arriba.
            </p>
          ) : (
            <div className="space-y-2">
              {backupHistory.slice(0, 10).map((backup, index) => (
                <div
                  key={backup.name}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <HardDrive className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-mono truncate">{backup.name}</span>
                    {index === 0 && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Más reciente
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-slate-500">
                      {backup.date.toLocaleString('es-ES')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestoreFromHistory(backup.name)}
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      title="Restaurar este respaldo"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restaurar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación de restauración */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => { if (!open) closeRestoreDialog() }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Confirmar restauración
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Vas a restaurar la base de datos desde:
                </p>
                <div className="bg-slate-50 p-2 rounded font-mono text-xs break-all">
                  {restoreTarget?.displayName}
                  {restoreTarget?.isExternal && (
                    <Badge variant="secondary" className="ml-2 text-xs">Archivo externo</Badge>
                  )}
                </div>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Esto reemplazará la base de datos actual</AlertTitle>
                  <AlertDescription>
                    Todos los datos actuales se reemplazarán con los del respaldo. Antes de hacerlo se creará un backup automático "pre-restore" de la DB actual en el AppData de la app.
                    <br /><br />
                    <strong>La aplicación se reiniciará automáticamente</strong> al completar la restauración.
                  </AlertDescription>
                </Alert>

                {!restoreResult && (
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={restoreConfirmed}
                      onChange={(e) => setRestoreConfirmed(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    <span>
                      Entiendo que la base de datos actual será reemplazada y que la app se reiniciará.
                    </span>
                  </label>
                )}

                {restoreResult?.success && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Restauración exitosa</AlertTitle>
                    <AlertDescription>
                      La DB fue restaurada correctamente. La app se reiniciará en unos segundos…
                      {restoreResult.preRestoreBackupPath && (
                        <>
                          <br /><br />
                          <span className="text-xs text-slate-500">
                            Backup pre-restore: <code>{restoreResult.preRestoreBackupPath.split(/[\\/]/).pop()}</code>
                          </span>
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {restoreResult && !restoreResult.success && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error al restaurar</AlertTitle>
                    <AlertDescription>{restoreResult.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring || restoreResult?.success}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmRestore()
              }}
              disabled={!restoreConfirmed || restoring || !!restoreResult?.success}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restaurando...
                </>
              ) : restoreResult?.success ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reiniciando...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restaurar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Información */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            <strong>¿Cómo funciona?</strong> Los respaldos se guardan en tu carpeta de Google Drive.
            Google Drive Desktop sincroniza automáticamente estos archivos a la nube.
          </p>
          <p>
            <strong>Ventajas:</strong> Historial de versiones automático, 15 GB de espacio gratuito,
            acceso desde cualquier dispositivo.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
