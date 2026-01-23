"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Landmark,
  Plus,
  Search,
  Download,
  Edit,
  Trash2,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Link2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Paperclip,
  ExternalLink,
  Upload,
  X,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  createCuentaBancaria,
  updateCuentaBancaria,
  deleteCuentaBancaria,
  createMovimientoBancario,
  updateMovimientoBancarioConTransaccion,
  deleteMovimientoBancarioConTransaccion,
  getInfoTransaccionVinculadaMovimiento,
  vincularReciboConIngreso,
  getEstadoCuenta,
  type EstadoCuentaData,
  type InfoTransaccionVinculada,
} from "@/lib/database"
import { formatCurrency, formatDate } from "@/lib/utils"
import { generateEstadoCuentaPDF } from "@/lib/pdf"
import { toast } from "@/hooks/use-toast"

type TipoMovimiento = "INGRESO" | "EGRESO"
type ClasificacionEgreso = "GASTO_COMUN" | "FONDO_RESERVA"

type Movimiento = {
  id: string
  tipo: TipoMovimiento
  monto: number
  fecha: string
  descripcion: string
  referencia: string | null
  numeroDocumento: string | null
  archivoUrl: string | null
  clasificacion: string | null
  servicioId: string | null
  conciliado: boolean
  transaccionId: string | null
  servicio?: {
    id: string
    nombre: string
    tipo: string
  } | null
}

type CuentaBancaria = {
  id: string
  banco: string
  tipoCuenta: string
  numeroCuenta: string
  titular: string | null
  saldoInicial: number
  activa: boolean
  porDefecto: boolean
  movimientos: Movimiento[]
}

type Recibo = {
  id: string
  monto: number
  fecha: string
  descripcion: string | null
  referencia: string | null
  apartamento?: {
    numero: string
    tipoOcupacion: string
  } | null
}

type Servicio = {
  id: string
  tipo: string
  nombre: string
  celular: string | null
  email: string | null
}

type Props = {
  initialCuentas: CuentaBancaria[]
  recibosNoVinculados: Recibo[]
  servicios: Servicio[]
}

const tiposCuenta = [
  "Corriente",
  "Ahorro",
  "Monetaria",
  "Otro",
]

