"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TrendingUp,
  TrendingDown,
  Download,
  FileSpreadsheet,
  CreditCard,
  Receipt,
  Filter,
  Pencil,
  Trash2,
  Calendar,
  X,
  Building,
  Star,
  Landmark,
  AlertTriangle,
  MessageCircle,
  Mail,
  FileText,
} from "lucide-react"
import { formatCurrency, formatDate, formatPhoneForWhatsApp } from "@/lib/utils"
import {
  createTransaccion,
  createVentaCredito,
  createReciboPago,
  updateTransaccion,
  updateReciboPago,
  updateVentaCredito,
  deleteTransaccion,
  obtenerDeudasPorConcepto,
  calcularDistribucionPago,
  getInfoBancoVinculadoTransaccion,
  obtenerSaldosCuentaCorriente,
  type Transaccion as DBTransaccion,
  type DeudasPorConcepto,
  type DistribucionPago,
  type InfoBancoVinculado,
} from "@/lib/database"
import { generateTransaccionesPDF, downloadReciboPagoPDF, type ReciboPagoData } from "@/lib/pdf"
import { toast } from "@/hooks/use-toast"

type Apartamento = {
  id: string
  numero: string
  tipoOcupacion: "PROPIETARIO" | "INQUILINO"
  contactoNombre?: string | null
  contactoApellido?: string | null
  contactoCelular?: string | null
  contactoEmail?: string | null
}

type CuentaBancaria = {
  id: string
  banco: string
  tipoCuenta: string
  numeroCuenta: string
  porDefecto?: boolean
}

type Transaccion = {
  id: string
  tipo: string
  monto: number
  fecha: Date | string
  categoria: string | null
  descripcion: string | null
  referencia: string | null
  metodoPago: string | null
  notas: string | null
  estadoCredito: string | null
  montoPagado: number | null
  apartamentoId: string | null
  apartamento?: Apartamento | null
  clasificacionPago?: string | null
  montoGastoComun?: number | null
  montoFondoReserva?: number | null
  cuentaBancariaId?: string | null
}

type Props = {
  initialTransacciones: Transaccion[]
  apartamentos: Apartamento[]
  cuentasBancarias: CuentaBancaria[]
}

const tipoLabels: Record<string, string> = {
  INGRESO: "Ingreso",
  EGRESO: "Egreso",
  VENTA_CREDITO: "Venta Crédito",
  RECIBO_PAGO: "Recibo de Pago",
}

const categoriaLabels: Record<string, string> = {
  GASTOS_COMUNES: "Gastos Comunes",
  FONDO_RESERVA: "Fondo de Reserva",
  MANTENIMIENTO: "Mantenimiento",
  SERVICIOS: "Servicios",
  ADMINISTRACION: "Administración",
  REPARACIONES: "Reparaciones",
  LIMPIEZA: "Limpieza",
  SEGURIDAD: "Seguridad",
  OTROS: "Otros",
}

const estadoCreditoColors: Record<string, "destructive" | "warning" | "success"> = {
  PENDIENTE: "destructive",
  PARCIAL: "warning",
  PAGADO: "success",
}

