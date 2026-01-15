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
  updateMovimientoBancario,
  deleteMovimientoBancario,
  vincularReciboConIngreso,
  getEstadoCuenta,
  type EstadoCuentaData,
} from "./actions"
import { formatCurrency, formatDate } from "@/lib/utils"
import { generateEstadoCuentaPDF } from "@/lib/pdf"

type TipoMovimiento = "INGRESO" | "EGRESO"
type ClasificacionEgreso = "GASTO_COMUN" | "FONDO_RESERVA"

type Movimiento = {
  id: string
  tipo: TipoMovimiento
  monto: number
  fecha: Date
  descripcion: string
  referencia: string | null
  numeroDocumento: string | null
  archivoUrl: string | null
  clasificacion: ClasificacionEgreso | null
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
  movimientos: Movimiento[]
}

type Recibo = {
  id: string
  monto: number
  fecha: Date
  descripcion: string | null
  referencia: string | null
  apartamento: {
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
  })

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
      }

      if (selectedCuenta) {
        const result = await updateCuentaBancaria(selectedCuenta.id, data)
        if (!result.success) {
          setError(result.error)
          return
        }
        setCuentas((prev) =>
          prev.map((c) =>
            c.id === selectedCuenta.id
              ? { ...c, ...result.data }
              : c
          )
        )
      } else {
        const result = await createCuentaBancaria(data)
        if (!result.success) {
          setError(result.error)
          return
        }
        setCuentas((prev) => [...prev, { ...result.data, movimientos: [] }])
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
      const result = await deleteCuentaBancaria(selectedCuenta.id)
      if (!result.success) {
        alert(result.error)
        return
      }
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
    setMovimientoForm({
      monto: mov.monto,
      fecha: new Date(mov.fecha).toISOString().split("T")[0],
      descripcion: mov.descripcion,
      referencia: mov.referencia || "",
      numeroDocumento: mov.numeroDocumento || "",
      clasificacion: mov.clasificacion || "",
      servicioId: mov.servicioId || "",
      archivoUrl: mov.archivoUrl || "",
    })
    setArchivoFile(null)
    setError(null)
    setIsMovimientoDialogOpen(true)
  }

  const openDeleteMovDialog = (cuenta: CuentaBancaria, mov: Movimiento) => {
    setSelectedCuenta(cuenta)
    setSelectedMovimiento(mov)
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

      const movimientoData = {
        tipo: tipoMovimiento,
        monto: movimientoForm.monto,
        fecha: new Date(movimientoForm.fecha),
        descripcion: descripcion,
        referencia: movimientoForm.referencia || null,
        numeroDocumento: movimientoForm.numeroDocumento || null,
        archivoUrl: archivoUrl,
        clasificacion: tipoMovimiento === "EGRESO" && movimientoForm.clasificacion ? movimientoForm.clasificacion : null,
        servicioId: tipoMovimiento === "EGRESO" && movimientoForm.servicioId ? movimientoForm.servicioId : null,
        cuentaBancariaId: selectedCuenta.id,
      }

      let result
      if (isEditMode && selectedMovimiento) {
        result = await updateMovimientoBancario(selectedMovimiento.id, movimientoData)
      } else {
        result = await createMovimientoBancario(movimientoData)
      }

      if (!result.success) {
        setError(result.error)
        return
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
                      id: result.data.id,
                      tipo: result.data.tipo,
                      monto: result.data.monto,
                      fecha: result.data.fecha,
                      descripcion: result.data.descripcion,
                      referencia: result.data.referencia,
                      numeroDocumento: result.data.numeroDocumento,
                      archivoUrl: result.data.archivoUrl,
                      clasificacion: result.data.clasificacion,
                      servicioId: result.data.servicioId,
                      conciliado: result.data.conciliado,
                      transaccionId: result.data.transaccionId,
                      servicio: result.data.servicio,
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
                  id: result.data.id,
                  tipo: result.data.tipo,
                  monto: result.data.monto,
                  fecha: result.data.fecha,
                  descripcion: result.data.descripcion,
                  referencia: result.data.referencia,
                  numeroDocumento: result.data.numeroDocumento,
                  archivoUrl: result.data.archivoUrl,
                  clasificacion: result.data.clasificacion,
                  servicioId: result.data.servicioId,
                  conciliado: result.data.conciliado,
                  transaccionId: result.data.transaccionId,
                  servicio: result.data.servicio,
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
      const result = await deleteMovimientoBancario(selectedMovimiento.id)
      if (!result.success) {
        alert(result.error)
        return
      }

      // Si el movimiento tenía una transacción vinculada, agregar de vuelta a recibos
      if (selectedMovimiento.transaccionId) {
        // Actualizar recibos no vinculados
        setRecibos((prev) => [...prev])
      }

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
      setIsDeleteMovDialogOpen(false)
      setSelectedMovimiento(null)
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
      if (!result.success) {
        alert(result.error)
        return
      }

      // Actualizar la cuenta con el nuevo movimiento
      setCuentas((prev) =>
        prev.map((c) =>
          c.id === selectedCuenta.id
            ? {
                ...c,
                movimientos: [
                  {
                    id: result.data.id,
                    tipo: result.data.tipo,
                    monto: result.data.monto,
                    fecha: result.data.fecha,
                    descripcion: result.data.descripcion,
                    referencia: result.data.referencia,
                    numeroDocumento: result.data.numeroDocumento,
                    archivoUrl: result.data.archivoUrl,
                    clasificacion: result.data.clasificacion,
                    servicioId: result.data.servicioId,
                    conciliado: result.data.conciliado,
                    transaccionId: result.data.transaccionId,
                    servicio: result.data.servicio,
                  },
                  ...c.movimientos,
                ],
              }
            : c
        )
      )

      // Eliminar de recibos no vinculados
      setRecibos((prev) => prev.filter((r) => r.id !== reciboId))
    } catch {
      alert("Error al vincular el recibo")
    } finally {
      setIsLoading(false)
    }
  }

  // Estado de cuenta handlers
  const openEstadoCuentaDialog = async (cuenta: CuentaBancaria) => {
    setSelectedCuenta(cuenta)
    setEstadoCuentaFiltro({ fechaInicio: "", fechaFin: "" })
    setIsLoading(true)

    try {
      const data = await getEstadoCuenta(cuenta.id)
      setEstadoCuenta(data)
      setIsEstadoCuentaDialogOpen(true)
    } catch {
      alert("Error al cargar el estado de cuenta")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFiltrarEstadoCuenta = async () => {
    if (!selectedCuenta) return
    setIsLoading(true)

    try {
      const fechaInicio = estadoCuentaFiltro.fechaInicio
        ? new Date(estadoCuentaFiltro.fechaInicio)
        : undefined
      const fechaFin = estadoCuentaFiltro.fechaFin
        ? new Date(estadoCuentaFiltro.fechaFin + "T23:59:59")
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
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Gestión Bancaria
      </h1>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por banco o número de cuenta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={openCreateAccountDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cuenta
        </Button>
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
                        <CardTitle className="text-lg">{cuenta.banco}</CardTitle>
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
                      onClick={() => openEstadoCuentaDialog(cuenta)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Estado de Cuenta
                    </Button>
                  </div>

                  {/* Últimos Movimientos */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">
                      Últimos Movimientos
                    </h4>
                    {cuenta.movimientos.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">
                        Sin movimientos
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {cuenta.movimientos.slice(0, 5).map((mov) => (
                          <div
                            key={mov.id}
                            className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm"
                          >
                            <div className="flex items-center gap-2">
                              {mov.tipo === "INGRESO" ? (
                                <ArrowDownCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <ArrowUpCircle className="h-4 w-4 text-red-500" />
                              )}
                              <div>
                                <p className="font-medium text-slate-700 truncate max-w-[150px]">
                                  {mov.descripcion}
                                </p>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <p className="text-xs text-slate-400">
                                    {formatDate(new Date(mov.fecha))}
                                  </p>
                                  {mov.transaccionId && (
                                    <Badge variant="outline" className="text-xs">
                                      Vinculado
                                    </Badge>
                                  )}
                                  {mov.servicio && (
                                    <Badge variant="secondary" className="text-xs">
                                      {mov.servicio.nombre}
                                    </Badge>
                                  )}
                                  {mov.archivoUrl && (
                                    <a
                                      href={mov.archivoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:text-blue-700"
                                      title="Ver archivo adjunto"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span
                                className={`font-semibold ${
                                  mov.tipo === "INGRESO"
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {mov.tipo === "INGRESO" ? "+" : "-"}
                                {formatCurrency(mov.monto)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditMovimientoDialog(cuenta, mov)}
                                className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600"
                                title="Editar"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteMovDialog(cuenta, mov)}
                                className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                                title="Eliminar"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
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
              />
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

      {/* Dialog: Estado de Cuenta */}
      <Dialog
        open={isEstadoCuentaDialogOpen}
        onOpenChange={setIsEstadoCuentaDialogOpen}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estado de Cuenta Bancario</DialogTitle>
          </DialogHeader>
          {estadoCuenta && (
            <div className="space-y-4">
              {/* Info Cuenta */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {estadoCuenta.cuenta.banco}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {estadoCuenta.cuenta.tipoCuenta} -{" "}
                      {estadoCuenta.cuenta.numeroCuenta}
                    </p>
                    {estadoCuenta.cuenta.titular && (
                      <p className="text-xs text-slate-400">
                        {estadoCuenta.cuenta.titular}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" onClick={handleExportEstadoCuenta}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </div>

              {/* Filtros de Fecha */}
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="fechaInicio">Desde</Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    value={estadoCuentaFiltro.fechaInicio}
                    onChange={(e) =>
                      setEstadoCuentaFiltro({
                        ...estadoCuentaFiltro,
                        fechaInicio: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="fechaFin">Hasta</Label>
                  <Input
                    id="fechaFin"
                    type="date"
                    value={estadoCuentaFiltro.fechaFin}
                    onChange={(e) =>
                      setEstadoCuentaFiltro({
                        ...estadoCuentaFiltro,
                        fechaFin: e.target.value,
                      })
                    }
                  />
                </div>
                <Button onClick={handleFiltrarEstadoCuenta} disabled={isLoading}>
                  Filtrar
                </Button>
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-xs text-slate-500">Saldo Inicial</p>
                  <p className="text-lg font-bold text-slate-700">
                    {formatCurrency(estadoCuenta.resumen.saldoInicial)}
                  </p>
                </Card>
                <Card className="p-4 text-center bg-green-50">
                  <p className="text-xs text-green-600">Ingresos</p>
                  <p className="text-lg font-bold text-green-700">
                    +{formatCurrency(estadoCuenta.resumen.totalIngresos)}
                  </p>
                </Card>
                <Card className="p-4 text-center bg-red-50">
                  <p className="text-xs text-red-600">Egresos</p>
                  <p className="text-lg font-bold text-red-700">
                    -{formatCurrency(estadoCuenta.resumen.totalEgresos)}
                  </p>
                </Card>
                <Card
                  className={`p-4 text-center ${
                    estadoCuenta.resumen.saldoFinal >= 0
                      ? "bg-blue-50"
                      : "bg-orange-50"
                  }`}
                >
                  <p
                    className={`text-xs ${
                      estadoCuenta.resumen.saldoFinal >= 0
                        ? "text-blue-600"
                        : "text-orange-600"
                    }`}
                  >
                    Saldo Final
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      estadoCuenta.resumen.saldoFinal >= 0
                        ? "text-blue-700"
                        : "text-orange-700"
                    }`}
                  >
                    {formatCurrency(estadoCuenta.resumen.saldoFinal)}
                  </p>
                </Card>
              </div>

              {/* Tabla de Movimientos */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-700">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-700">
                        Descripción
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-slate-700">
                        Ingreso
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-slate-700">
                        Egreso
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-slate-700">
                        Saldo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t bg-slate-50">
                      <td className="px-4 py-2 text-slate-500">-</td>
                      <td className="px-4 py-2 font-medium text-slate-600">
                        Saldo Inicial
                      </td>
                      <td className="px-4 py-2 text-right">-</td>
                      <td className="px-4 py-2 text-right">-</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatCurrency(estadoCuenta.resumen.saldoInicial)}
                      </td>
                    </tr>
                    {estadoCuenta.movimientos.map((mov) => (
                      <tr key={mov.id} className="border-t hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-600">
                          {formatDate(new Date(mov.fecha))}
                        </td>
                        <td className="px-4 py-2">
                          <div>
                            <p className="text-slate-700">{mov.descripcion}</p>
                            {mov.clasificacion && (
                              <p className="text-xs text-slate-400">
                                {mov.clasificacion === "GASTO_COMUN" ? "Gasto Común" : "Fondo de Reserva"}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {mov.tipo === "INGRESO" && (
                            <span className="text-green-600 font-medium">
                              +{formatCurrency(mov.monto)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {mov.tipo === "EGRESO" && (
                            <span className="text-red-600 font-medium">
                              -{formatCurrency(mov.monto)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-slate-700">
                          {formatCurrency(mov.saldoAcumulado)}
                        </td>
                      </tr>
                    ))}
                    {estadoCuenta.movimientos.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          No hay movimientos en el período seleccionado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
        onOpenChange={setIsDeleteMovDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el movimiento{" "}
              <strong>{selectedMovimiento?.descripcion}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMovimiento}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
