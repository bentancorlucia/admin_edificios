"use client"

import { useState, useTransition, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileSpreadsheet,
  FileText,
  Calendar,
  CalendarRange,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  Landmark,
  MessageSquare,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Receipt,
  PiggyBank,
} from "lucide-react"
import {
  type InformeData,
  type AvisoInforme,
  type InformeAcumuladoData,
  getInformeData,
  getInformeAcumulado,
  getInformeCombinado,
  createAvisoInforme,
  updateAvisoInforme,
  deleteAvisoInforme,
  reorderAvisosInforme,
  updatePiePaginaInforme,
} from "@/lib/database"
import { Input } from "@/components/ui/input"
import { generateInformePDF, generateInformeCombinado } from "@/lib/informe-pdf"
import { generateInformeExcel } from "@/lib/informe-excel"
import { toast } from "@/hooks/use-toast"

const meses = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
]

const tipoOcupacionLabels: Record<string, string> = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
}

type Props = {
  initialData: InformeData
  initialMes: number
  initialAnio: number
  initialPiePagina: string
}

export function InformesClient({ initialData, initialMes, initialAnio, initialPiePagina }: Props) {
  const [data, setData] = useState<InformeData>(initialData)
  const [mes, setMes] = useState(initialMes)
  const [anio, setAnio] = useState(initialAnio)
  const [isPending, startTransition] = useTransition()

  // Estados para mini bitácora
  const [avisos, setAvisos] = useState<AvisoInforme[]>(initialData.avisos || [])
  const [ordenOriginal, setOrdenOriginal] = useState<string[]>((initialData.avisos || []).map(a => a.id))
  const [nuevoAviso, setNuevoAviso] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [savingAvisos, setSavingAvisos] = useState(false)

  // Detectar si hay cambios pendientes en el orden de avisos
  const ordenHaCambiado = useMemo(() => {
    const ordenActual = avisos.map(a => a.id)
    if (ordenActual.length !== ordenOriginal.length) return false
    return ordenActual.some((id, i) => id !== ordenOriginal[i])
  }, [avisos, ordenOriginal])

  // Estados para pie de página
  const [piePagina, setPiePagina] = useState(initialPiePagina)
  const [editingPiePagina, setEditingPiePagina] = useState(false)
  const [piePaginaTemp, setPiePaginaTemp] = useState(initialPiePagina)
  const [savingPiePagina, setSavingPiePagina] = useState(false)

  // Estados para informe acumulado
  const [acumuladoFechaInicio, setAcumuladoFechaInicio] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  )
  const [acumuladoFechaFin, setAcumuladoFechaFin] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [acumuladoData, setAcumuladoData] = useState<InformeAcumuladoData | null>(null)
  const [loadingAcumulado, setLoadingAcumulado] = useState(false)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  const handleDateChange = (newMes?: number, newAnio?: number) => {
    const targetMes = newMes ?? mes
    const targetAnio = newAnio ?? anio

    setMes(targetMes)
    setAnio(targetAnio)

    startTransition(async () => {
      const newData = await getInformeData(targetMes, targetAnio)
      setData(newData)
      setAvisos(newData.avisos || [])
      setOrdenOriginal((newData.avisos || []).map(a => a.id))
    })
  }

  const handlePrevMonth = () => {
    let newMes = mes - 1
    let newAnio = anio
    if (newMes < 1) {
      newMes = 12
      newAnio = anio - 1
    }
    handleDateChange(newMes, newAnio)
  }

  const handleNextMonth = () => {
    let newMes = mes + 1
    let newAnio = anio
    if (newMes > 12) {
      newMes = 1
      newAnio = anio + 1
    }
    handleDateChange(newMes, newAnio)
  }

  // Handlers para avisos
  const handleAddAviso = async () => {
    if (!nuevoAviso.trim()) return
    try {
      const aviso = await createAvisoInforme({
        texto: nuevoAviso.trim(),
        mes,
        anio,
      })
      const nuevosAvisos = [...avisos, aviso]
      setAvisos(nuevosAvisos)
      setOrdenOriginal(nuevosAvisos.map(a => a.id))
      setNuevoAviso("")
    } catch (error) {
      console.error("Error al agregar aviso:", error)
      toast({
        title: "Error",
        description: "No se pudo agregar el aviso",
        variant: "destructive",
      })
    }
  }

  const handleUpdateAviso = async (id: string) => {
    if (!editingText.trim()) return
    try {
      await updateAvisoInforme(id, { texto: editingText.trim() })
      setAvisos(avisos.map((a) => (a.id === id ? { ...a, texto: editingText.trim() } : a)))
      setEditingId(null)
      setEditingText("")
    } catch (error) {
      console.error("Error al actualizar aviso:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el aviso",
        variant: "destructive",
      })
    }
  }

  const handleToggleAviso = async (id: string, activo: boolean) => {
    try {
      await updateAvisoInforme(id, { activo: !activo })
      setAvisos(avisos.map((a) => (a.id === id ? { ...a, activo: !activo } : a)))
    } catch (error) {
      console.error("Error al cambiar estado del aviso:", error)
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del aviso",
        variant: "destructive",
      })
    }
  }

  const handleDeleteAviso = async (id: string) => {
    try {
      await deleteAvisoInforme(id)
      const nuevosAvisos = avisos.filter((a) => a.id !== id)
      setAvisos(nuevosAvisos)
      setOrdenOriginal(nuevosAvisos.map(a => a.id))
    } catch (error) {
      console.error("Error al eliminar aviso:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el aviso",
        variant: "destructive",
      })
    }
  }

  const handleMoveAviso = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= avisos.length) return

    const newAvisos = [...avisos]
    ;[newAvisos[index], newAvisos[newIndex]] = [newAvisos[newIndex], newAvisos[index]]

    setAvisos(newAvisos)
  }

  const handleSaveAvisosOrder = async () => {
    setSavingAvisos(true)
    try {
      const reordered = avisos.map((a, i) => ({ id: a.id, orden: i }))
      await reorderAvisosInforme(reordered)
      setOrdenOriginal(avisos.map(a => a.id))
      toast({
        title: "Orden guardado",
        description: "El orden de los avisos se ha guardado correctamente",
        variant: "success",
      })
    } catch (error) {
      console.error("Error guardando orden de avisos:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el orden de los avisos",
        variant: "destructive",
      })
    } finally {
      setSavingAvisos(false)
    }
  }

  const handleDiscardAvisosChanges = () => {
    // Restaurar el orden original manteniendo los avisos actuales
    const avisosMap = new Map(avisos.map(a => [a.id, a]))
    const avisosReordenados = ordenOriginal
      .map(id => avisosMap.get(id))
      .filter((a): a is AvisoInforme => a !== undefined)
    setAvisos(avisosReordenados)
  }

  // Handler para pie de página
  const handleSavePiePagina = async () => {
    if (piePaginaTemp.trim() === piePagina) {
      setEditingPiePagina(false)
      return
    }
    setSavingPiePagina(true)
    try {
      const nuevoValor = await updatePiePaginaInforme(piePaginaTemp.trim())
      setPiePagina(nuevoValor)
      setEditingPiePagina(false)
    } finally {
      setSavingPiePagina(false)
    }
  }

  const handleCancelPiePagina = () => {
    setPiePaginaTemp(piePagina)
    setEditingPiePagina(false)
  }

  // Handler para cargar informe acumulado
  const handleLoadAcumulado = async () => {
    setLoadingAcumulado(true)
    try {
      const data = await getInformeAcumulado(
        acumuladoFechaInicio,
        acumuladoFechaFin
      )
      setAcumuladoData(data)
    } catch (error) {
      console.error("Error cargando informe acumulado:", error)
    } finally {
      setLoadingAcumulado(false)
    }
  }

  // Memoizar función de formateo
  const formatCurrency = useCallback((value: number) => {
    return `$ ${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }, [])

  // Memoizar label del mes
  const mesLabel = useMemo(() => {
    const mesObj = meses.find((m) => m.value === mes)
    return mesObj ? `${mesObj.label} ${anio}` : ""
  }, [mes, anio])

  const handleExportPDF = useCallback(() => {
    // Usar los avisos del estado local (con cambios de texto y orden) en lugar de data.avisos
    const dataConAvisosActualizados = {
      ...data,
      avisos: avisos,
    }
    generateInformePDF(dataConAvisosActualizados, mesLabel, piePagina)
    toast({
      title: "PDF descargado",
      description: `Informe de ${mesLabel} descargado correctamente`,
      variant: "success",
    })
  }, [data, avisos, mesLabel, piePagina])

  const handleExportExcel = useCallback(() => {
    generateInformeExcel(data, mesLabel)
    toast({
      title: "Excel descargado",
      description: `Informe de ${mesLabel} descargado correctamente`,
      variant: "success",
    })
  }, [data, mesLabel])

  const handleExportPDFCombinado = useCallback(async () => {
    try {
      const dataCombinada = await getInformeCombinado(mes, anio)
      // Usar avisos del estado local
      const dataConAvisosActualizados = {
        ...dataCombinada,
        avisos: avisos,
      }
      generateInformeCombinado(dataConAvisosActualizados, piePagina)
      toast({
        title: "PDF Combinado descargado",
        description: `Informe combinado ${dataCombinada.mesAnterior.label} + ${dataCombinada.mesCorriente.label}`,
        variant: "success",
      })
    } catch (error) {
      console.error("Error generando PDF combinado:", error)
      toast({
        title: "Error",
        description: "No se pudo generar el PDF combinado",
        variant: "destructive",
      })
    }
  }, [mes, anio, avisos, piePagina])

  return (
    <div className="space-y-6 p-6">
      {/* Header con navegación de fecha */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Informes</h1>
          <p className="text-sm text-slate-500">Resumen financiero del edificio</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Navegación de mes */}
          <div className="flex items-center gap-1 rounded-lg border bg-white p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrevMonth}
              disabled={isPending}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 px-2">
              <Select
                value={mes.toString()}
                onValueChange={(v) => handleDateChange(parseInt(v), undefined)}
              >
                <SelectTrigger className="h-8 w-[110px] border-0 bg-transparent font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={anio.toString()}
                onValueChange={(v) => handleDateChange(undefined, parseInt(v))}
              >
                <SelectTrigger className="h-8 w-[80px] border-0 bg-transparent font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextMonth}
              disabled={isPending}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Botones de exportación */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isPending}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDFCombinado}
            disabled={isPending}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            PDF Comb.
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isPending}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      )}

      {!isPending && (
        <Tabs defaultValue="mensual" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="mensual" className="gap-2">
              <Calendar className="h-4 w-4" />
              Informe Mensual
            </TabsTrigger>
            <TabsTrigger value="acumulado" className="gap-2">
              <CalendarRange className="h-4 w-4" />
              Informe Acumulado
            </TabsTrigger>
          </TabsList>

          {/* Tab: Informe Mensual */}
          <TabsContent value="mensual" className="space-y-6">
            {/* Tarjetas de resumen */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Saldo Anterior
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {formatCurrency(data.totales.totalSaldoAnterior)}
                      </p>
                    </div>
                    <div className="rounded-full bg-blue-50 p-3">
                      <Wallet className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Pagos del Mes
                      </p>
                      <p className="mt-1 text-2xl font-bold text-green-600">
                        {formatCurrency(data.totales.totalPagosMes)}
                      </p>
                    </div>
                    <div className="rounded-full bg-green-50 p-3">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Gastos + Reserva
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {formatCurrency(data.totales.totalGastosComunesMes + data.totales.totalFondoReservaMes)}
                      </p>
                    </div>
                    <div className="rounded-full bg-purple-50 p-3">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-l-4 ${data.totales.totalSaldoActual > 0 ? "border-l-red-500" : "border-l-emerald-500"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Saldo Actual
                      </p>
                      <p className={`mt-1 text-2xl font-bold ${data.totales.totalSaldoActual > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {formatCurrency(data.totales.totalSaldoActual)}
                      </p>
                    </div>
                    <div className={`rounded-full p-3 ${data.totales.totalSaldoActual > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                      <TrendingDown className={`h-5 w-5 ${data.totales.totalSaldoActual > 0 ? "text-red-600" : "text-emerald-600"}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comparativo Cobrado vs Recaudado */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Gastos Comunes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="h-4 w-4 text-blue-600" />
                    Gastos Comunes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                    <span className="text-sm text-slate-600">Cobrado (Facturado)</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(data.totales.totalGastosComunesMes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
                    <span className="text-sm text-green-700">Recaudado (Pagado)</span>
                    <span className="font-semibold text-green-700">
                      {formatCurrency(data.resumenBancario.ingresoGastosComunes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                    <span className="text-sm text-red-700">Egresos</span>
                    <span className="font-semibold text-red-700">
                      {formatCurrency(data.resumenBancario.egresoGastosComunes)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Fondo de Reserva */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PiggyBank className="h-4 w-4 text-purple-600" />
                    Fondo de Reserva
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                    <span className="text-sm text-slate-600">Cobrado (Facturado)</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(data.totales.totalFondoReservaMes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
                    <span className="text-sm text-green-700">Recaudado (Pagado)</span>
                    <span className="font-semibold text-green-700">
                      {formatCurrency(data.resumenBancario.ingresoFondoReserva)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                    <span className="text-sm text-red-700">Egresos</span>
                    <span className="font-semibold text-red-700">
                      {formatCurrency(data.resumenBancario.egresoFondoReserva)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resumen Bancario */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Landmark className="h-4 w-4 text-slate-600" />
                  Resumen Bancario
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                    <ArrowUpCircle className="mx-auto mb-2 h-5 w-5 text-green-600" />
                    <p className="text-xs text-green-600">Recaudado G.C.</p>
                    <p className="text-lg font-bold text-green-700">
                      {formatCurrency(data.resumenBancario.ingresoGastosComunes)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                    <ArrowUpCircle className="mx-auto mb-2 h-5 w-5 text-green-600" />
                    <p className="text-xs text-green-600">Recaudado F.R.</p>
                    <p className="text-lg font-bold text-green-700">
                      {formatCurrency(data.resumenBancario.ingresoFondoReserva)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                    <ArrowDownCircle className="mx-auto mb-2 h-5 w-5 text-red-600" />
                    <p className="text-xs text-red-600">Pagado G.C.</p>
                    <p className="text-lg font-bold text-red-700">
                      {formatCurrency(data.resumenBancario.egresoGastosComunes)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                    <ArrowDownCircle className="mx-auto mb-2 h-5 w-5 text-red-600" />
                    <p className="text-xs text-red-600">Pagado F.R.</p>
                    <p className="text-lg font-bold text-red-700">
                      {formatCurrency(data.resumenBancario.egresoFondoReserva)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-900 p-4 text-center text-white">
                    <Landmark className="mx-auto mb-2 h-5 w-5 text-white" />
                    <p className="text-xs text-slate-300">Saldo Bancario</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(data.resumenBancario.saldoBancarioTotal)}
                    </p>
                  </div>
                </div>

                {/* Saldos por Cuenta Bancaria */}
                {data.saldosPorCuenta && data.saldosPorCuenta.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                      Saldo por Cuenta Bancaria
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {data.saldosPorCuenta.map((cuenta) => (
                        <div
                          key={cuenta.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {cuenta.banco}
                              </p>
                              <p className="text-xs text-slate-500">
                                {cuenta.tipoCuenta} · {cuenta.numeroCuenta}
                              </p>
                              {cuenta.titular && (
                                <p className="text-xs text-slate-400 truncate">
                                  {cuenta.titular}
                                </p>
                              )}
                            </div>
                            <div className="ml-3 text-right">
                              <p className={`text-lg font-bold ${cuenta.saldo >= 0 ? "text-slate-900" : "text-red-600"}`}>
                                {formatCurrency(cuenta.saldo)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabla de Apartamentos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-slate-600" />
                  Desglose por Apartamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.apartamentos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Building2 className="mb-3 h-10 w-10 text-slate-300" />
                    <p className="font-medium">No hay apartamentos registrados</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold">Apto</TableHead>
                          <TableHead className="font-semibold">Tipo</TableHead>
                          <TableHead className="text-right font-semibold">Saldo Ant.</TableHead>
                          <TableHead className="text-right font-semibold">Pagos Mes</TableHead>
                          <TableHead className="text-right font-semibold">G. Comunes</TableHead>
                          <TableHead className="text-right font-semibold">F. Reserva</TableHead>
                          <TableHead className="text-right font-semibold">Saldo Actual</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.apartamentos.map((apt) => (
                          <TableRow key={apt.apartamentoId} className="hover:bg-slate-50">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded bg-slate-100 text-sm font-semibold">
                                  {apt.numero}
                                </span>
                                {apt.piso && (
                                  <span className="text-xs text-slate-400">P{apt.piso}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  apt.tipoOcupacion === "PROPIETARIO"
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-purple-200 bg-purple-50 text-purple-700"
                                }
                              >
                                {tipoOcupacionLabels[apt.tipoOcupacion]}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${apt.saldoAnterior > 0 ? "text-red-600" : apt.saldoAnterior < 0 ? "text-green-600" : ""}`}>
                              {formatCurrency(apt.saldoAnterior)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {formatCurrency(apt.pagosMes)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(apt.gastosComunesMes)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(apt.fondoReservaMes)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`inline-flex rounded px-2 py-0.5 text-sm font-semibold ${
                                  apt.saldoActual > 0
                                    ? "bg-red-100 text-red-700"
                                    : apt.saldoActual < 0
                                    ? "bg-green-100 text-green-700"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {formatCurrency(apt.saldoActual)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-900 text-white font-semibold hover:bg-slate-800">
                          <TableCell colSpan={2}>TOTALES</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.totales.totalSaldoAnterior)}
                          </TableCell>
                          <TableCell className="text-right text-green-400">
                            {formatCurrency(data.totales.totalPagosMes)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.totales.totalGastosComunesMes)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.totales.totalFondoReservaMes)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`inline-flex rounded px-2 py-0.5 ${data.totales.totalSaldoActual > 0 ? "bg-red-500" : "bg-green-500"}`}>
                              {formatCurrency(data.totales.totalSaldoActual)}
                            </span>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Avisos y Pie de Página en grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Avisos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4 text-amber-600" />
                    Avisos para el Informe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Escribe un aviso..."
                      value={nuevoAviso}
                      onChange={(e) => setNuevoAviso(e.target.value)}
                      className="min-h-[60px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleAddAviso()
                        }
                      }}
                    />
                    <Button
                      onClick={handleAddAviso}
                      disabled={!nuevoAviso.trim()}
                      size="icon"
                      className="h-[60px] w-[60px] shrink-0"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>

                  {avisos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 text-slate-400">
                      <MessageSquare className="mb-2 h-6 w-6" />
                      <p className="text-sm">No hay avisos para este mes</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {avisos.map((aviso, index) => (
                        <div
                          key={aviso.id}
                          className={`flex items-start gap-2 rounded-lg border p-2 transition-all ${
                            aviso.activo
                              ? "bg-white hover:bg-slate-50"
                              : "bg-slate-50 opacity-50"
                          }`}
                        >
                          {/* Flechas para reordenar */}
                          <div className="flex flex-col shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => handleMoveAviso(index, "up")}
                              disabled={index === 0}
                            >
                              <ChevronUp className={`h-3 w-3 ${index === 0 ? "text-slate-300" : "text-slate-500"}`} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => handleMoveAviso(index, "down")}
                              disabled={index === avisos.length - 1}
                            >
                              <ChevronDown className={`h-3 w-3 ${index === avisos.length - 1 ? "text-slate-300" : "text-slate-500"}`} />
                            </Button>
                          </div>

                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700 mt-1">
                            {index + 1}
                          </span>

                          {editingId === aviso.id ? (
                            <div className="flex flex-1 gap-2">
                              <Textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="min-h-[40px] flex-1 resize-none text-sm"
                                autoFocus
                              />
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-green-600"
                                  onClick={() => handleUpdateAviso(aviso.id)}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setEditingId(null)
                                    setEditingText("")
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className={`flex-1 text-sm mt-1 ${!aviso.activo && "line-through"}`}>
                                {aviso.texto}
                              </p>
                              <div className="flex shrink-0 gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => handleToggleAviso(aviso.id, aviso.activo)}
                                >
                                  {aviso.activo ? (
                                    <Eye className="h-3 w-3 text-amber-600" />
                                  ) : (
                                    <EyeOff className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setEditingId(aviso.id)
                                    setEditingText(aviso.texto)
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-red-600"
                                  onClick={() => handleDeleteAviso(aviso.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {avisos.length > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        {avisos.filter((a) => a.activo).length} de {avisos.length} aviso(s) activos
                      </p>
                      {ordenHaCambiado && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-600">Cambios sin guardar</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDiscardAvisosChanges}
                            disabled={savingAvisos}
                            className="h-7 text-xs"
                          >
                            <X className="mr-1 h-3 w-3" />
                            Descartar
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveAvisosOrder}
                            disabled={savingAvisos}
                            className="h-7 bg-green-600 text-xs hover:bg-green-700"
                          >
                            {savingAvisos ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="mr-1 h-3 w-3" />
                            )}
                            Aplicar cambios
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pie de Página */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-slate-600" />
                    Pie de Página del PDF
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingPiePagina ? (
                    <div className="flex gap-2">
                      <Input
                        value={piePaginaTemp}
                        onChange={(e) => setPiePaginaTemp(e.target.value)}
                        placeholder="Escribe el pie de página..."
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSavePiePagina()
                          if (e.key === "Escape") handleCancelPiePagina()
                        }}
                        autoFocus
                      />
                      <Button
                        size="icon"
                        onClick={handleSavePiePagina}
                        disabled={savingPiePagina}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {savingPiePagina ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleCancelPiePagina}
                        disabled={savingPiePagina}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="group flex cursor-pointer items-center justify-between rounded-lg border-2 border-dashed p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => {
                        setPiePaginaTemp(piePagina)
                        setEditingPiePagina(true)
                      }}
                    >
                      <span className="text-sm text-slate-600">{piePagina || "Click para agregar pie de página"}</span>
                      <Pencil className="h-4 w-4 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Informe Acumulado */}
          <TabsContent value="acumulado" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-teal-600" />
                  Informe Acumulado por Rango de Fechas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selector de fechas */}
                <div className="flex flex-wrap items-end gap-4 rounded-lg bg-slate-50 p-4">
                  <div className="flex-1 min-w-[180px]">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Fecha Inicio
                    </label>
                    <Input
                      type="date"
                      value={acumuladoFechaInicio}
                      onChange={(e) => setAcumuladoFechaInicio(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Fecha Fin
                    </label>
                    <Input
                      type="date"
                      value={acumuladoFechaFin}
                      onChange={(e) => setAcumuladoFechaFin(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleLoadAcumulado}
                    disabled={loadingAcumulado}
                    className="gap-2"
                  >
                    {loadingAcumulado ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <BarChart3 className="h-4 w-4" />
                    )}
                    Generar
                  </Button>
                </div>

                {/* Resultados */}
                {acumuladoData ? (
                  <div className="space-y-6">
                    <div className="rounded-lg bg-teal-50 p-3 text-center text-sm text-teal-700">
                      Periodo: <span className="font-semibold">{new Date(acumuladoData.fechaInicio).toLocaleDateString("es-ES")}</span>
                      {" "} al {" "}
                      <span className="font-semibold">{new Date(acumuladoData.fechaFin).toLocaleDateString("es-ES")}</span>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      {/* Recibos */}
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-green-800">
                          <ArrowUpCircle className="h-4 w-4" />
                          Recibos (Ingresos)
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between rounded bg-white/60 p-2">
                            <span className="text-sm text-slate-600">Gastos Comunes</span>
                            <span className="font-semibold text-green-700">
                              {formatCurrency(acumuladoData.recibos.gastosComunes)}
                            </span>
                          </div>
                          <div className="flex justify-between rounded bg-white/60 p-2">
                            <span className="text-sm text-slate-600">Fondo de Reserva</span>
                            <span className="font-semibold text-green-700">
                              {formatCurrency(acumuladoData.recibos.fondoReserva)}
                            </span>
                          </div>
                          <div className="border-t border-green-200 pt-2">
                            <div className="flex justify-between">
                              <span className="font-medium text-slate-700">Total</span>
                              <span className="text-lg font-bold text-green-800">
                                {formatCurrency(acumuladoData.recibos.total)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Egresos */}
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-red-800">
                          <ArrowDownCircle className="h-4 w-4" />
                          Egresos (Pagos)
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between rounded bg-white/60 p-2">
                            <span className="text-sm text-slate-600">Gastos Comunes</span>
                            <span className="font-semibold text-red-700">
                              {formatCurrency(acumuladoData.egresos.gastosComunes)}
                            </span>
                          </div>
                          <div className="flex justify-between rounded bg-white/60 p-2">
                            <span className="text-sm text-slate-600">Fondo de Reserva</span>
                            <span className="font-semibold text-red-700">
                              {formatCurrency(acumuladoData.egresos.fondoReserva)}
                            </span>
                          </div>
                          <div className="border-t border-red-200 pt-2">
                            <div className="flex justify-between">
                              <span className="font-medium text-slate-700">Total</span>
                              <span className="text-lg font-bold text-red-800">
                                {formatCurrency(acumuladoData.egresos.total)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="rounded-lg bg-slate-900 p-4 text-white">
                      <h4 className="mb-3 text-center text-sm font-semibold uppercase text-slate-300">
                        Balance (Recibos - Egresos)
                      </h4>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-lg bg-white/10 p-3 text-center">
                          <p className="text-xs uppercase text-slate-400">Gastos Comunes</p>
                          <p className={`text-xl font-bold ${acumuladoData.balance.gastosComunes >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatCurrency(acumuladoData.balance.gastosComunes)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/10 p-3 text-center">
                          <p className="text-xs uppercase text-slate-400">Fondo de Reserva</p>
                          <p className={`text-xl font-bold ${acumuladoData.balance.fondoReserva >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatCurrency(acumuladoData.balance.fondoReserva)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/20 p-3 text-center">
                          <p className="text-xs uppercase text-slate-300">Balance Total</p>
                          <p className={`text-xl font-bold ${acumuladoData.balance.total >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatCurrency(acumuladoData.balance.total)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : !loadingAcumulado ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-slate-400">
                    <BarChart3 className="mb-3 h-10 w-10" />
                    <p className="font-medium">Selecciona un rango de fechas</p>
                    <p className="text-sm">Haz clic en &quot;Generar&quot; para ver los datos</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