export function TransaccionesClient({ initialTransacciones, apartamentos, cuentasBancarias }: Props) {
  const [transacciones, setTransacciones] = useState(initialTransacciones)
  const [filter, setFilter] = useState("todos")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [filterApartamento, setFilterApartamento] = useState("todos")
  const [isTransaccionDialogOpen, setIsTransaccionDialogOpen] = useState(false)
  const [isVentaCreditoDialogOpen, setIsVentaCreditoDialogOpen] = useState(false)
  const [isReciboPagoDialogOpen, setIsReciboPagoDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingTransaccion, setEditingTransaccion] = useState<Transaccion | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [transaccionToDelete, setTransaccionToDelete] = useState<string | null>(null)
  const [infoBancoVinculado, setInfoBancoVinculado] = useState<InfoBancoVinculado | null>(null)
  const [infoBancoVinculadoEdit, setInfoBancoVinculadoEdit] = useState<InfoBancoVinculado | null>(null)

  const [transaccionForm, setTransaccionForm] = useState({
    tipo: "INGRESO",
    monto: "",
    categoria: "",
    apartamentoId: "",
    fecha: new Date().toISOString().split("T")[0],
    metodoPago: "EFECTIVO",
    descripcion: "",
    referencia: "",
    notas: "",
  })

  const [ventaCreditoForm, setVentaCreditoForm] = useState({
    monto: "",
    apartamentoId: "",
    fecha: new Date().toISOString().split("T")[0],
    descripcion: "Gastos Comunes",
    notas: "",
    categoria: "GASTOS_COMUNES" as "GASTOS_COMUNES" | "FONDO_RESERVA",
  })

  // Obtener la cuenta bancaria por defecto
  const cuentaPorDefecto = cuentasBancarias.find((c) => c.porDefecto)

  const [reciboPagoForm, setReciboPagoForm] = useState({
    monto: "",
    apartamentoId: "",
    fecha: new Date().toISOString().split("T")[0],
    metodoPago: "TRANSFERENCIA",
    cuentaBancariaId: "",
    referencia: "",
    notas: "",
    clasificacionPago: "GASTO_COMUN" as "GASTO_COMUN" | "FONDO_RESERVA",
    excedentePara: "GASTO_COMUN" as "GASTO_COMUN" | "FONDO_RESERVA",
  })

  // Estados para deudas y distribución automática
  const [deudaApartamento, setDeudaApartamento] = useState<DeudasPorConcepto | null>(null)
  const [distribucionPago, setDistribucionPago] = useState<DistribucionPago | null>(null)
  const [cargandoDeuda, setCargandoDeuda] = useState(false)

  // Estado para saldos de cuenta corriente (para recibos de pago)
  const [saldosCuentaCorriente, setSaldosCuentaCorriente] = useState<Record<string, number>>({})

  // Efecto para cargar deudas cuando se selecciona un apartamento
  useEffect(() => {
    const cargarDeudas = async () => {
      if (!reciboPagoForm.apartamentoId) {
        setDeudaApartamento(null)
        setDistribucionPago(null)
        return
      }

      setCargandoDeuda(true)
      try {
        const deudas = await obtenerDeudasPorConcepto(reciboPagoForm.apartamentoId)
        setDeudaApartamento(deudas)
      } catch (error) {
        console.error("Error al cargar deudas:", error)
        setDeudaApartamento(null)
      } finally {
        setCargandoDeuda(false)
      }
    }

    cargarDeudas()
  }, [reciboPagoForm.apartamentoId])

  // Efecto para calcular distribución cuando cambia el monto
  useEffect(() => {
    const calcularDistribucion = async () => {
      if (!reciboPagoForm.apartamentoId || !reciboPagoForm.monto) {
        setDistribucionPago(null)
        return
      }

      const montoNum = parseFloat(reciboPagoForm.monto)
      if (isNaN(montoNum) || montoNum <= 0) {
        setDistribucionPago(null)
        return
      }

      try {
        const distribucion = await calcularDistribucionPago(reciboPagoForm.apartamentoId, montoNum)
        setDistribucionPago(distribucion)
      } catch (error) {
        console.error("Error al calcular distribución:", error)
        setDistribucionPago(null)
      }
    }

    calcularDistribucion()
  }, [reciboPagoForm.apartamentoId, reciboPagoForm.monto])

  // Efecto para establecer la cuenta por defecto cuando se carga
  useEffect(() => {
    if (cuentaPorDefecto && !reciboPagoForm.cuentaBancariaId) {
      setReciboPagoForm(prev => ({
        ...prev,
        cuentaBancariaId: cuentaPorDefecto.id
      }))
    }
  }, [cuentaPorDefecto, reciboPagoForm.cuentaBancariaId])

  // Efecto para cargar saldos de cuenta corriente
  useEffect(() => {
    const cargarSaldos = async () => {
      try {
        const saldos = await obtenerSaldosCuentaCorriente()
        setSaldosCuentaCorriente(saldos)
      } catch (error) {
        console.error("Error al cargar saldos:", error)
      }
    }
    cargarSaldos()
  }, [transacciones]) // Recargar cuando cambien las transacciones

  const [editForm, setEditForm] = useState({
    tipo: "INGRESO",
    monto: "",
    categoria: "",
    apartamentoId: "",
    fecha: new Date().toISOString().split("T")[0],
    metodoPago: "EFECTIVO",
    descripcion: "",
    referencia: "",
    notas: "",
    clasificacionPago: "GASTO_COMUN" as "GASTO_COMUN" | "FONDO_RESERVA",
    cuentaBancariaId: "",
  })

  // Memoizar filtrado para evitar re-cálculos en cada render
  const filteredTransacciones = useMemo(() => {
    return transacciones.filter((t) => {
      // Filtro por tipo
      if (filter === "ingresos" && t.tipo !== "INGRESO" && t.tipo !== "RECIBO_PAGO") return false
      if (filter === "egresos" && t.tipo !== "EGRESO") return false
      if (filter === "creditos" && t.tipo !== "VENTA_CREDITO") return false

      // Filtro por fecha
      if (fechaDesde || fechaHasta) {
        const fechaTransaccion = typeof t.fecha === 'string'
          ? new Date(t.fecha)
          : t.fecha
        const fechaStr = fechaTransaccion.toISOString().split("T")[0]

        if (fechaDesde && fechaStr < fechaDesde) return false
        if (fechaHasta && fechaStr > fechaHasta) return false
      }

      // Filtro por apartamento (combinado con tipo de ocupación)
      if (filterApartamento !== "todos" && t.apartamentoId !== filterApartamento) return false

      return true
    })
  }, [transacciones, filter, fechaDesde, fechaHasta, filterApartamento])

  const limpiarFiltroFechas = () => {
    setFechaDesde("")
    setFechaHasta("")
  }

  const limpiarFiltrosApartamento = () => {
    setFilterApartamento("todos")
  }

  const hayFiltroFechas = fechaDesde || fechaHasta
  const hayFiltroApartamento = filterApartamento !== "todos"

  // Memoizar cálculos de estadísticas
  const { ingresosGastosComunes, ingresosFondoReserva, totalIngresos, creditosPendientes } = useMemo(() => {
    let gastosComunes = 0
    let fondoReserva = 0
    let total = 0
    let pendientes = 0

    for (const t of transacciones) {
      if (t.tipo === "RECIBO_PAGO") {
        total += t.monto
        if (t.clasificacionPago === "GASTO_COMUN") {
          gastosComunes += t.monto
        } else if (t.clasificacionPago === "FONDO_RESERVA") {
          fondoReserva += t.monto
        }
      } else if (t.tipo === "VENTA_CREDITO" && t.estadoCredito !== "PAGADO") {
        pendientes += t.monto - (t.montoPagado || 0)
      }
    }

    return {
      ingresosGastosComunes: gastosComunes,
      ingresosFondoReserva: fondoReserva,
      totalIngresos: total,
      creditosPendientes: pendientes
    }
  }, [transacciones])

  const resetTransaccionForm = () => {
    setTransaccionForm({
      tipo: "INGRESO",
      monto: "",
      categoria: "",
      apartamentoId: "",
      fecha: new Date().toISOString().split("T")[0],
      metodoPago: "EFECTIVO",
      descripcion: "",
      referencia: "",
      notas: "",
    })
  }

  const handleTransaccionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    if (!transaccionForm.monto || parseFloat(transaccionForm.monto) <= 0) {
      alert("El monto debe ser mayor a 0")
      return
    }

    setIsLoading(true)

    try {
      // Crear fecha sin problemas de zona horaria (usar mediodía UTC)
      const fechaParts = transaccionForm.fecha.split('-')
      const fechaCorrecta = new Date(Date.UTC(
        parseInt(fechaParts[0]),
        parseInt(fechaParts[1]) - 1,
        parseInt(fechaParts[2]),
        12, 0, 0
      ))

      const data = {
        tipo: transaccionForm.tipo as "INGRESO" | "EGRESO",
        monto: parseFloat(transaccionForm.monto),
        categoria: transaccionForm.categoria || null,
        apartamentoId: transaccionForm.apartamentoId || null,
        fecha: fechaCorrecta.toISOString(),
        metodoPago: transaccionForm.metodoPago,
        descripcion: transaccionForm.descripcion || null,
        referencia: transaccionForm.referencia || null,
        notas: transaccionForm.notas || null,
        estadoCredito: null,
        montoPagado: null,
        clasificacionPago: null,
        montoGastoComun: null,
        montoFondoReserva: null,
      }

      const created = await createTransaccion(data)
      const aptData = transaccionForm.apartamentoId
        ? apartamentos.find(a => a.id === transaccionForm.apartamentoId) || null
        : null
      setTransacciones((prev) => [{ ...created, apartamento: aptData } as Transaccion, ...prev])
      setIsTransaccionDialogOpen(false)
      resetTransaccionForm()
    } catch (error) {
      console.error("Error creating transaccion:", error)
      alert("Error al registrar la transacción. Intente nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVentaCreditoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    if (!ventaCreditoForm.apartamentoId) {
      alert("Debe seleccionar un apartamento")
      return
    }
    if (!ventaCreditoForm.monto || parseFloat(ventaCreditoForm.monto) <= 0) {
      alert("El monto debe ser mayor a 0")
      return
    }

    setIsLoading(true)

    try {
      // Crear fecha sin problemas de zona horaria (usar mediodía UTC)
      const fechaParts = ventaCreditoForm.fecha.split('-')
      const fechaCorrecta = new Date(Date.UTC(
        parseInt(fechaParts[0]),
        parseInt(fechaParts[1]) - 1,
        parseInt(fechaParts[2]),
        12, 0, 0
      ))

      const data = {
        monto: parseFloat(ventaCreditoForm.monto),
        apartamentoId: ventaCreditoForm.apartamentoId,
        fecha: fechaCorrecta.toISOString(),
        categoria: ventaCreditoForm.categoria,
        descripcion: ventaCreditoForm.descripcion || (ventaCreditoForm.categoria === "GASTOS_COMUNES" ? "Gastos Comunes" : "Fondo de Reserva"),
      }

      const created = await createVentaCredito(data)
      const aptData = apartamentos.find(a => a.id === ventaCreditoForm.apartamentoId) || null
      setTransacciones((prev) => [{ ...created, apartamento: aptData } as Transaccion, ...prev])
      setIsVentaCreditoDialogOpen(false)
      setVentaCreditoForm({
        monto: "",
        apartamentoId: "",
        fecha: new Date().toISOString().split("T")[0],
        descripcion: "Gastos Comunes",
        notas: "",
        categoria: "GASTOS_COMUNES",
      })
    } catch (error) {
      console.error("Error creating venta credito:", error)
      alert("Error al registrar la venta a crédito. Intente nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReciboPagoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    if (!reciboPagoForm.apartamentoId) {
      alert("Debe seleccionar un apartamento")
      return
    }
    if (!reciboPagoForm.monto || parseFloat(reciboPagoForm.monto) <= 0) {
      alert("El monto debe ser mayor a 0")
      return
    }

    setIsLoading(true)

    try {
      // Crear fecha sin problemas de zona horaria (usar mediodía UTC)
      const fechaParts = reciboPagoForm.fecha.split('-')
      const fechaCorrecta = new Date(Date.UTC(
        parseInt(fechaParts[0]),
        parseInt(fechaParts[1]) - 1,
        parseInt(fechaParts[2]),
        12, 0, 0
      ))

      // Determinar si hay deuda pendiente para usar distribución automática
      const tieneDeuda = !!(deudaApartamento && deudaApartamento.total > 0)
      const tieneExcedente = !!(distribucionPago && distribucionPago.excedente > 0)

      const data = {
        monto: parseFloat(reciboPagoForm.monto),
        apartamentoId: reciboPagoForm.apartamentoId,
        fecha: fechaCorrecta.toISOString(),
        metodoPago: reciboPagoForm.metodoPago,
        cuentaBancariaId: reciboPagoForm.cuentaBancariaId || null,
        referencia: reciboPagoForm.referencia || null,
        notas: reciboPagoForm.notas || null,
        clasificacionPago: reciboPagoForm.clasificacionPago as "GASTO_COMUN" | "FONDO_RESERVA",
        // Usar distribución automática si hay deuda pendiente
        usarDistribucionAutomatica: tieneDeuda,
        excedentePara: tieneExcedente ? reciboPagoForm.excedentePara : undefined,
      }

      const created = await createReciboPago(data)
      const aptData = apartamentos.find(a => a.id === reciboPagoForm.apartamentoId) || null
      setTransacciones((prev) => [{ ...created, apartamento: aptData } as Transaccion, ...prev])
      setIsReciboPagoDialogOpen(false)
      setReciboPagoForm({
        monto: "",
        apartamentoId: "",
        fecha: new Date().toISOString().split("T")[0],
        metodoPago: "TRANSFERENCIA",
        cuentaBancariaId: cuentaPorDefecto?.id || "",
        referencia: "",
        notas: "",
        clasificacionPago: "GASTO_COMUN",
        excedentePara: "GASTO_COMUN",
      })
      setDeudaApartamento(null)
      setDistribucionPago(null)
    } catch (error) {
      console.error("Error creating recibo pago:", error)
      alert("Error al registrar el pago. Intente nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = useCallback(() => {
    generateTransaccionesPDF(filteredTransacciones)
    toast({
      title: "PDF descargado",
      description: "Reporte de transacciones descargado correctamente",
      variant: "success",
    })
  }, [filteredTransacciones])

  const handleExportCSV = useCallback(() => {
    const headers = ["Fecha", "Tipo", "Categoría", "Apartamento", "Descripción", "Método de Pago", "Referencia", "Monto"]

    const rows = filteredTransacciones.map((t) => {
      const fecha = typeof t.fecha === 'string'
        ? new Date(t.fecha).toLocaleDateString('es-ES')
        : t.fecha.toLocaleDateString('es-ES')
      const tipo = tipoLabels[t.tipo] || t.tipo
      const categoria = t.categoria ? (categoriaLabels[t.categoria] || t.categoria) : ""
      const apartamento = t.apartamento ? `Apto ${t.apartamento.numero}` : "General"
      const descripcion = t.descripcion || ""
      const metodoPago = t.metodoPago || ""
      const referencia = t.referencia || ""
      const monto = t.tipo === "EGRESO" ? -t.monto : t.monto

      return [fecha, tipo, categoria, apartamento, descripcion, metodoPago, referencia, monto.toFixed(2)]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `transacciones_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "CSV descargado",
      description: "Transacciones exportadas correctamente",
      variant: "success",
    })
  }, [filteredTransacciones])

  const handleOpenEdit = useCallback(async (transaccion: Transaccion) => {
    setEditingTransaccion(transaccion)
    // Extraer fecha en formato YYYY-MM-DD usando UTC para evitar problemas de zona horaria
    const d = typeof transaccion.fecha === 'string' ? new Date(transaccion.fecha) : transaccion.fecha
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const fechaStr = `${year}-${month}-${day}`

    setEditForm({
      tipo: transaccion.tipo,
      monto: transaccion.monto.toString(),
      categoria: transaccion.categoria || "",
      apartamentoId: transaccion.apartamentoId || "",
      fecha: fechaStr,
      metodoPago: transaccion.metodoPago || "TRANSFERENCIA",
      descripcion: transaccion.descripcion || "",
      referencia: transaccion.referencia || "",
      notas: transaccion.notas || "",
      clasificacionPago: (transaccion.clasificacionPago as "GASTO_COMUN" | "FONDO_RESERVA") || "GASTO_COMUN",
      cuentaBancariaId: transaccion.cuentaBancariaId || "",
    })

    // Obtener info del banco vinculado para mostrar aviso
    const infoBanco = await getInfoBancoVinculadoTransaccion(transaccion.id)
    setInfoBancoVinculadoEdit(infoBanco)

    setIsEditDialogOpen(true)
  }, [])

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTransaccion) return
    setIsLoading(true)

    try {
      // Crear fecha sin problemas de zona horaria (usar mediodía UTC)
      const fechaParts = editForm.fecha.split('-')
      const fechaCorrecta = new Date(Date.UTC(
        parseInt(fechaParts[0]),
        parseInt(fechaParts[1]) - 1,
        parseInt(fechaParts[2]),
        12, 0, 0
      ))

      let updated
      if (editForm.tipo === "RECIBO_PAGO") {
        // Usar función específica para recibos de pago que maneja la cuenta bancaria
        updated = await updateReciboPago(editingTransaccion.id, {
          monto: parseFloat(editForm.monto),
          apartamentoId: editForm.apartamentoId || undefined,
          fecha: fechaCorrecta.toISOString(),
          metodoPago: editForm.metodoPago || undefined,
          referencia: editForm.referencia || null,
          notas: editForm.notas || null,
          clasificacionPago: editForm.clasificacionPago,
          cuentaBancariaId: editForm.cuentaBancariaId || null,
        })
      } else if (editForm.tipo === "VENTA_CREDITO") {
        // Usar función específica para ventas a crédito que actualiza la descripción
        updated = await updateVentaCredito(editingTransaccion.id, {
          monto: parseFloat(editForm.monto),
          apartamentoId: editForm.apartamentoId || undefined,
          fecha: fechaCorrecta.toISOString(),
          categoria: editForm.categoria as "GASTOS_COMUNES" | "FONDO_RESERVA" || undefined,
        })
      } else {
        const data = {
          tipo: editForm.tipo as "INGRESO" | "EGRESO" | "VENTA_CREDITO" | "RECIBO_PAGO",
          monto: parseFloat(editForm.monto),
          categoria: editForm.categoria || null,
          apartamentoId: editForm.apartamentoId || null,
          fecha: fechaCorrecta.toISOString(),
          metodoPago: editForm.metodoPago || null,
          descripcion: editForm.descripcion || null,
          referencia: editForm.referencia || null,
          notas: editForm.notas || null,
          clasificacionPago: null,
        }
        updated = await updateTransaccion(editingTransaccion.id, data)
      }

      const aptData = editForm.apartamentoId
        ? apartamentos.find(a => a.id === editForm.apartamentoId) || null
        : null
      setTransacciones((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...updated, apartamento: aptData, cuentaBancariaId: editForm.cuentaBancariaId || null } as Transaccion : t))
      )

      // Mostrar toast de confirmación
      if (infoBancoVinculadoEdit?.tieneVinculo) {
        toast({
          title: "Transacción y movimiento bancario actualizados",
          description: `Se sincronizaron los cambios con el movimiento en ${infoBancoVinculadoEdit.banco}.`,
        })
      }

      setIsEditDialogOpen(false)
      setEditingTransaccion(null)
      setInfoBancoVinculadoEdit(null)
    } catch (error) {
      console.error("Error updating transaccion:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteClick = async (id: string) => {
    setTransaccionToDelete(id)
    // Verificar si tiene banco vinculado antes de mostrar el diálogo
    const infoBanco = await getInfoBancoVinculadoTransaccion(id)
    setInfoBancoVinculado(infoBanco)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!transaccionToDelete) return
    setIsLoading(true)

    try {
      await deleteTransaccion(transaccionToDelete)
      setTransacciones((prev) => prev.filter((t) => t.id !== transaccionToDelete))
      toast({
        title: "Transacción eliminada",
        description: infoBancoVinculado?.tieneVinculo
          ? "La transacción y su movimiento bancario se eliminaron correctamente"
          : "La transacción se eliminó correctamente",
        variant: "success",
      })
    } catch (error) {
      console.error("Error deleting transaccion:", error)
      toast({
        title: "Error al eliminar",
        description: error instanceof Error ? error.message : "No se pudo eliminar la transacción",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsDeleteDialogOpen(false)
      setTransaccionToDelete(null)
      setInfoBancoVinculado(null)
    }
  }

  // Función para preparar datos del recibo de pago
  const prepareReciboData = useCallback((t: Transaccion): ReciboPagoData | null => {
    if (t.tipo !== "RECIBO_PAGO" || !t.apartamentoId) return null

    const aptData = apartamentos.find(a => a.id === t.apartamentoId)
    if (!aptData) return null

    const fechaStr = typeof t.fecha === 'string' ? t.fecha : t.fecha.toISOString()
    const saldoFinal = saldosCuentaCorriente[t.apartamentoId] || 0

    return {
      apartamentoNumero: aptData.numero,
      fecha: fechaStr,
      monto: t.monto,
      metodoPago: t.metodoPago || "OTRO",
      referencia: t.referencia,
      conceptos: {
        gastosComunes: t.montoGastoComun || (t.clasificacionPago === "GASTO_COMUN" ? t.monto : 0),
        fondoReserva: t.montoFondoReserva || (t.clasificacionPago === "FONDO_RESERVA" ? t.monto : 0),
      },
      saldoFinal,
    }
  }, [apartamentos, saldosCuentaCorriente])

  // Función para descargar el recibo en PDF
  const handleDownloadRecibo = useCallback((t: Transaccion) => {
    const reciboData = prepareReciboData(t)
    if (!reciboData) {
      toast({
        title: "Error",
        description: "No se pudo generar el recibo",
        variant: "destructive",
      })
      return
    }
    downloadReciboPagoPDF(reciboData)
    toast({
      title: "Recibo descargado",
      description: `Comprobante de pago del Apto ${reciboData.apartamentoNumero}`,
      variant: "success",
    })
  }, [prepareReciboData])

  // Función para enviar recibo por WhatsApp
  const handleShareWhatsApp = useCallback((t: Transaccion) => {
    const reciboData = prepareReciboData(t)
    if (!reciboData || !t.apartamentoId) return

    const aptData = apartamentos.find(a => a.id === t.apartamentoId)
    if (!aptData?.contactoCelular) {
      toast({
        title: "Sin número de teléfono",
        description: "Este apartamento no tiene un número de celular registrado",
        variant: "destructive",
      })
      return
    }

    const fechaFormateada = new Date(reciboData.fecha).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    })

    const saldoTexto = reciboData.saldoFinal > 0
      ? `Saldo deudor: $${reciboData.saldoFinal.toLocaleString()}`
      : reciboData.saldoFinal < 0
        ? `Saldo a favor: $${Math.abs(reciboData.saldoFinal).toLocaleString()}`
        : "Cuenta al día"

    // Construir detalle de conceptos
    let conceptosTexto = ""
    if (reciboData.conceptos.gastosComunes > 0) {
      conceptosTexto += `• Gastos Comunes: $${reciboData.conceptos.gastosComunes.toLocaleString()}\n`
    }
    if (reciboData.conceptos.fondoReserva > 0) {
      conceptosTexto += `• Fondo de Reserva: $${reciboData.conceptos.fondoReserva.toLocaleString()}\n`
    }
    if (!conceptosTexto) {
      conceptosTexto = `• Pago a cuenta: $${reciboData.monto.toLocaleString()}\n`
    }

    const message = `*COMPROBANTE DE PAGO*
Edificio Constituyente II

*Apartamento:* ${reciboData.apartamentoNumero}
*Fecha:* ${fechaFormateada}

*Conceptos abonados:*
${conceptosTexto}
*Total abonado:* $${reciboData.monto.toLocaleString()}

*${saldoTexto}*

_Este mensaje es un comprobante de pago._`

    const phone = formatPhoneForWhatsApp(aptData.contactoCelular)
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(url, "_blank")

    toast({
      title: "WhatsApp abierto",
      description: "Se abrió WhatsApp con el comprobante de pago",
      variant: "success",
    })
  }, [apartamentos, prepareReciboData])

  // Función para enviar recibo por Email
  const handleShareEmail = useCallback((t: Transaccion) => {
    const reciboData = prepareReciboData(t)
    if (!reciboData || !t.apartamentoId) return

    const aptData = apartamentos.find(a => a.id === t.apartamentoId)
    if (!aptData?.contactoEmail) {
      toast({
        title: "Sin email",
        description: "Este apartamento no tiene un email registrado",
        variant: "destructive",
      })
      return
    }

    const fechaFormateada = new Date(reciboData.fecha).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    })

    const saldoTexto = reciboData.saldoFinal > 0
      ? `Saldo deudor: $${reciboData.saldoFinal.toLocaleString()}`
      : reciboData.saldoFinal < 0
        ? `Saldo a favor: $${Math.abs(reciboData.saldoFinal).toLocaleString()}`
        : "Cuenta al día"

    // Construir detalle de conceptos
    let conceptosTexto = ""
    if (reciboData.conceptos.gastosComunes > 0) {
      conceptosTexto += `- Gastos Comunes: $${reciboData.conceptos.gastosComunes.toLocaleString()}%0D%0A`
    }
    if (reciboData.conceptos.fondoReserva > 0) {
      conceptosTexto += `- Fondo de Reserva: $${reciboData.conceptos.fondoReserva.toLocaleString()}%0D%0A`
    }
    if (!conceptosTexto) {
      conceptosTexto = `- Pago a cuenta: $${reciboData.monto.toLocaleString()}%0D%0A`
    }

    const subject = encodeURIComponent(`Comprobante de Pago - Apto ${reciboData.apartamentoNumero} - ${fechaFormateada}`)
    const body = `COMPROBANTE DE PAGO%0D%0AEdificio Constituyente II%0D%0A%0D%0AApartamento: ${reciboData.apartamentoNumero}%0D%0AFecha: ${fechaFormateada}%0D%0A%0D%0AConceptos abonados:%0D%0A${conceptosTexto}%0D%0ATotal abonado: $${reciboData.monto.toLocaleString()}%0D%0A%0D%0A${saldoTexto}%0D%0A%0D%0AEste correo es un comprobante de pago.`

    window.open(`mailto:${aptData.contactoEmail}?subject=${subject}&body=${body}`, "_blank")

    toast({
      title: "Email abierto",
      description: "Se abrió su cliente de correo con el comprobante",
      variant: "success",
    })
  }, [apartamentos, prepareReciboData])

  return (
    <div className="space-y-8 px-4 md:px-8 lg:px-12 py-6">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6bTEwIDEwdjZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Transacciones</h1>
                <p className="text-green-100 text-sm">
                  Control de ingresos, egresos y créditos
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              variant="secondary"
              onClick={handleExport}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsVentaCreditoDialogOpen(true)}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Venta Crédito
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsReciboPagoDialogOpen(true)}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Recibo de Pago
            </Button>
          </div>
        </div>
      </div>

      {/* Stats - Desglose de Ingresos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <p className="text-sm text-green-600 font-medium">Total Recibos</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(totalIngresos)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <p className="text-sm text-blue-600 font-medium">Gastos Comunes</p>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(ingresosGastosComunes)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="p-4">
            <p className="text-sm text-purple-600 font-medium">Fondo de Reserva</p>
            <p className="text-2xl font-bold text-purple-700">{formatCurrency(ingresosFondoReserva)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-600 font-medium">Créditos Pendientes</p>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(creditosPendientes)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="border-0 shadow-sm bg-slate-50/50">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro por tipo */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Filter className="h-4 w-4" />
                Tipo
              </label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ingresos">Ingresos</SelectItem>
                  <SelectItem value="egresos">Egresos</SelectItem>
                  <SelectItem value="creditos">Créditos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por apartamento (combinado con tipo de ocupación) */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Building className="h-4 w-4" />
                Apartamento
              </label>
              <div className="flex gap-1">
                <Select value={filterApartamento} onValueChange={setFilterApartamento}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {apartamentos.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        <span className="flex items-center gap-2">
                          Apto {apt.numero}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            apt.tipoOcupacion === "PROPIETARIO"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {apt.tipoOcupacion === "PROPIETARIO" ? "Prop." : "Inq."}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hayFiltroApartamento && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={limpiarFiltrosApartamento}
                    className="h-10 w-10 shrink-0 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Filtro por fecha */}
            <div className="space-y-1.5 lg:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Calendar className="h-4 w-4" />
                Período
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="flex-1 bg-white"
                />
                <span className="text-slate-400 text-sm shrink-0">hasta</span>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="flex-1 bg-white"
                />
                {hayFiltroFechas && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={limpiarFiltroFechas}
                    className="h-10 w-10 shrink-0 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Contador de resultados */}
          {(filter !== "todos" || hayFiltroFechas || hayFiltroApartamento) && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <Badge variant="secondary" className="bg-white text-slate-600">
                {filteredTransacciones.length} resultado{filteredTransacciones.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardContent className="p-0">
          {filteredTransacciones.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay transacciones registradas</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTransacciones.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      t.tipo === "EGRESO" ? "bg-red-50" :
                      t.tipo === "VENTA_CREDITO" ? "bg-amber-50" : "bg-green-50"
                    }`}>
                      {t.tipo === "EGRESO" ? (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      ) : t.tipo === "VENTA_CREDITO" ? (
                        <CreditCard className="h-5 w-5 text-amber-600" />
                      ) : t.tipo === "RECIBO_PAGO" ? (
                        <Receipt className="h-5 w-5 text-green-600" />
                      ) : (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900">
                          {tipoLabels[t.tipo]}
                        </p>
                        {t.tipo === "VENTA_CREDITO" && t.estadoCredito && (
                          <Badge variant={estadoCreditoColors[t.estadoCredito]}>
                            {t.estadoCredito === "PAGADO" ? "Pagado" : t.estadoCredito === "PARCIAL" ? "Parcial" : "Pendiente"}
                          </Badge>
                        )}
                        {t.tipo === "VENTA_CREDITO" && t.categoria && (
                          <Badge variant="outline" className={
                            t.categoria === "GASTOS_COMUNES"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-purple-200 bg-purple-50 text-purple-700"
                          }>
                            {t.categoria === "GASTOS_COMUNES" ? "Gasto Común" : "Fondo Reserva"}
                          </Badge>
                        )}
                        {t.tipo === "RECIBO_PAGO" && t.clasificacionPago && (
                          <Badge variant="outline" className={
                            t.clasificacionPago === "GASTO_COMUN"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : t.clasificacionPago === "MIXTO"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-purple-200 bg-purple-50 text-purple-700"
                          }>
                            {t.clasificacionPago === "GASTO_COMUN" ? "Gasto Común" : t.clasificacionPago === "MIXTO" ? "Mixto" : "Fondo Reserva"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(t.fecha)}
                        </span>
                        <span>•</span>
                        <span>{t.apartamento ? `Apto ${t.apartamento.numero}` : "General"}</span>
                        {t.tipo !== "VENTA_CREDITO" && t.tipo !== "RECIBO_PAGO" && t.descripcion && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{t.descripcion}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-2">
                      <p className={`font-semibold ${
                        t.tipo === "EGRESO" ? "text-red-600" :
                        t.tipo === "VENTA_CREDITO" ? "text-amber-600" : "text-green-600"
                      }`}>
                        {t.tipo === "EGRESO" ? "-" : "+"}{formatCurrency(t.monto)}
                      </p>
                      {/* Desglose para pagos mixtos */}
                      {t.tipo === "RECIBO_PAGO" && t.clasificacionPago === "MIXTO" && (t.montoGastoComun || t.montoFondoReserva) && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {t.montoGastoComun && t.montoGastoComun > 0 && (
                            <span className="text-blue-600">GC: {formatCurrency(t.montoGastoComun)}</span>
                          )}
                          {t.montoGastoComun && t.montoGastoComun > 0 && t.montoFondoReserva && t.montoFondoReserva > 0 && (
                            <span className="mx-1">|</span>
                          )}
                          {t.montoFondoReserva && t.montoFondoReserva > 0 && (
                            <span className="text-purple-600">FR: {formatCurrency(t.montoFondoReserva)}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Botones de envío de recibo (solo para RECIBO_PAGO) */}
                    {t.tipo === "RECIBO_PAGO" && t.apartamentoId && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadRecibo(t)}
                          className="h-8 w-8 text-slate-400 hover:text-green-600"
                          title="Descargar recibo PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleShareWhatsApp(t)}
                          className="h-8 w-8 text-slate-400 hover:text-green-600"
                          title="Enviar por WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleShareEmail(t)}
                          className="h-8 w-8 text-slate-400 hover:text-blue-600"
                          title="Enviar por Email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(t)}
                      className="h-8 w-8 text-slate-400 hover:text-slate-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(t.id)}
                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nueva Transacción Dialog */}
      <Dialog open={isTransaccionDialogOpen} onOpenChange={setIsTransaccionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Transacción</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransaccionSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={transaccionForm.tipo}
                  onValueChange={(value) => setTransaccionForm({ ...transaccionForm, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INGRESO">Ingreso</SelectItem>
                    <SelectItem value="EGRESO">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={transaccionForm.monto}
                  onChange={(e) => setTransaccionForm({ ...transaccionForm, monto: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={transaccionForm.categoria}
                  onValueChange={(value) => setTransaccionForm({ ...transaccionForm, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GASTOS_COMUNES">Gastos Comunes</SelectItem>
                    <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
                    <SelectItem value="SERVICIOS">Servicios</SelectItem>
                    <SelectItem value="ADMINISTRACION">Administración</SelectItem>
                    <SelectItem value="REPARACIONES">Reparaciones</SelectItem>
                    <SelectItem value="LIMPIEZA">Limpieza</SelectItem>
                    <SelectItem value="SEGURIDAD">Seguridad</SelectItem>
                    <SelectItem value="OTROS">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Apartamento</Label>
                <Select
                  value={transaccionForm.apartamentoId}
                  onValueChange={(value) => setTransaccionForm({ ...transaccionForm, apartamentoId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="General" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">General</SelectItem>
                    {apartamentos.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        Apto {apt.numero}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={transaccionForm.fecha}
                  onChange={(e) => setTransaccionForm({ ...transaccionForm, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select
                  value={transaccionForm.metodoPago}
                  onValueChange={(value) => setTransaccionForm({ ...transaccionForm, metodoPago: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                    <SelectItem value="TARJETA">Tarjeta</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="OTRO">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Descripción breve"
                value={transaccionForm.descripcion}
                onChange={(e) => setTransaccionForm({ ...transaccionForm, descripcion: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Número de referencia</Label>
              <Input
                placeholder="Ej: Factura #123"
                value={transaccionForm.referencia}
                onChange={(e) => setTransaccionForm({ ...transaccionForm, referencia: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={transaccionForm.notas}
                onChange={(e) => setTransaccionForm({ ...transaccionForm, notas: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTransaccionDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Registrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Venta Crédito Dialog */}
      <Dialog open={isVentaCreditoDialogOpen} onOpenChange={setIsVentaCreditoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Venta a Crédito</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVentaCreditoSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={ventaCreditoForm.monto}
                  onChange={(e) => setVentaCreditoForm({ ...ventaCreditoForm, monto: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Apartamento *</Label>
                <Select
                  value={ventaCreditoForm.apartamentoId}
                  onValueChange={(value) => setVentaCreditoForm({ ...ventaCreditoForm, apartamentoId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {apartamentos.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        <span className="flex items-center gap-2">
                          Apto {apt.numero}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            apt.tipoOcupacion === "PROPIETARIO"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {apt.tipoOcupacion === "PROPIETARIO" ? "Propietario" : "Inquilino"}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={ventaCreditoForm.fecha}
                  onChange={(e) => setVentaCreditoForm({ ...ventaCreditoForm, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Clasificación *</Label>
                <Select
                  value={ventaCreditoForm.categoria}
                  onValueChange={(value: "GASTOS_COMUNES" | "FONDO_RESERVA") => setVentaCreditoForm({
                    ...ventaCreditoForm,
                    categoria: value,
                    descripcion: value === "GASTOS_COMUNES" ? "Gastos Comunes" : "Fondo de Reserva"
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GASTOS_COMUNES">Gastos Comunes</SelectItem>
                    <SelectItem value="FONDO_RESERVA">Fondo de Reserva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVentaCreditoDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Registrar Crédito"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recibo de Pago Dialog */}
      <Dialog open={isReciboPagoDialogOpen} onOpenChange={(open) => {
        setIsReciboPagoDialogOpen(open)
        if (!open) {
          setDeudaApartamento(null)
          setDistribucionPago(null)
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Recibo de Pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReciboPagoSubmit} className="space-y-4">
            {/* 1. Selección de Apartamento */}
            <div className="space-y-2">
              <Label>Apartamento *</Label>
              <Select
                value={reciboPagoForm.apartamentoId}
                onValueChange={(value) => setReciboPagoForm({ ...reciboPagoForm, apartamentoId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar apartamento" />
                </SelectTrigger>
                <SelectContent>
                  {apartamentos.map((apt) => (
                    <SelectItem key={apt.id} value={apt.id}>
                      <span className="flex items-center gap-2">
                        Apto {apt.numero}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          apt.tipoOcupacion === "PROPIETARIO"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {apt.tipoOcupacion === "PROPIETARIO" ? "Propietario" : "Inquilino"}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Card de Deuda Actual */}
            {reciboPagoForm.apartamentoId && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-3">
                  {cargandoDeuda ? (
                    <p className="text-sm text-amber-700">Cargando deuda...</p>
                  ) : deudaApartamento ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-800">Deuda actual:</p>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-amber-600">Gastos Comunes:</span>
                          <p className="font-semibold text-amber-900">{formatCurrency(deudaApartamento.gastosComunes)}</p>
                        </div>
                        <div>
                          <span className="text-amber-600">Fondo Reserva:</span>
                          <p className="font-semibold text-amber-900">{formatCurrency(deudaApartamento.fondoReserva)}</p>
                        </div>
                        <div>
                          <span className="text-amber-600">Total:</span>
                          <p className="font-bold text-amber-900">{formatCurrency(deudaApartamento.total)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-green-700">Sin deuda pendiente</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 3. Monto de la transferencia */}
            <div className="space-y-2">
              <Label>Monto de la transferencia *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={reciboPagoForm.monto}
                onChange={(e) => setReciboPagoForm({ ...reciboPagoForm, monto: e.target.value })}
                required
                className="text-lg font-semibold"
              />
            </div>

            {/* 4. Card de Distribución Automática */}
            {reciboPagoForm.apartamentoId && reciboPagoForm.monto && parseFloat(reciboPagoForm.monto) > 0 && distribucionPago && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-3">
                  <p className="text-sm font-medium text-blue-800 mb-2">Distribución del pago:</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-600">A Gastos Comunes:</span>
                      <span className="font-semibold text-blue-900">{formatCurrency(distribucionPago.aplicadoGastosComunes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">A Fondo de Reserva:</span>
                      <span className="font-semibold text-blue-900">{formatCurrency(distribucionPago.aplicadoFondoReserva)}</span>
                    </div>
                    {distribucionPago.excedente > 0 && (
                      <div className="flex justify-between pt-1 border-t border-blue-200">
                        <span className="text-green-600 font-medium">Excedente:</span>
                        <span className="font-bold text-green-700">{formatCurrency(distribucionPago.excedente)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5. Selector de Excedente (solo si hay excedente) */}
            {distribucionPago && distribucionPago.excedente > 0 && (
              <div className="space-y-2">
                <Label>Asignar excedente a:</Label>
                <Select
                  value={reciboPagoForm.excedentePara}
                  onValueChange={(value: "GASTO_COMUN" | "FONDO_RESERVA") => setReciboPagoForm({ ...reciboPagoForm, excedentePara: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GASTO_COMUN">Gastos Comunes (saldo a favor)</SelectItem>
                    <SelectItem value="FONDO_RESERVA">Fondo de Reserva (saldo a favor)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  El excedente de {formatCurrency(distribucionPago.excedente)} quedará como saldo a favor
                </p>
              </div>
            )}

            {/* 6. Clasificación manual (solo si NO hay deuda - modo legacy) */}
            {(!deudaApartamento || deudaApartamento.total === 0) && (
              <div className="space-y-2">
                <Label>Clasificación del Pago *</Label>
                <Select
                  value={reciboPagoForm.clasificacionPago}
                  onValueChange={(value: "GASTO_COMUN" | "FONDO_RESERVA") => setReciboPagoForm({ ...reciboPagoForm, clasificacionPago: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GASTO_COMUN">Gasto Común</SelectItem>
                    <SelectItem value="FONDO_RESERVA">Fondo de Reserva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={reciboPagoForm.fecha}
                  onChange={(e) => setReciboPagoForm({ ...reciboPagoForm, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select
                  value={reciboPagoForm.metodoPago}
                  onValueChange={(value) => setReciboPagoForm({ ...reciboPagoForm, metodoPago: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                    <SelectItem value="TARJETA">Tarjeta</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="OTRO">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cuenta Bancaria</Label>
              <Select
                value={reciboPagoForm.cuentaBancariaId || "none"}
                onValueChange={(value) => setReciboPagoForm({ ...reciboPagoForm, cuentaBancariaId: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {cuentasBancarias.map((cuenta) => (
                    <SelectItem key={cuenta.id} value={cuenta.id}>
                      {cuenta.banco} - {cuenta.tipoCuenta} ({cuenta.numeroCuenta.slice(-4)})
                      {cuenta.porDefecto && <Star className="inline h-3 w-3 ml-1 fill-amber-400 text-amber-400" />}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Si seleccionas una cuenta, se registrará automáticamente el ingreso bancario
              </p>
            </div>

            <div className="space-y-2">
              <Label>Número de referencia</Label>
              <Input
                placeholder="Ej: Transferencia #456"
                value={reciboPagoForm.referencia}
                onChange={(e) => setReciboPagoForm({ ...reciboPagoForm, referencia: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={reciboPagoForm.notas}
                onChange={(e) => setReciboPagoForm({ ...reciboPagoForm, notas: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReciboPagoDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Registrar Pago"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar Eliminación Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        setIsDeleteDialogOpen(open)
        if (!open) {
          setTransaccionToDelete(null)
          setInfoBancoVinculado(null)
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar transacción?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Esta acción no se puede deshacer. La transacción será eliminada permanentemente.</p>

                {infoBancoVinculado?.tieneVinculo && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800">
                        Esta transacción está vinculada a una cuenta bancaria
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-amber-700">
                        <Landmark className="h-4 w-4" />
                        <span>
                          {infoBancoVinculado.banco} - ****{infoBancoVinculado.numeroCuenta?.slice(-4)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-amber-600">
                        El movimiento bancario asociado también será eliminado.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setTransaccionToDelete(null)
              setInfoBancoVinculado(null)
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isLoading}
            >
              {isLoading ? "Eliminando..." : infoBancoVinculado?.tieneVinculo ? "Eliminar ambos" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Editar Transacción Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) setInfoBancoVinculadoEdit(null)
        }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editForm.tipo === "RECIBO_PAGO" ? "Editar Recibo de Pago" : "Editar Transacción"}
            </DialogTitle>
          </DialogHeader>
          {infoBancoVinculadoEdit?.tieneVinculo && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3">
              <p className="text-amber-800 dark:text-amber-200 font-medium flex items-center gap-2 text-sm">
                <Landmark className="h-4 w-4" />
                Transacción vinculada a movimiento bancario
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Los cambios en monto, fecha y referencia se sincronizarán automáticamente con el movimiento en{" "}
                <strong>{infoBancoVinculadoEdit.banco}</strong> ({infoBancoVinculadoEdit.numeroCuenta}).
              </p>
            </div>
          )}
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={editForm.monto}
                  onChange={(e) => setEditForm({ ...editForm, monto: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Apartamento {editForm.tipo === "RECIBO_PAGO" ? "*" : ""}</Label>
                <Select
                  value={editForm.apartamentoId || "none"}
                  onValueChange={(value) => setEditForm({ ...editForm, apartamentoId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={editForm.tipo === "RECIBO_PAGO" ? "Seleccionar" : "General"} />
                  </SelectTrigger>
                  <SelectContent>
                    {editForm.tipo !== "RECIBO_PAGO" && (
                      <SelectItem value="none">General</SelectItem>
                    )}
                    {apartamentos.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        <span className="flex items-center gap-2">
                          Apto {apt.numero}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            apt.tipoOcupacion === "PROPIETARIO"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {apt.tipoOcupacion === "PROPIETARIO" ? "Propietario" : "Inquilino"}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={editForm.fecha}
                  onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select
                  value={editForm.metodoPago}
                  onValueChange={(value) => setEditForm({ ...editForm, metodoPago: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                    <SelectItem value="TARJETA">Tarjeta</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="OTRO">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campos específicos para Recibo de Pago */}
            {editForm.tipo === "RECIBO_PAGO" && (
              <>
                <div className="space-y-2">
                  <Label>Clasificación del Pago *</Label>
                  <Select
                    value={editForm.clasificacionPago}
                    onValueChange={(value: "GASTO_COMUN" | "FONDO_RESERVA") => setEditForm({ ...editForm, clasificacionPago: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GASTO_COMUN">Gasto Común</SelectItem>
                      <SelectItem value="FONDO_RESERVA">Fondo de Reserva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cuenta Bancaria</Label>
                  <Select
                    value={editForm.cuentaBancariaId || "none"}
                    onValueChange={(value) => setEditForm({ ...editForm, cuentaBancariaId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {cuentasBancarias.map((cuenta) => (
                        <SelectItem key={cuenta.id} value={cuenta.id}>
                          {cuenta.banco} - {cuenta.tipoCuenta} ({cuenta.numeroCuenta.slice(-4)})
                          {cuenta.porDefecto && <Star className="inline h-3 w-3 ml-1 fill-amber-400 text-amber-400" />}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Clasificación para Venta Crédito */}
            {editForm.tipo === "VENTA_CREDITO" && (
              <div className="space-y-2">
                <Label>Clasificación *</Label>
                <Select
                  value={editForm.categoria || "GASTOS_COMUNES"}
                  onValueChange={(value) => setEditForm({ ...editForm, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GASTOS_COMUNES">Gastos Comunes</SelectItem>
                    <SelectItem value="FONDO_RESERVA">Fondo de Reserva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Campos para otros tipos de transacción (INGRESO/EGRESO) */}
            {editForm.tipo !== "RECIBO_PAGO" && editForm.tipo !== "VENTA_CREDITO" && (
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={editForm.categoria || "none"}
                  onValueChange={(value) => setEditForm({ ...editForm, categoria: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    <SelectItem value="GASTOS_COMUNES">Gastos Comunes</SelectItem>
                    <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
                    <SelectItem value="SERVICIOS">Servicios</SelectItem>
                    <SelectItem value="ADMINISTRACION">Administración</SelectItem>
                    <SelectItem value="REPARACIONES">Reparaciones</SelectItem>
                    <SelectItem value="LIMPIEZA">Limpieza</SelectItem>
                    <SelectItem value="SEGURIDAD">Seguridad</SelectItem>
                    <SelectItem value="OTROS">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Número de referencia solo para INGRESO/EGRESO */}
            {editForm.tipo !== "RECIBO_PAGO" && editForm.tipo !== "VENTA_CREDITO" && (
              <div className="space-y-2">
                <Label>Número de referencia</Label>
                <Input
                  placeholder="Ej: Factura #123"
                  value={editForm.referencia}
                  onChange={(e) => setEditForm({ ...editForm, referencia: e.target.value })}
                />
              </div>
            )}

            {/* Notas solo para tipos que no son VENTA_CREDITO */}
            {editForm.tipo !== "VENTA_CREDITO" && (
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  placeholder="Notas adicionales..."
                  value={editForm.notas}
                  onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
