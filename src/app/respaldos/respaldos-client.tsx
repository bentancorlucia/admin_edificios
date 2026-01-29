"use client"

import { useState, useEffect } from "react"
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
  FolderSync
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  checkGoogleDriveStatus,
  backupToGoogleDrive,
  backupToCustomPath,
  verifyCustomPath,
  getBackupHistory,
  diagnosticGoogleDrivePaths,
  type DriveStatus,
  type BackupResult
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
        result = await backupToCustomPath(customPath)
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

  const handleSaveCustomPath = async () => {
    if (!customPath) return

    setVerifying(true)
    setPathError(null)

    try {
      const result = await verifyCustomPath(customPath)
      if (result.valid) {
        localStorage.setItem('backup_custom_path', result.normalizedPath)
        setCustomPath(result.normalizedPath)
        setUseCustomPath(true)
        setPathError(null)
        checkStatus()
      } else {
        setPathError(result.error || 'Ruta inválida')
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
                  Cambiar carpeta de respaldo (multicuentas)
                </summary>
                <div className="mt-2 p-3 bg-blue-50 rounded-lg space-y-2">
                  <Label className="text-xs">Ruta personalizada:</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ej: H:\Mi unidad"
                      value={customPath}
                      onChange={(e) => setCustomPath(e.target.value)}
                      className="flex-1 text-sm"
                    />
                    <Button size="sm" onClick={handleSaveCustomPath} disabled={!customPath}>
                      Usar
                    </Button>
                    {useCustomPath && (
                      <Button size="sm" variant="ghost" onClick={handleClearCustomPath}>
                        Auto
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

              {/* Ruta personalizada */}
              <div className="bg-blue-50 p-4 rounded-lg space-y-3 border border-blue-200">
                <h4 className="font-medium flex items-center gap-2">
                  <FolderSync className="h-4 w-4" />
                  Configurar ruta manualmente
                </h4>
                <p className="text-sm text-slate-600">
                  Si tienes Google Drive en una unidad diferente (ej: H:\Mi unidad), ingrésala aquí:
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ej: H:\Mi unidad o H:/Mi unidad"
                    value={customPath}
                    onChange={(e) => {
                      setCustomPath(e.target.value)
                      setPathError(null)
                    }}
                    className="flex-1"
                  />
                  <Button onClick={handleSaveCustomPath} disabled={!customPath || verifying}>
                    {verifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verificar y Guardar'
                    )}
                  </Button>
                </div>
                {pathError && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{pathError}</AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Tip: Puedes usar / o \ en la ruta. Ejemplo: H:/Mi unidad
                </p>
                {useCustomPath && customPath && (
                  <div className="flex items-center justify-between bg-green-100 p-2 rounded">
                    <span className="text-sm text-green-800">
                      Usando ruta: <code className="font-mono">{customPath}</code>
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

      {/* Historial de respaldos */}
      {driveStatus?.detected && backupHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial de Respaldos</CardTitle>
            <CardDescription>
              Los últimos respaldos realizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {backupHistory.slice(0, 5).map((backup, index) => (
                <div
                  key={backup.name}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-mono">{backup.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">
                      {backup.date.toLocaleString('es-ES')}
                    </span>
                    {index === 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Más reciente
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
