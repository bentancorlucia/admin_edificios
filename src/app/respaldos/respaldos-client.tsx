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
import {
  checkGoogleDriveStatus,
  backupToGoogleDrive,
  getBackupHistory,
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

  const checkStatus = async () => {
    setLoading(true)
    try {
      const status = await checkGoogleDriveStatus()
      setDriveStatus(status)

      if (status.backupFolder) {
        const history = await getBackupHistory(status.backupFolder)
        setBackupHistory(history)
        if (history.length > 0) {
          setLastBackup(history[0].date.toLocaleString('es-ES'))
        }
      }
    } catch (error) {
      console.error('Error checking drive status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const handleBackup = async () => {
    setBacking(true)
    setBackupResult(null)
    try {
      const result = await backupToGoogleDrive()
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
          {driveStatus?.detected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                <FolderSync className="h-4 w-4" />
                <span className="font-medium">Carpeta de respaldos:</span>
                <code className="text-xs bg-slate-200 px-2 py-0.5 rounded">
                  {driveStatus.backupFolder}
                </code>
              </div>

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
                <AlertTitle>Google Drive Desktop no detectado</AlertTitle>
                <AlertDescription>
                  Para usar respaldos automáticos, instala Google Drive Desktop en tu computadora.
                </AlertDescription>
              </Alert>

              <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium">Pasos para configurar:</h4>
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