export function BancosClient({ initialCuentas, recibosNoVinculados, servicios }: Props) {
  const [cuentas, setCuentas] = useState(initialCuentas)
  const [recibos, setRecibos] = useState(recibosNoVinculados)
  const [search, setSearch] = useState("")
  const [selectedCuenta, setSelectedCuenta] = useState<CuentaBancaria | null>(null)
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [isMovimientoDialogOpen, setIsMovimientoDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleteMovDialogOpen, setIsDeleteMovDialogOpen] = useState(false)
  const [isVincularDialogOpen, setIsVincularDialogOpen] = useState(false)
  const [isEstadoCuentaDialogOpen, setIsEstadoCuentaDialogOpen] = useState(false)
  const [selectedMovimiento, setSelectedMovimiento] = useState<Movimiento | null>(null)
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimiento>("INGRESO")
  const [isEditMode, setIsEditMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaData | null>(null)

  // Form states
  const [accountForm, setAccountForm] = useState({
    banco: "",
    tipoCuenta: "Corriente",
    numeroCuenta: "",
    titular: "",
    saldoInicial: 0,
    porDefecto: false,
  })

  const [movimientoForm, setMovimientoForm] = useState({
    monto: 0,
    fecha: new Date().toISOString().split("T")[0],
    descripcion: "",
    referencia: "",
    numeroDocumento: "",
    clasificacion: "" as ClasificacionEgreso | "",
    servicioId: "",
    archivoUrl: "",
  })
  const [archivoFile, setArchivoFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  const [estadoCuentaFiltro, setEstadoCuentaFiltro] = useState({
    fechaInicio: "",
    fechaFin: "",
    tipo: "" as TipoMovimiento | "",
    clasificacion: "" as ClasificacionEgreso | "",
    busqueda: "",
  })
  const [infoTransaccionVinculada, setInfoTransaccionVinculada] = useState<InfoTransaccionVinculada | null>(null)

  // Estados para paginación del historial
  const [historialPage, setHistorialPage] = useState(1)
  const historialPageSize = 10

  const filteredCuentas = cuentas.filter((cuenta) =>
    cuenta.banco.toLowerCase().includes(search.toLowerCase()) ||
    cuenta.numeroCuenta.includes(search)
  )

  // Calcular saldo actual de una cuenta
  const calcularSaldo = (cuenta: CuentaBancaria) => {
    let saldo = cuenta.saldoInicial
    cuenta.movimientos.forEach((mov) => {
      if (mov.tipo === "INGRESO") {
        saldo += mov.monto
      } else {
        saldo -= mov.monto
      }
    })
    return saldo
  }

  // Reset forms
  const resetAccountForm = () => {
    setAccountForm({
      banco: "",
      tipoCuenta: "Corriente",
      numeroCuenta: "",
      titular: "",
      saldoInicial: 0,
      porDefecto: false,
    })
    setSelectedCuenta(null)
  }

  const resetMovimientoForm = () => {
    setMovimientoForm({
      monto: 0,
      fecha: new Date().toISOString().split("T")[0],
      descripcion: "",
      referencia: "",
      numeroDocumento: "",
      clasificacion: "" as ClasificacionEgreso | "",
      servicioId: "",
      archivoUrl: "",
    })
    setArchivoFile(null)
  }

  // Subir archivo via API route
  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("Error uploading file:", error)
        return null
      }

      const data = await response.json()
      return data.url
    } catch (error) {
      console.error("Error uploading file:", error)
      return null
    }
  }

  // Account handlers
  const openCreateAccountDialog = () => {
    resetAccountForm()
    setError(null)
    setIsAccountDialogOpen(true)
  }

  const openEditAccountDialog = (cuenta: CuentaBancaria) => {
    setSelectedCuenta(cuenta)
    setError(null)
    setAccountForm({
      banco: cuenta.banco,
      tipoCuenta: cuenta.tipoCuenta,
      numeroCuenta: cuenta.numeroCuenta,
      titular: cuenta.titular || "",
      saldoInicial: cuenta.saldoInicial,
      porDefecto: cuenta.porDefecto,
    })
    setIsAccountDialogOpen(true)
  }

  const openDeleteAccountDialog = (cuenta: CuentaBancaria) => {
    setSelectedCuenta(cuenta)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const data = {
        banco: accountForm.banco,
        tipoCuenta: accountForm.tipoCuenta,
        numeroCuenta: accountForm.numeroCuenta,
        titular: accountForm.titular || null,
        saldoInicial: accountForm.saldoInicial,
        porDefecto: accountForm.porDefecto,
      }

      if (selectedCuenta) {
        const result = await updateCuentaBancaria(selectedCuenta.id, data)
        // Si se marcó como por defecto, desmarcar las demás en el estado local
        if (data.porDefecto) {
          setCuentas((prev) =>
            prev.map((c) =>
              c.id === selectedCuenta.id
                ? { ...c, ...result, movimientos: c.movimientos }
                : { ...c, porDefecto: false }
            )
          )
        } else {
          setCuentas((prev) =>
            prev.map((c) =>
              c.id === selectedCuenta.id
                ? { ...c, ...result, movimientos: c.movimientos }
                : c
            )
          )
        }
      } else {
        const result = await createCuentaBancaria(data)
        // Si se marcó como por defecto, desmarcar las demás en el estado local
        if (data.porDefecto) {
          setCuentas((prev) => [
            ...prev.map((c) => ({ ...c, porDefecto: false })),
            { ...result, movimientos: [] }
          ])
        } else {
          setCuentas((prev) => [...prev, { ...result, movimientos: [] }])
        }
      }

      setIsAccountDialogOpen(false)
      resetAccountForm()
    } catch {
      setError("Error inesperado. Por favor intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!selectedCuenta) return
    setIsLoading(true)

    try {
      await deleteCuentaBancaria(selectedCuenta.id)
      setCuentas((prev) => prev.filter((c) => c.id !== selectedCuenta.id))
      setIsDeleteDialogOpen(false)
      setSelectedCuenta(null)
    } catch {
      alert("Error al eliminar la cuenta")
    } finally {
      setIsLoading(false)
    }
  }

  // Movimiento handlers
  const openMovimientoDialog = (cuenta: CuentaBancaria, tipo: TipoMovimiento) => {
    setSelectedCuenta(cuenta)
    setTipoMovimiento(tipo)
    setIsEditMode(false)
    setSelectedMovimiento(null)
    resetMovimientoForm()
    setError(null)
    setIsMovimientoDialogOpen(true)
  }

  const openEditMovimientoDialog = (cuenta: CuentaBancaria, mov: Movimiento) => {
    setSelectedCuenta(cuenta)
    setSelectedMovimiento(mov)
    setTipoMovimiento(mov.tipo)
    setIsEditMode(true)
    // Extraer fecha usando UTC para evitar problemas de zona horaria
    const d = new Date(mov.fecha)
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const fechaStr = `${year}-${month}-${day}`
    setMovimientoForm({
      monto: mov.monto,
      fecha: fechaStr,
      descripcion: mov.descripcion,
      referencia: mov.referencia || "",
      numeroDocumento: mov.numeroDocumento || "",
      clasificacion: (mov.clasificacion || "") as ClasificacionEgreso | "",
      servicioId: mov.servicioId || "",
      archivoUrl: mov.archivoUrl || "",
    })
    setArchivoFile(null)
    setError(null)
    setIsMovimientoDialogOpen(true)
  }

  const openDeleteMovDialog = async (cuenta: CuentaBancaria, mov: Movimiento) => {
    setSelectedCuenta(cuenta)
    setSelectedMovimiento(mov)

    // Obtener info de transacción vinculada si existe
    if (mov.transaccionId) {
      const info = await getInfoTransaccionVinculadaMovimiento(mov.id)
      setInfoTransaccionVinculada(info)
    } else {
      setInfoTransaccionVinculada(null)
    }

    setIsDeleteMovDialogOpen(true)
  }

  const handleSubmitMovimiento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCuenta) return
    setIsLoading(true)
    setError(null)

    try {
      // Subir archivo si existe
      let archivoUrl: string | null = movimientoForm.archivoUrl || null
      if (archivoFile) {
        setUploadingFile(true)
        archivoUrl = await uploadFile(archivoFile)
        setUploadingFile(false)
        if (!archivoUrl) {
          setError("Error al subir el archivo. Por favor intenta de nuevo.")
          return
        }
      }

      // Generar descripción automática si no se proporcionó
      let descripcion = movimientoForm.descripcion
      if (tipoMovimiento === "EGRESO" && !descripcion) {
        if (movimientoForm.servicioId) {
          const servicioSeleccionado = servicios.find(s => s.id === movimientoForm.servicioId)
          if (servicioSeleccionado) {
            descripcion = `Pago a ${servicioSeleccionado.nombre}`
          }
        } else {
          descripcion = "Egreso bancario"
        }
      }

      // Crear fecha sin problemas de zona horaria (usar mediodía UTC)
      const fechaParts = movimientoForm.fecha.split('-')
      const fechaCorrecta = new Date(Date.UTC(
        parseInt(fechaParts[0]),
        parseInt(fechaParts[1]) - 1,
        parseInt(fechaParts[2]),
        12, 0, 0
      ))

      const movimientoData = {
        tipo: tipoMovimiento,
        monto: movimientoForm.monto,
        fecha: fechaCorrecta.toISOString(),
        descripcion: descripcion,
        referencia: movimientoForm.referencia || null,
        numeroDocumento: movimientoForm.numeroDocumento || null,
        archivoUrl: archivoUrl,
        clasificacion: tipoMovimiento === "EGRESO" && movimientoForm.clasificacion ? movimientoForm.clasificacion : null,
        servicioId: tipoMovimiento === "EGRESO" && movimientoForm.servicioId ? movimientoForm.servicioId : null,
        cuentaBancariaId: selectedCuenta.id,
        conciliado: false,
        transaccionId: null,
      }

      let result
      if (isEditMode && selectedMovimiento) {
        // Usar la función que sincroniza con transacción vinculada
        const { movimiento, transaccionActualizada } = await updateMovimientoBancarioConTransaccion(
          selectedMovimiento.id,
          movimientoData
        )
        result = movimiento

        if (transaccionActualizada) {
          toast({
            title: "Movimiento y transacción actualizados",
            description: "Se actualizó el movimiento bancario y la transacción vinculada.",
          })
        }
      } else {
        result = await createMovimientoBancario(movimientoData)
      }

      // Actualizar la cuenta con el movimiento
      setCuentas((prev) =>
        prev.map((c) => {
          if (c.id !== selectedCuenta.id) return c

          if (isEditMode && selectedMovimiento) {
            // Actualizar movimiento existente
            return {
              ...c,
              movimientos: c.movimientos.map((m) =>
                m.id === selectedMovimiento.id
                  ? {
                      id: result.id,
                      tipo: result.tipo,
                      monto: result.monto,
                      fecha: result.fecha,
                      descripcion: result.descripcion,
                      referencia: result.referencia,
                      numeroDocumento: result.numeroDocumento,
                      archivoUrl: result.archivoUrl,
                      clasificacion: result.clasificacion as ClasificacionEgreso | null,
                      servicioId: result.servicioId,
                      conciliado: result.conciliado,
                      transaccionId: result.transaccionId,
                    }
                  : m
              ),
            }
          } else {
            // Agregar nuevo movimiento
            return {
              ...c,
              movimientos: [
                {
                  id: result.id,
                  tipo: result.tipo,
                  monto: result.monto,
                  fecha: result.fecha,
                  descripcion: result.descripcion,
                  referencia: result.referencia,
                  numeroDocumento: result.numeroDocumento,
                  archivoUrl: result.archivoUrl,
                  clasificacion: result.clasificacion as ClasificacionEgreso | null,
                  servicioId: result.servicioId,
                  conciliado: result.conciliado,
                  transaccionId: result.transaccionId,
                },
                ...c.movimientos,
              ],
            }
          }
        })
      )

      setIsMovimientoDialogOpen(false)
      resetMovimientoForm()
    } catch {
      setError("Error inesperado. Por favor intenta de nuevo.")
    } finally {
      setIsLoading(false)
      setUploadingFile(false)
    }
  }

  const handleDeleteMovimiento = async () => {
    if (!selectedCuenta || !selectedMovimiento) return
    setIsLoading(true)

    try {
      // Usar la función que elimina también la transacción vinculada y recalcula deudas
      const { transaccionEliminada, apartamentoRecalculado } =
        await deleteMovimientoBancarioConTransaccion(selectedMovimiento.id)

      setCuentas((prev) =>
        prev.map((c) =>
          c.id === selectedCuenta.id
            ? {
                ...c,
                movimientos: c.movimientos.filter(
                  (m) => m.id !== selectedMovimiento.id
                ),
              }
            : c
        )
      )

      // Mostrar toast con información de lo que se eliminó
      if (transaccionEliminada) {
        toast({
          title: "Movimiento y transacción eliminados",
          description: apartamentoRecalculado
            ? "Se eliminaron ambos y se recalcularon las deudas del apartamento."
            : "Se eliminó el movimiento bancario y la transacción vinculada.",
        })
      }

      setIsDeleteMovDialogOpen(false)
      setSelectedMovimiento(null)
      setInfoTransaccionVinculada(null)
    } catch {
      alert("Error al eliminar el movimiento")
    } finally {
      setIsLoading(false)
    }
  }

  // Vincular recibo handlers
  const openVincularDialog = (cuenta: CuentaBancaria) => {
    setSelectedCuenta(cuenta)
    setIsVincularDialogOpen(true)
  }

  const handleVincularRecibo = async (reciboId: string) => {
    if (!selectedCuenta) return
    setIsLoading(true)

    try {
      const result = await vincularReciboConIngreso(reciboId, selectedCuenta.id)

      // Actualizar la cuenta con el nuevo movimiento
      setCuentas((prev) =>
        prev.map((c) =>
          c.id === selectedCuenta.id
            ? {
                ...c,
                movimientos: [
                  {
                    id: result.id,
                    tipo: result.tipo,
                    monto: result.monto,
                    fecha: result.fecha,
                    descripcion: result.descripcion,
                    referencia: result.referencia,
                    numeroDocumento: result.numeroDocumento,
                    archivoUrl: result.archivoUrl,
                    clasificacion: result.clasificacion as ClasificacionEgreso | null,
                    servicioId: result.servicioId,
                    conciliado: result.conciliado,
                    transaccionId: result.transaccionId,
                  },
                  ...c.movimientos,
                ],
              }
            : c
        )
      )

      // Eliminar de recibos no vinculados
      setRecibos((prev) => prev.filter((r) => r.id !== reciboId))
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al vincular el recibo")
    } finally {
      setIsLoading(false)
    }
  }

  // Estado de cuenta handlers - descarga directa de PDF
  const handleDownloadEstadoCuenta = async (cuenta: CuentaBancaria) => {
    setIsLoading(true)

    try {
      const data = await getEstadoCuenta(cuenta.id)
      if (data) {
        generateEstadoCuentaPDF(data)
        toast({
          title: "PDF descargado",
          description: `Estado de cuenta de ${cuenta.banco} descargado correctamente`,
          variant: "success",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Error al generar el estado de cuenta",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Abrir diálogo de historial de movimientos
  const openHistorialMovimientosDialog = async (cuenta: CuentaBancaria) => {
    setSelectedCuenta(cuenta)
    setEstadoCuentaFiltro({ fechaInicio: "", fechaFin: "", tipo: "", clasificacion: "", busqueda: "" })
    setHistorialPage(1)
    setIsLoading(true)

    try {
      const data = await getEstadoCuenta(cuenta.id)
      setEstadoCuenta(data)
      setIsEstadoCuentaDialogOpen(true)
    } catch {
      alert("Error al cargar el historial de movimientos")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFiltrarEstadoCuenta = async () => {
    if (!selectedCuenta) return
    setIsLoading(true)

    try {
      const fechaInicio = estadoCuentaFiltro.fechaInicio || undefined
      const fechaFin = estadoCuentaFiltro.fechaFin
        ? estadoCuentaFiltro.fechaFin + "T23:59:59"
        : undefined

      const data = await getEstadoCuenta(selectedCuenta.id, fechaInicio, fechaFin)
      setEstadoCuenta(data)
    } catch {
      alert("Error al filtrar el estado de cuenta")
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportEstadoCuenta = () => {
    if (!estadoCuenta) return
    generateEstadoCuentaPDF(estadoCuenta)
    toast({
      title: "PDF descargado",
      description: `Estado de cuenta de ${estadoCuenta.cuenta.banco} descargado correctamente`,
      variant: "success",
    })
  }

  const handleExportCSV = () => {
    if (!estadoCuenta || !selectedCuenta) return

    // Aplicar los mismos filtros que se muestran en la tabla
    const tipoFiltro = estadoCuentaFiltro.tipo
    const clasificacionFiltro = estadoCuentaFiltro.clasificacion
    const movimientosFiltrados = estadoCuenta.movimientos.filter((mov) => {
      const movFull = selectedCuenta.movimientos.find(m => m.id === mov.id)
      if (tipoFiltro === "INGRESO" || tipoFiltro === "EGRESO") {
        if (mov.tipo !== tipoFiltro) return false
      }
      if (clasificacionFiltro === "GASTO_COMUN" || clasificacionFiltro === "FONDO_RESERVA") {
        if (mov.clasificacion !== clasificacionFiltro) return false
      }
      if (estadoCuentaFiltro.busqueda) {
        const searchLower = estadoCuentaFiltro.busqueda.toLowerCase()
        const matchDescripcion = mov.descripcion.toLowerCase().includes(searchLower)
        const matchReferencia = mov.referencia?.toLowerCase().includes(searchLower)
        const matchDocumento = movFull?.numeroDocumento?.toLowerCase().includes(searchLower)
        if (!matchDescripcion && !matchReferencia && !matchDocumento) return false
      }
      return true
    })

    // Crear contenido CSV
    const headers = ["Fecha", "Descripción", "Referencia", "Tipo", "Clasificación", "Ingreso", "Egreso", "Saldo"]
    const rows = movimientosFiltrados.map((mov) => {
      const movCompleto = selectedCuenta.movimientos.find(m => m.id === mov.id)
      return [
        formatDate(new Date(mov.fecha)),
        `"${mov.descripcion.replace(/"/g, '""')}"`,
        mov.referencia || movCompleto?.numeroDocumento || "",
        mov.tipo,
        mov.clasificacion === "GASTO_COMUN" ? "Gasto Común" : mov.clasificacion === "FONDO_RESERVA" ? "Fondo Reserva" : "",
        mov.tipo === "INGRESO" ? mov.monto.toFixed(2) : "",
        mov.tipo === "EGRESO" ? mov.monto.toFixed(2) : "",
        mov.saldoAcumulado.toFixed(2),
      ].join(",")
    })

    const csvContent = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `movimientos_${estadoCuenta.cuenta.banco}_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "CSV descargado",
      description: `${movimientosFiltrados.length} movimientos exportados correctamente`,
      variant: "success",
    })
  }

  return (
    <div className="space-y-8 px-4 md:px-8 lg:px-12 py-6">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6bTEwIDEwdjZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Landmark className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Gestión Bancaria</h1>
                <p className="text-emerald-100 text-sm">
                  Administra tus cuentas bancarias y movimientos
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={openCreateAccountDialog}
            className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cuenta
          </Button>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por banco o número de cuenta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Landmark className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">Cuentas Activas</p>
                <p className="text-2xl font-bold text-blue-900">
                  {cuentas.filter((c) => c.activa).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600">Total Ingresos</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(
                    cuentas.reduce(
                      (sum, c) =>
                        sum +
                        c.movimientos
                          .filter((m) => m.tipo === "INGRESO")
                          .reduce((s, m) => s + m.monto, 0),
                      0
                    )
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-red-600">Total Egresos</p>
                <p className="text-2xl font-bold text-red-900">
                  {formatCurrency(
                    cuentas.reduce(
                      (sum, c) =>
                        sum +
                        c.movimientos
                          .filter((m) => m.tipo === "EGRESO")
                          .reduce((s, m) => s + m.monto, 0),
                      0
                    )
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cuentas Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCuentas.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Landmark className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No hay cuentas bancarias registradas</p>
          </div>
        ) : (
          filteredCuentas.map((cuenta) => {
            const saldoActual = calcularSaldo(cuenta)
            const totalIngresos = cuenta.movimientos
              .filter((m) => m.tipo === "INGRESO")
              .reduce((s, m) => s + m.monto, 0)
            const totalEgresos = cuenta.movimientos
              .filter((m) => m.tipo === "EGRESO")
              .reduce((s, m) => s + m.monto, 0)

            return (
              <Card key={cuenta.id} className="overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Landmark className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{cuenta.banco}</CardTitle>
                          {cuenta.porDefecto && (
                            <Badge className="bg-blue-500 text-white text-xs">
                              Por defecto
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          {cuenta.tipoCuenta} - {cuenta.numeroCuenta}
                        </p>
                        {cuenta.titular && (
                          <p className="text-xs text-slate-400">{cuenta.titular}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditAccountDialog(cuenta)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteAccountDialog(cuenta)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {/* Saldo y Resumen */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Saldo Inicial</p>
                      <p className="font-semibold text-slate-700">
                        {formatCurrency(cuenta.saldoInicial)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600">Ingresos</p>
                      <p className="font-semibold text-green-700">
                        {formatCurrency(totalIngresos)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-600">Egresos</p>
                      <p className="font-semibold text-red-700">
                        {formatCurrency(totalEgresos)}
                      </p>
                    </div>
                  </div>

                  {/* Saldo Actual */}
                  <div
                    className={`p-4 rounded-lg mb-4 ${
                      saldoActual >= 0
                        ? "bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200"
                        : "bg-gradient-to-r from-red-50 to-rose-50 border border-red-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-slate-600" />
                        <span className="font-medium text-slate-700">
                          Saldo Actual
                        </span>
                      </div>
                      <span
                        className={`text-xl font-bold ${
                          saldoActual >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(saldoActual)}
                      </span>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <Button
                      variant="outline"
                      className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                      onClick={() => openMovimientoDialog(cuenta, "INGRESO")}
                    >
                      <ArrowDownCircle className="h-4 w-4 mr-2" />
                      Ingreso
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                      onClick={() => openMovimientoDialog(cuenta, "EGRESO")}
                    >
                      <ArrowUpCircle className="h-4 w-4 mr-2" />
                      Egreso
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openVincularDialog(cuenta)}
                      disabled={recibos.length === 0}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Vincular Recibo
                      {recibos.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {recibos.length}
                        </Badge>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadEstadoCuenta(cuenta)}
                      disabled={isLoading}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Estado de Cuenta
                    </Button>
                  </div>

                  {/* Últimos Movimientos */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800">
                            Últimos Movimientos
                          </h4>
                          <p className="text-xs text-slate-400">
                            {cuenta.movimientos.length} registro{cuenta.movimientos.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {cuenta.movimientos.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openHistorialMovimientosDialog(cuenta)}
                          className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 gap-1"
                        >
                          <span>Ver historial</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {cuenta.movimientos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                          <FileText className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">Sin movimientos</p>
                        <p className="text-xs text-slate-400 mt-1">Registra ingresos o egresos para comenzar</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cuenta.movimientos.slice(0, 5).map((mov, index) => (
                          <div
                            key={mov.id}
                            className={`group relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-md ${
                              mov.tipo === "INGRESO"
                                ? "bg-gradient-to-r from-green-50/80 to-emerald-50/50 border-green-100 hover:border-green-200"
                                : "bg-gradient-to-r from-red-50/80 to-orange-50/50 border-red-100 hover:border-red-200"
                            }`}
                          >
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                {/* Icono y contenido principal */}
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center shadow-sm ${
                                    mov.tipo === "INGRESO"
                                      ? "bg-gradient-to-br from-green-400 to-emerald-500"
                                      : "bg-gradient-to-br from-red-400 to-orange-500"
                                  }`}>
                                    {mov.tipo === "INGRESO" ? (
                                      <ArrowDownCircle className="h-5 w-5 text-white" />
                                    ) : (
                                      <ArrowUpCircle className="h-5 w-5 text-white" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800 truncate text-sm">
                                      {mov.descripcion}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                        {formatDate(new Date(mov.fecha))}
                                      </span>
                                      {mov.transaccionId && (
                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 py-0 h-5">
                                          <Link2 className="h-3 w-3 mr-1" />
                                          Vinculado
                                        </Badge>
                                      )}
                                      {mov.servicio && (
                                        <Badge className="text-xs bg-purple-100 text-purple-700 border-0 py-0 h-5">
                                          {mov.servicio.nombre}
                                        </Badge>
                                      )}
                                      {mov.archivoUrl && (
                                        <a
                                          href={mov.archivoUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded"
                                          title="Ver archivo adjunto"
                                        >
                                          <Paperclip className="h-3 w-3" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Monto y acciones */}
                                <div className="flex flex-col items-end gap-1">
                                  <span
                                    className={`text-base font-bold tracking-tight ${
                                      mov.tipo === "INGRESO"
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {mov.tipo === "INGRESO" ? "+" : "-"}
                                    {formatCurrency(mov.monto)}
                                  </span>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditMovimientoDialog(cuenta, mov)}
                                      className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                      title={`Editar ${mov.tipo === "INGRESO" ? "ingreso" : "egreso"}`}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDeleteMovDialog(cuenta, mov)}
                                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                      title={`Eliminar ${mov.tipo === "INGRESO" ? "ingreso" : "egreso"}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Línea decorativa lateral */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                              mov.tipo === "INGRESO" ? "bg-green-400" : "bg-red-400"
                            }`}></div>
                          </div>
                        ))}
                        {cuenta.movimientos.length > 5 && (
                          <button
                            onClick={() => openHistorialMovimientosDialog(cuenta)}
                            className="w-full py-2 text-sm text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            Ver {cuenta.movimientos.length - 5} movimiento{cuenta.movimientos.length - 5 !== 1 ? 's' : ''} más
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Dialog: Crear/Editar Cuenta */}
      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedCuenta ? "Editar Cuenta Bancaria" : "Nueva Cuenta Bancaria"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitAccount} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="banco">Banco *</Label>
              <Input
                id="banco"
                placeholder="Ej: Banco Nacional"
                value={accountForm.banco}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, banco: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipoCuenta">Tipo de Cuenta *</Label>
                <Select
                  value={accountForm.tipoCuenta}
                  onValueChange={(value) =>
                    setAccountForm({ ...accountForm, tipoCuenta: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposCuenta.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numeroCuenta">Número de Cuenta *</Label>
                <Input
                  id="numeroCuenta"
                  placeholder="Ej: 123456789"
                  value={accountForm.numeroCuenta}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, numeroCuenta: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titular">Titular</Label>
              <Input
                id="titular"
                placeholder="Nombre del titular"
                value={accountForm.titular}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, titular: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="saldoInicial">Saldo Inicial</Label>
              <Input
                id="saldoInicial"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={accountForm.saldoInicial}
                onChange={(e) =>
                  setAccountForm({
                    ...accountForm,
                    saldoInicial: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                id="porDefecto"
                checked={accountForm.porDefecto}
                onChange={(e) =>
                  setAccountForm({
                    ...accountForm,
                    porDefecto: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <Label htmlFor="porDefecto" className="text-blue-800 cursor-pointer">
                  Cuenta por defecto para recibos
                </Label>
                <p className="text-xs text-blue-600">
                  Esta cuenta se seleccionará automáticamente al crear recibos de pago
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAccountDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Crear/Editar Movimiento */}
      <Dialog open={isMovimientoDialogOpen} onOpenChange={setIsMovimientoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditMode
                ? `Editar ${tipoMovimiento === "INGRESO" ? "Ingreso" : "Egreso"}`
                : tipoMovimiento === "INGRESO"
                ? "Registrar Ingreso Bancario"
                : "Registrar Egreso Bancario"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitMovimiento} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                Cuenta: <strong>{selectedCuenta?.banco}</strong>
              </p>
              <p className="text-xs text-slate-400">
                {selectedCuenta?.numeroCuenta}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monto">Monto *</Label>
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={movimientoForm.monto || ""}
                  onChange={(e) =>
                    setMovimientoForm({
                      ...movimientoForm,
                      monto: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha *</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={movimientoForm.fecha}
                  onChange={(e) =>
                    setMovimientoForm({ ...movimientoForm, fecha: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">
                Descripción {tipoMovimiento === "INGRESO" ? "*" : "(opcional)"}
              </Label>
              <Input
                id="descripcion"
                placeholder={
                  tipoMovimiento === "INGRESO"
                    ? "Ej: Depósito, Transferencia recibida"
                    : "Se generará automáticamente si selecciona un servicio"
                }
                value={movimientoForm.descripcion}
                onChange={(e) =>
                  setMovimientoForm({
                    ...movimientoForm,
                    descripcion: e.target.value,
                  })
                }
                required={tipoMovimiento === "INGRESO"}
                disabled={isEditMode && !!selectedMovimiento?.transaccionId}
                readOnly={isEditMode && !!selectedMovimiento?.transaccionId}
              />
              {isEditMode && selectedMovimiento?.transaccionId && (
                <p className="text-xs text-amber-600">
                  Este movimiento está vinculado a una transacción. La descripción no se puede editar.
                </p>
              )}
            </div>

            {tipoMovimiento === "EGRESO" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="clasificacion">Clasificación *</Label>
                  <Select
                    value={movimientoForm.clasificacion || ""}
                    onValueChange={(value) =>
                      setMovimientoForm({ ...movimientoForm, clasificacion: value as ClasificacionEgreso })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar clasificación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GASTO_COMUN">Gasto Común</SelectItem>
                      <SelectItem value="FONDO_RESERVA">Fondo de Reserva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="servicioId">Servicio / Proveedor</Label>
                  <Select
                    value={movimientoForm.servicioId || "none"}
                    onValueChange={(value) =>
                      setMovimientoForm({ ...movimientoForm, servicioId: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar servicio (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin servicio vinculado</SelectItem>
                      {servicios.map((servicio) => (
                        <SelectItem key={servicio.id} value={servicio.id}>
                          {servicio.nombre} ({servicio.tipo.replace(/_/g, " ")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="archivo">Archivo Adjunto</Label>
                  {/* Mostrar archivo existente en modo edición */}
                  {isEditMode && movimientoForm.archivoUrl && !archivoFile && (
                    <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-700">Archivo adjunto actual</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={movimientoForm.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Ver archivo"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setMovimientoForm({ ...movimientoForm, archivoUrl: "" })}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          title="Eliminar archivo"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      id="archivo"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setArchivoFile(file)
                        }
                      }}
                      className="flex-1"
                    />
                    {archivoFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setArchivoFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {archivoFile && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Upload className="h-3 w-3" />
                      Nuevo archivo: {archivoFile.name}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="referencia">Referencia</Label>
                <Input
                  id="referencia"
                  placeholder="Nº de referencia"
                  value={movimientoForm.referencia}
                  onChange={(e) =>
                    setMovimientoForm({
                      ...movimientoForm,
                      referencia: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numeroDocumento">Nº Documento</Label>
                <Input
                  id="numeroDocumento"
                  placeholder="Nº cheque/transfer"
                  value={movimientoForm.numeroDocumento}
                  onChange={(e) =>
                    setMovimientoForm({
                      ...movimientoForm,
                      numeroDocumento: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMovimientoDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || uploadingFile}
                className={
                  tipoMovimiento === "INGRESO"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }
              >
                {uploadingFile
                  ? "Subiendo archivo..."
                  : isLoading
                  ? "Guardando..."
                  : isEditMode
                  ? "Guardar Cambios"
                  : tipoMovimiento === "INGRESO"
                  ? "Registrar Ingreso"
                  : "Registrar Egreso"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Vincular Recibo */}
      <Dialog open={isVincularDialogOpen} onOpenChange={setIsVincularDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vincular Recibo de Pago como Ingreso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Selecciona un recibo de pago para registrarlo como ingreso en la
              cuenta <strong>{selectedCuenta?.banco}</strong>.
            </p>

            {recibos.length === 0 ? (
              <p className="text-center text-slate-400 py-8">
                No hay recibos pendientes de vincular
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recibos.map((recibo) => (
                  <div
                    key={recibo.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-medium text-slate-700">
                        Apto {recibo.apartamento?.numero || "N/A"}
                        <Badge variant="outline" className="ml-2">
                          {recibo.apartamento?.tipoOcupacion === "PROPIETARIO"
                            ? "Propietario"
                            : "Inquilino"}
                        </Badge>
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatDate(new Date(recibo.fecha))} -{" "}
                        {recibo.descripcion || "Recibo de pago"}
                      </p>
                      {recibo.referencia && (
                        <p className="text-xs text-slate-400">
                          Ref: {recibo.referencia}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-green-600">
                        {formatCurrency(recibo.monto)}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleVincularRecibo(recibo.id)}
                        disabled={isLoading}
                      >
                        <Link2 className="h-4 w-4 mr-1" />
                        Vincular
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setIsVincularDialogOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Historial de Movimientos */}
      <Dialog
        open={isEstadoCuentaDialogOpen}
        onOpenChange={setIsEstadoCuentaDialogOpen}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">Historial de Movimientos</DialogTitle>
                {estadoCuenta && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {estadoCuenta.cuenta.banco} - {estadoCuenta.cuenta.numeroCuenta}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
          {estadoCuenta && selectedCuenta && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4 pt-4">
              {/* Filtros Avanzados */}
              <div className="flex-shrink-0 p-4 bg-white rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">Filtros y Búsqueda</span>
                </div>

                {/* Primera fila: Búsqueda */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por descripción, referencia o documento..."
                    value={estadoCuentaFiltro.busqueda}
                    onChange={(e) => {
                      setEstadoCuentaFiltro({
                        ...estadoCuentaFiltro,
                        busqueda: e.target.value,
                      })
                      setHistorialPage(1)
                    }}
                    className="pl-10"
                  />
                </div>

                {/* Segunda fila: Filtros */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="fechaInicioHist" className="text-xs text-slate-500">Desde</Label>
                    <Input
                      id="fechaInicioHist"
                      type="date"
                      value={estadoCuentaFiltro.fechaInicio}
                      onChange={(e) =>
                        setEstadoCuentaFiltro({
                          ...estadoCuentaFiltro,
                          fechaInicio: e.target.value,
                        })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fechaFinHist" className="text-xs text-slate-500">Hasta</Label>
                    <Input
                      id="fechaFinHist"
                      type="date"
                      value={estadoCuentaFiltro.fechaFin}
                      onChange={(e) =>
                        setEstadoCuentaFiltro({
                          ...estadoCuentaFiltro,
                          fechaFin: e.target.value,
                        })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Tipo</Label>
                    <Select
                      value={estadoCuentaFiltro.tipo || "TODOS"}
                      onValueChange={(value) => {
                        setEstadoCuentaFiltro({
                          ...estadoCuentaFiltro,
                          tipo: value === "TODOS" ? "" : value as TipoMovimiento,
                        })
                        setHistorialPage(1)
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        <SelectItem value="INGRESO">Ingresos</SelectItem>
                        <SelectItem value="EGRESO">Egresos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Clasificación</Label>
                    <Select
                      value={estadoCuentaFiltro.clasificacion || "TODAS"}
                      onValueChange={(value) => {
                        setEstadoCuentaFiltro({
                          ...estadoCuentaFiltro,
                          clasificacion: value === "TODAS" ? "" : value as ClasificacionEgreso,
                        })
                        setHistorialPage(1)
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Todas</SelectItem>
                        <SelectItem value="GASTO_COMUN">Gasto Común</SelectItem>
                        <SelectItem value="FONDO_RESERVA">Fondo Reserva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      onClick={handleFiltrarEstadoCuenta}
                      disabled={isLoading}
                      className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isLoading ? "..." : "Aplicar"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => {
                        setEstadoCuentaFiltro({
                          fechaInicio: "",
                          fechaFin: "",
                          tipo: "",
                          clasificacion: "",
                          busqueda: "",
                        })
                        setHistorialPage(1)
                        handleFiltrarEstadoCuenta()
                      }}
                      title="Limpiar filtros"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Botón Exportar CSV */}
              <div className="flex-shrink-0 flex justify-end">
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  className="bg-white hover:bg-slate-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>

              {/* Tabla de Movimientos con scroll */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col border rounded-xl">
                <div className="overflow-auto flex-1">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700 w-24">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Descripción
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700 w-28">
                          Referencia
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700 w-28">
                          Ingreso
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700 w-28">
                          Egreso
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700 w-28">
                          Saldo
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-700 w-20">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Fila de Saldo Inicial */}
                      <tr className="bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-400 text-xs">-</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-600 flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-slate-400" />
                            Saldo Inicial
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">-</td>
                        <td className="px-4 py-3 text-right text-slate-400">-</td>
                        <td className="px-4 py-3 text-right text-slate-400">-</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          {formatCurrency(estadoCuenta.resumen.saldoInicial)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-400">-</td>
                      </tr>
                      {/* Filtrar y paginar movimientos */}
                      {(() => {
                        // Aplicar filtros locales
                        const tipoFiltro = estadoCuentaFiltro.tipo
                        const clasificacionFiltro = estadoCuentaFiltro.clasificacion
                        let movimientosFiltrados = estadoCuenta.movimientos.filter((mov) => {
                          const movFull = selectedCuenta.movimientos.find(m => m.id === mov.id)
                          // Filtro por tipo
                          if (tipoFiltro && tipoFiltro !== "INGRESO" && tipoFiltro !== "EGRESO") {
                            // Es "" o valor no válido, no filtrar
                          } else if (tipoFiltro && mov.tipo !== tipoFiltro) {
                            return false
                          }
                          // Filtro por clasificación
                          if (clasificacionFiltro && clasificacionFiltro !== "GASTO_COMUN" && clasificacionFiltro !== "FONDO_RESERVA") {
                            // Es "" o valor no válido, no filtrar
                          } else if (clasificacionFiltro && mov.clasificacion !== clasificacionFiltro) {
                            return false
                          }
                          // Filtro por búsqueda
                          if (estadoCuentaFiltro.busqueda) {
                            const searchLower = estadoCuentaFiltro.busqueda.toLowerCase()
                            const matchDescripcion = mov.descripcion.toLowerCase().includes(searchLower)
                            const matchReferencia = mov.referencia?.toLowerCase().includes(searchLower)
                            const matchDocumento = movFull?.numeroDocumento?.toLowerCase().includes(searchLower)
                            if (!matchDescripcion && !matchReferencia && !matchDocumento) {
                              return false
                            }
                          }
                          return true
                        })

                        // Calcular paginación
                        const totalItems = movimientosFiltrados.length
                        const totalPages = Math.ceil(totalItems / historialPageSize)
                        const startIndex = (historialPage - 1) * historialPageSize
                        const endIndex = startIndex + historialPageSize
                        const movimientosPaginados = movimientosFiltrados.slice(startIndex, endIndex)

                        return (
                          <>
                            {movimientosPaginados.map((mov) => {
                              const movCompleto = selectedCuenta.movimientos.find(m => m.id === mov.id)
                              return (
                                <tr
                                  key={mov.id}
                                  className={`hover:bg-slate-50 transition-colors ${
                                    mov.tipo === "INGRESO" ? "hover:bg-green-50/50" : "hover:bg-red-50/50"
                                  }`}
                                >
                                  <td className="px-4 py-3">
                                    <span className="text-slate-600 text-xs">
                                      {formatDate(new Date(mov.fecha))}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-start gap-2">
                                      <div className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${
                                        mov.tipo === "INGRESO"
                                          ? "bg-green-100"
                                          : "bg-red-100"
                                      }`}>
                                        {mov.tipo === "INGRESO" ? (
                                          <ArrowDownCircle className="h-4 w-4 text-green-600" />
                                        ) : (
                                          <ArrowUpCircle className="h-4 w-4 text-red-600" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-800 truncate">
                                          {mov.descripcion}
                                        </p>
                                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                          {mov.clasificacion && (
                                            <Badge variant="outline" className="text-xs py-0 h-5 bg-purple-50 text-purple-700 border-purple-200">
                                              {mov.clasificacion === "GASTO_COMUN" ? "Gasto Común" : "Fondo Reserva"}
                                            </Badge>
                                          )}
                                          {movCompleto?.transaccionId && (
                                            <Badge variant="outline" className="text-xs py-0 h-5 bg-blue-50 text-blue-600 border-blue-200">
                                              <Link2 className="h-3 w-3 mr-1" />
                                              Vinculado
                                            </Badge>
                                          )}
                                          {movCompleto?.archivoUrl && (
                                            <a
                                              href={movCompleto.archivoUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center text-xs text-blue-500 hover:text-blue-700"
                                            >
                                              <Paperclip className="h-3 w-3" />
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {mov.referencia || movCompleto?.numeroDocumento ? (
                                      <span className="text-xs text-slate-500 font-mono">
                                        {mov.referencia || movCompleto?.numeroDocumento}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {mov.tipo === "INGRESO" && (
                                      <span className="text-green-600 font-semibold">
                                        +{formatCurrency(mov.monto)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {mov.tipo === "EGRESO" && (
                                      <span className="text-red-600 font-semibold">
                                        -{formatCurrency(mov.monto)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                                    {formatCurrency(mov.saldoAcumulado)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {movCompleto && (
                                      <div className="flex items-center justify-center gap-0.5">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setIsEstadoCuentaDialogOpen(false)
                                            openEditMovimientoDialog(selectedCuenta, movCompleto)
                                          }}
                                          className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                          title={`Editar ${mov.tipo === "INGRESO" ? "ingreso" : "egreso"}`}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setIsEstadoCuentaDialogOpen(false)
                                            openDeleteMovDialog(selectedCuenta, movCompleto)
                                          }}
                                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                          title={`Eliminar ${mov.tipo === "INGRESO" ? "ingreso" : "egreso"}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                            {movimientosFiltrados.length === 0 && (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center">
                                  <div className="flex flex-col items-center">
                                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                      <Search className="h-6 w-6 text-slate-400" />
                                    </div>
                                    <p className="text-slate-500 font-medium">No se encontraron movimientos</p>
                                    <p className="text-sm text-slate-400 mt-1">Intenta ajustar los filtros de búsqueda</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {(() => {
                  const tipoFiltro = estadoCuentaFiltro.tipo
                  const clasificacionFiltro = estadoCuentaFiltro.clasificacion
                  let movimientosFiltrados = estadoCuenta.movimientos.filter((mov) => {
                    const movFull = selectedCuenta.movimientos.find(m => m.id === mov.id)
                    // Filtro por tipo
                    if (tipoFiltro === "INGRESO" || tipoFiltro === "EGRESO") {
                      if (mov.tipo !== tipoFiltro) return false
                    }
                    // Filtro por clasificación
                    if (clasificacionFiltro === "GASTO_COMUN" || clasificacionFiltro === "FONDO_RESERVA") {
                      if (mov.clasificacion !== clasificacionFiltro) return false
                    }
                    if (estadoCuentaFiltro.busqueda) {
                      const searchLower = estadoCuentaFiltro.busqueda.toLowerCase()
                      const matchDescripcion = mov.descripcion.toLowerCase().includes(searchLower)
                      const matchReferencia = mov.referencia?.toLowerCase().includes(searchLower)
                      const matchDocumento = movFull?.numeroDocumento?.toLowerCase().includes(searchLower)
                      if (!matchDescripcion && !matchReferencia && !matchDocumento) return false
                    }
                    return true
                  })
                  const totalItems = movimientosFiltrados.length
                  const totalPages = Math.ceil(totalItems / historialPageSize)

                  if (totalPages <= 1) return null

                  return (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
                      <p className="text-sm text-slate-500">
                        Mostrando {((historialPage - 1) * historialPageSize) + 1} - {Math.min(historialPage * historialPageSize, totalItems)} de {totalItems} movimientos
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistorialPage(p => Math.max(1, p - 1))}
                          disabled={historialPage === 1}
                          className="h-8"
                        >
                          Anterior
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number
                            if (totalPages <= 5) {
                              pageNum = i + 1
                            } else if (historialPage <= 3) {
                              pageNum = i + 1
                            } else if (historialPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i
                            } else {
                              pageNum = historialPage - 2 + i
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={historialPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setHistorialPage(pageNum)}
                                className={`h-8 w-8 p-0 ${historialPage === pageNum ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                              >
                                {pageNum}
                              </Button>
                            )
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistorialPage(p => Math.min(totalPages, p + 1))}
                          disabled={historialPage === totalPages}
                          className="h-8"
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta bancaria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la
              cuenta <strong>{selectedCuenta?.banco}</strong> y todos sus
              movimientos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Movimiento Confirmation */}
      <AlertDialog
        open={isDeleteMovDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteMovDialogOpen(open)
          if (!open) setInfoTransaccionVinculada(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta acción no se puede deshacer. Se eliminará el movimiento{" "}
                  <strong>{selectedMovimiento?.descripcion}</strong>.
                </p>
                {infoTransaccionVinculada?.tieneVinculo && (
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                    <p className="text-amber-800 dark:text-amber-200 font-medium flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Este movimiento está vinculado a una transacción
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Se eliminará también la transacción de tipo{" "}
                      <strong>
                        {infoTransaccionVinculada.tipo === "RECIBO_PAGO"
                          ? "Recibo de Pago"
                          : infoTransaccionVinculada.tipo}
                      </strong>
                      {infoTransaccionVinculada.apartamentoNumero && (
                        <>
                          {" "}del apartamento{" "}
                          <strong>{infoTransaccionVinculada.apartamentoNumero}</strong>
                        </>
                      )}
                      {" "}por{" "}
                      <strong>
                        {formatCurrency(infoTransaccionVinculada.monto || 0)}
                      </strong>.
                    </p>
                    {infoTransaccionVinculada.tipo === "RECIBO_PAGO" && (
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Las deudas del apartamento serán recalculadas automáticamente.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMovimiento}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading
                ? "Eliminando..."
                : infoTransaccionVinculada?.tieneVinculo
                  ? "Eliminar ambos"
                  : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
