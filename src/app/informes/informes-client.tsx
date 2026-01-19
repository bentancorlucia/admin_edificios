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
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  Landmark,
  MessageSquare,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  BarChart3,
} from "lucide-react"
import {
  type InformeData,
  type AvisoInforme,
  type InformeAcumuladoData,
  getInformeData,
  getInformeAcumulado,
  createAvisoInforme,
  updateAvisoInforme,
  deleteAvisoInforme,
  reorderAvisosInforme,
  updatePiePaginaInforme,
} from "@/lib/database"
import { Input } from "@/components/ui/input"
import { generateInformePDF } from "@/lib/informe-pdf"
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
  const [nuevoAviso, setNuevoAviso] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

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
    })
  }

  // Handlers para avisos
  const handleAddAviso = async () => {
    if (!nuevoAviso.trim()) return
    const aviso = await createAvisoInforme({
      texto: nuevoAviso.trim(),
      mes,
      anio,
    })
    setAvisos([...avisos, aviso])
    setNuevoAviso("")
  }

  const handleUpdateAviso = async (id: string) => {
    if (!editingText.trim()) return
    await updateAvisoInforme(id, { texto: editingText.trim() })
    setAvisos(avisos.map((a) => (a.id === id ? { ...a, texto: editingText.trim() } : a)))
    setEditingId(null)
    setEditingText("")
  }

  const handleToggleAviso = async (id: string, activo: boolean) => {
    await updateAvisoInforme(id, { activo: !activo })
    setAvisos(avisos.map((a) => (a.id === id ? { ...a, activo: !activo } : a)))
  }

  const handleDeleteAviso = async (id: string) => {
    await deleteAvisoInforme(id)
    setAvisos(avisos.filter((a) => a.id !== id))
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newAvisos = [...avisos]
    const draggedItem = newAvisos[draggedIndex]
    newAvisos.splice(draggedIndex, 1)
    newAvisos.splice(index, 0, draggedItem)

    setAvisos(newAvisos)
    setDraggedIndex(index)
  }

  const handleDragEnd = async () => {
    if (draggedIndex === null) return

    const reordered = avisos.map((a, i) => ({ id: a.id, orden: i }))
    await reorderAvisosInforme(reordered)
    setDraggedIndex(null)
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

  const getMesLabel = useCallback(() => mesLabel, [mesLabel])

  const handleExportPDF = useCallback(() => {
    generateInformePDF(data, mesLabel, piePagina)
    toast({
      title: "PDF descargado",
      description: `Informe de ${mesLabel} descargado correctamente`,
      variant: "success",
    })
  }, [data, mesLabel, piePagina])

  const handleExportExcel = useCallback(() => {
    generateInformeExcel(data, mesLabel)
    toast({
      title: "Excel descargado",
      description: `Informe de ${mesLabel} descargado correctamente`,
      variant: "success",
    })
  }, [data, mesLabel])

  return (
    <div className="space-y-8 px-4 md:px-8 lg:px-12 py-6">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6bTEwIDEwdjZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Informe Mensual</h1>
                <p className="text-blue-100 text-sm">
                  Estado de cuenta corriente y resumen bancario
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de fecha con estilo mejorado */}
            <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm p-2">
              <Calendar className="h-4 w-4 text-blue-200 ml-2" />
              <Select
                value={mes.toString()}
                onValueChange={(v) => handleDateChange(parseInt(v), undefined)}
              >
                <SelectTrigger className="w-[130px] border-0 bg-white/20 text-white hover:bg-white/30 focus:ring-white/30">
                  <SelectValue placeholder="Mes" />
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
                <SelectTrigger className="w-[90px] border-0 bg-white/20 text-white hover:bg-white/30 focus:ring-white/30">
                  <SelectValue placeholder="Año" />
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

            {/* Botones de exportación con estilo mejorado */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleExportPDF}
                disabled={isPending}
                className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
              >
                <FileText className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
              <Button
                variant="secondary"
                onClick={handleExportExcel}
                disabled={isPending}
                className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Informe Acumulado por Rango de Fechas */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="pb-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100">
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 shadow-md">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-semibold text-slate-800">Informe Acumulado</span>
              <p className="text-sm font-normal text-slate-500">Recibos y Egresos por rango de fechas</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {/* Selector de fechas */}
          <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <CalendarRange className="h-4 w-4 inline mr-1" />
                Fecha Inicio
              </label>
              <Input
                type="date"
                value={acumuladoFechaInicio}
                onChange={(e) => setAcumuladoFechaInicio(e.target.value)}
                className="border-2 border-slate-200 focus:border-teal-400"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <CalendarRange className="h-4 w-4 inline mr-1" />
                Fecha Fin
              </label>
              <Input
                type="date"
                value={acumuladoFechaFin}
                onChange={(e) => setAcumuladoFechaFin(e.target.value)}
                className="border-2 border-slate-200 focus:border-teal-400"
              />
            </div>
            <Button
              onClick={handleLoadAcumulado}
              disabled={loadingAcumulado}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-md"
            >
              {loadingAcumulado ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generar Informe
                </>
              )}
            </Button>
          </div>

          {/* Resultados del informe acumulado */}
          {acumuladoData && (
            <div className="space-y-6">
              {/* Encabezado con periodo */}
              <div className="text-center p-3 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-lg">
                <p className="text-sm text-teal-700">
                  Periodo: <span className="font-semibold">{new Date(acumuladoData.fechaInicio).toLocaleDateString("es-ES")}</span>
                  {" "} al {" "}
                  <span className="font-semibold">{new Date(acumuladoData.fechaFin).toLocaleDateString("es-ES")}</span>
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Recibos (Ingresos) */}
                <div className="rounded-xl border-2 border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-5">
                  <h4 className="text-sm font-bold text-green-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <ArrowUpCircle className="h-4 w-4" />
                    Recibos (Ingresos)
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-slate-600">Gastos Comunes</span>
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency(acumuladoData.recibos.gastosComunes)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-slate-600">Fondo de Reserva</span>
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency(acumuladoData.recibos.fondoReserva)}
                      </span>
                    </div>
                    <div className="border-t border-green-200 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Total Recibos</span>
                        <span className="text-xl font-bold text-green-800">
                          {formatCurrency(acumuladoData.recibos.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Egresos */}
                <div className="rounded-xl border-2 border-red-100 bg-gradient-to-br from-red-50 to-rose-50 p-5">
                  <h4 className="text-sm font-bold text-red-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <ArrowDownCircle className="h-4 w-4" />
                    Egresos (Pagos)
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-slate-600">Gastos Comunes</span>
                      <span className="text-lg font-bold text-red-700">
                        {formatCurrency(acumuladoData.egresos.gastosComunes)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-slate-600">Fondo de Reserva</span>
                      <span className="text-lg font-bold text-red-700">
                        {formatCurrency(acumuladoData.egresos.fondoReserva)}
                      </span>
                    </div>
                    <div className="border-t border-red-200 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Total Egresos</span>
                        <span className="text-xl font-bold text-red-800">
                          {formatCurrency(acumuladoData.egresos.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Balance */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-4 text-center">
                  Balance (Recibos - Egresos)
                </h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-3 bg-white/10 rounded-lg">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Gastos Comunes</p>
                    <p className={`text-2xl font-bold ${acumuladoData.balance.gastosComunes >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(acumuladoData.balance.gastosComunes)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-white/10 rounded-lg">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Fondo de Reserva</p>
                    <p className={`text-2xl font-bold ${acumuladoData.balance.fondoReserva >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(acumuladoData.balance.fondoReserva)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-white/20 rounded-lg">
                    <p className="text-xs text-slate-300 uppercase tracking-wide mb-1">Balance Total</p>
                    <p className={`text-2xl font-bold ${acumuladoData.balance.total >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(acumuladoData.balance.total)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!acumuladoData && !loadingAcumulado && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <div className="rounded-full bg-slate-100 p-4 mb-3">
                <BarChart3 className="h-8 w-8 text-slate-300" />
              </div>
              <p className="font-medium text-slate-500">Selecciona un rango de fechas</p>
              <p className="text-sm text-slate-400">Haz clic en &quot;Generar Informe&quot; para ver los datos acumulados</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isPending && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-600">Cargando datos...</span>
        </div>
      )}

      {!isPending && (
        <>
          {/* Resumen de totales - Diseño mejorado */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100"></div>
              <CardContent className="relative p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="rounded-xl bg-slate-200/80 p-2.5 group-hover:scale-110 transition-transform duration-300">
                      <Wallet className="h-5 w-5 text-slate-600" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Anterior</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Saldo Anterior</p>
                    <p className="text-xl font-bold text-slate-800">
                      {formatCurrency(data.totales.totalSaldoAnterior)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-green-100"></div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-200/30 rounded-full -mr-10 -mt-10"></div>
              <CardContent className="relative p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="rounded-xl bg-green-200/80 p-2.5 group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="text-[10px] font-medium text-green-500 uppercase tracking-wider">Ingresos</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-green-600/80 mb-1">Pagos del Mes</p>
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(data.totales.totalPagosMes)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100"></div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200/30 rounded-full -mr-10 -mt-10"></div>
              <CardContent className="relative p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="rounded-xl bg-blue-200/80 p-2.5 group-hover:scale-110 transition-transform duration-300">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-[10px] font-medium text-blue-500 uppercase tracking-wider">Comunes</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-600/80 mb-1">Gastos Comunes</p>
                    <p className="text-xl font-bold text-blue-700">
                      {formatCurrency(data.totales.totalGastosComunesMes)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-purple-100"></div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-200/30 rounded-full -mr-10 -mt-10"></div>
              <CardContent className="relative p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="rounded-xl bg-purple-200/80 p-2.5 group-hover:scale-110 transition-transform duration-300">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="text-[10px] font-medium text-purple-500 uppercase tracking-wider">Reserva</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-purple-600/80 mb-1">Fondo Reserva</p>
                    <p className="text-xl font-bold text-purple-700">
                      {formatCurrency(data.totales.totalFondoReservaMes)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 ${
              data.totales.totalSaldoActual > 0 ? "ring-2 ring-red-200" : "ring-2 ring-green-200"
            }`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${
                data.totales.totalSaldoActual > 0
                  ? "from-red-50 to-red-100"
                  : "from-emerald-50 to-green-100"
              }`}></div>
              <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -mr-10 -mt-10 ${
                data.totales.totalSaldoActual > 0 ? "bg-red-200/30" : "bg-green-200/30"
              }`}></div>
              <CardContent className="relative p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className={`rounded-xl p-2.5 group-hover:scale-110 transition-transform duration-300 ${
                      data.totales.totalSaldoActual > 0 ? "bg-red-200/80" : "bg-green-200/80"
                    }`}>
                      <TrendingDown className={`h-5 w-5 ${
                        data.totales.totalSaldoActual > 0 ? "text-red-600" : "text-green-600"
                      }`} />
                    </div>
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${
                      data.totales.totalSaldoActual > 0 ? "text-red-500" : "text-green-500"
                    }`}>Actual</span>
                  </div>
                  <div>
                    <p className={`text-xs font-medium mb-1 ${
                      data.totales.totalSaldoActual > 0 ? "text-red-600/80" : "text-green-600/80"
                    }`}>Saldo Actual</p>
                    <p className={`text-xl font-bold ${
                      data.totales.totalSaldoActual > 0 ? "text-red-700" : "text-green-700"
                    }`}>
                      {formatCurrency(data.totales.totalSaldoActual)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumen de Cobros y Recaudación */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
              <CardTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-md">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-semibold text-slate-800">Cobrado vs Recaudado</span>
                  <p className="text-sm font-normal text-slate-500">{getMesLabel()} - Comparativo de facturación y cobranza</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Gastos Comunes */}
                <div className="rounded-xl border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
                  <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Gastos Comunes
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-slate-600">Total Cobrado (Facturado)</span>
                      <span className="text-lg font-bold text-blue-700">
                        {formatCurrency(data.totales.totalGastosComunesMes)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-slate-600">Total Recaudado (Pagado)</span>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(data.resumenBancario.ingresoGastosComunes)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-slate-600">Total Pagado (Egresos)</span>
                      <span className="text-lg font-bold text-red-600">
                        {formatCurrency(data.resumenBancario.egresoGastosComunes)}
                      </span>
                    </div>
                    <div className="border-t border-blue-200 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Diferencia Cobrado - Recaudado</span>
                        <span className={`text-lg font-bold ${
                          data.totales.totalGastosComunesMes - data.resumenBancario.ingresoGastosComunes > 0
                            ? "text-amber-600"
                            : "text-green-600"
                        }`}>
                          {formatCurrency(data.totales.totalGastosComunesMes - data.resumenBancario.ingresoGastosComunes)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fondo de Reserva */}
                <div className="rounded-xl border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-violet-50 p-5">
                  <h4 className="text-sm font-bold text-purple-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Fondo de Reserva
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-slate-600">Total Cobrado (Facturado)</span>
                      <span className="text-lg font-bold text-purple-700">
                        {formatCurrency(data.totales.totalFondoReservaMes)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-slate-600">Total Recaudado (Pagado)</span>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(data.resumenBancario.ingresoFondoReserva)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                      <span className="text-sm text-slate-600">Total Pagado (Egresos)</span>
                      <span className="text-lg font-bold text-red-600">
                        {formatCurrency(data.resumenBancario.egresoFondoReserva)}
                      </span>
                    </div>
                    <div className="border-t border-purple-200 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Diferencia Cobrado - Recaudado</span>
                        <span className={`text-lg font-bold ${
                          data.totales.totalFondoReservaMes - data.resumenBancario.ingresoFondoReserva > 0
                            ? "text-amber-600"
                            : "text-green-600"
                        }`}>
                          {formatCurrency(data.totales.totalFondoReservaMes - data.resumenBancario.ingresoFondoReserva)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen Total */}
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Cobrado</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(data.totales.totalGastosComunesMes + data.totales.totalFondoReservaMes)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Recaudado</p>
                    <p className="text-2xl font-bold text-green-400">
                      {formatCurrency(data.resumenBancario.ingresoGastosComunes + data.resumenBancario.ingresoFondoReserva)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Egresos</p>
                    <p className="text-2xl font-bold text-red-400">
                      {formatCurrency(data.resumenBancario.egresoGastosComunes + data.resumenBancario.egresoFondoReserva)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen Bancario - Diseño mejorado */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-md">
                  <Landmark className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-semibold text-slate-800">Movimientos Bancarios</span>
                  <p className="text-sm font-normal text-slate-500">{getMesLabel()} - Ingresos y egresos del banco</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {/* Ingresos */}
                <div className="group relative rounded-xl border-2 border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-4 hover:border-green-200 hover:shadow-md transition-all duration-300">
                  <div className="absolute top-0 right-0 h-16 w-16 bg-green-100/50 rounded-full -mr-8 -mt-8"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="rounded-lg bg-green-100 p-1.5">
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                        Recaudado
                      </span>
                    </div>
                    <p className="text-sm text-green-600/80 mb-1">Gastos Comunes</p>
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(data.resumenBancario.ingresoGastosComunes)}
                    </p>
                  </div>
                </div>

                <div className="group relative rounded-xl border-2 border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-4 hover:border-green-200 hover:shadow-md transition-all duration-300">
                  <div className="absolute top-0 right-0 h-16 w-16 bg-green-100/50 rounded-full -mr-8 -mt-8"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="rounded-lg bg-green-100 p-1.5">
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                        Recaudado
                      </span>
                    </div>
                    <p className="text-sm text-green-600/80 mb-1">Fondo Reserva</p>
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(data.resumenBancario.ingresoFondoReserva)}
                    </p>
                  </div>
                </div>

                {/* Egresos */}
                <div className="group relative rounded-xl border-2 border-red-100 bg-gradient-to-br from-red-50 to-rose-50 p-4 hover:border-red-200 hover:shadow-md transition-all duration-300">
                  <div className="absolute top-0 right-0 h-16 w-16 bg-red-100/50 rounded-full -mr-8 -mt-8"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="rounded-lg bg-red-100 p-1.5">
                        <ArrowDownCircle className="h-4 w-4 text-red-600" />
                      </div>
                      <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                        Pagado
                      </span>
                    </div>
                    <p className="text-sm text-red-600/80 mb-1">Gastos Comunes</p>
                    <p className="text-xl font-bold text-red-700">
                      {formatCurrency(data.resumenBancario.egresoGastosComunes)}
                    </p>
                  </div>
                </div>

                <div className="group relative rounded-xl border-2 border-red-100 bg-gradient-to-br from-red-50 to-rose-50 p-4 hover:border-red-200 hover:shadow-md transition-all duration-300">
                  <div className="absolute top-0 right-0 h-16 w-16 bg-red-100/50 rounded-full -mr-8 -mt-8"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="rounded-lg bg-red-100 p-1.5">
                        <ArrowDownCircle className="h-4 w-4 text-red-600" />
                      </div>
                      <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                        Pagado
                      </span>
                    </div>
                    <p className="text-sm text-red-600/80 mb-1">Fondo Reserva</p>
                    <p className="text-xl font-bold text-red-700">
                      {formatCurrency(data.resumenBancario.egresoFondoReserva)}
                    </p>
                  </div>
                </div>

                {/* Saldo Bancario - Destacado */}
                <div className="group relative rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="absolute top-0 right-0 h-20 w-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="absolute bottom-0 left-0 h-12 w-12 bg-white/5 rounded-full -ml-6 -mb-6"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="rounded-lg bg-white/20 p-1.5">
                        <Landmark className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-blue-100 uppercase tracking-wide">
                        Total
                      </span>
                    </div>
                    <p className="text-sm text-blue-100 mb-1">Saldo Bancario</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(data.resumenBancario.saldoBancarioTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mini Bitácora de Avisos - Diseño mejorado */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
              <CardTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-md">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-semibold text-slate-800">Avisos para el Informe</span>
                  <p className="text-sm font-normal text-slate-500">{getMesLabel()} - Arrastra para reordenar</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {/* Formulario para agregar nuevo aviso */}
              <div className="flex gap-3 mb-6">
                <Textarea
                  placeholder="Escribe un aviso para incluir en el informe..."
                  value={nuevoAviso}
                  onChange={(e) => setNuevoAviso(e.target.value)}
                  className="flex-1 min-h-[70px] resize-none border-2 border-slate-200 focus:border-amber-400 rounded-xl transition-colors"
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
                  className="self-end bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>

              {/* Lista de avisos */}
              {avisos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="rounded-full bg-slate-100 p-4 mb-3">
                    <MessageSquare className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-500">No hay avisos para este mes</p>
                  <p className="text-sm text-slate-400">Agrega avisos que aparecerán en los informes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {avisos.map((aviso, index) => (
                    <div
                      key={aviso.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                        draggedIndex === index
                          ? "border-amber-400 bg-amber-50 shadow-md"
                          : aviso.activo
                          ? "border-slate-200 bg-white hover:border-slate-300"
                          : "border-slate-200 bg-slate-50 opacity-60"
                      }`}
                    >
                      {/* Handle para arrastrar */}
                      <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 pt-1">
                        <GripVertical className="h-5 w-5" />
                      </div>

                      {/* Número de orden */}
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-sm font-medium flex items-center justify-center">
                        {index + 1}
                      </div>

                      {/* Contenido del aviso */}
                      <div className="flex-1 min-w-0">
                        {editingId === aviso.id ? (
                          <div className="flex gap-2">
                            <Textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="flex-1 min-h-[60px] resize-none"
                              autoFocus
                            />
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUpdateAviso(aviso.id)}
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingId(null)
                                  setEditingText("")
                                }}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-sm whitespace-pre-wrap ${!aviso.activo && "line-through"}`}>
                            {aviso.texto}
                          </p>
                        )}
                      </div>

                      {/* Acciones */}
                      {editingId !== aviso.id && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleAviso(aviso.id, aviso.activo)}
                            className={`h-8 w-8 p-0 ${
                              aviso.activo
                                ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                : "text-slate-400 hover:text-slate-600"
                            }`}
                            title={aviso.activo ? "Desactivar (no se imprimirá)" : "Activar (se imprimirá)"}
                          >
                            {aviso.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(aviso.id)
                              setEditingText(aviso.texto)
                            }}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteAviso(aviso.id)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Contador de avisos activos */}
              {avisos.length > 0 && (
                <div className="mt-3 text-xs text-slate-500 text-right">
                  {avisos.filter((a) => a.activo).length} de {avisos.length} aviso(s) se incluirán en el informe
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie de Página del Informe - Diseño mejorado */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700 shadow-md">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-semibold text-slate-800">Pie de Página</span>
                  <p className="text-sm font-normal text-slate-500">Aparecerá en la parte inferior del PDF</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {editingPiePagina ? (
                <div className="flex gap-3">
                  <Input
                    value={piePaginaTemp}
                    onChange={(e) => setPiePaginaTemp(e.target.value)}
                    placeholder="Escribe el pie de página..."
                    className="flex-1 border-2 border-slate-200 focus:border-blue-400 rounded-xl transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSavePiePagina()
                      } else if (e.key === "Escape") {
                        handleCancelPiePagina()
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSavePiePagina}
                    disabled={savingPiePagina}
                    className="px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl"
                  >
                    {savingPiePagina ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelPiePagina}
                    disabled={savingPiePagina}
                    className="px-4 rounded-xl hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 bg-gradient-to-r from-slate-50 to-white group hover:border-slate-200 transition-colors">
                  <span className="text-sm text-slate-700">{piePagina}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPiePaginaTemp(piePagina)
                      setEditingPiePagina(true)
                    }}
                    className="h-9 w-9 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabla de apartamentos - Diseño mejorado */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-slate-800 to-slate-900">
              <CardTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-semibold text-white">Desglose por Apartamento</span>
                  <p className="text-sm font-normal text-slate-300">{getMesLabel()}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.apartamentos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="rounded-full bg-slate-100 p-5 mb-4">
                    <Building2 className="h-10 w-10 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-500">No hay apartamentos registrados</p>
                  <p className="text-sm text-slate-400">Agrega apartamentos para ver el desglose</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                        <TableHead className="font-bold text-slate-700 py-4">Apto</TableHead>
                        <TableHead className="font-bold text-slate-700">Tipo</TableHead>
                        <TableHead className="text-right font-bold text-slate-700">
                          Saldo Anterior
                        </TableHead>
                        <TableHead className="text-right font-bold text-slate-700">
                          Pagos del Mes
                        </TableHead>
                        <TableHead className="text-right font-bold text-slate-700">
                          Gastos Comunes
                        </TableHead>
                        <TableHead className="text-right font-bold text-slate-700">
                          Fondo Reserva
                        </TableHead>
                        <TableHead className="text-right font-bold text-slate-700">
                          Saldo Actual
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.apartamentos.map((apt, index) => (
                        <TableRow
                          key={apt.apartamentoId}
                          className={`hover:bg-blue-50/50 transition-colors ${
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                          }`}
                        >
                          <TableCell className="font-semibold text-slate-800 py-4">
                            <div className="flex items-center gap-2">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                                {apt.numero}
                              </span>
                              {apt.piso && (
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                  Piso {apt.piso}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`font-medium ${
                                apt.tipoOcupacion === "PROPIETARIO"
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : "border-purple-200 bg-purple-50 text-purple-700"
                              }`}
                            >
                              {tipoOcupacionLabels[apt.tipoOcupacion]}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <span
                              className={`font-medium ${
                                apt.saldoAnterior > 0
                                  ? "text-red-600"
                                  : apt.saldoAnterior < 0
                                  ? "text-green-600"
                                  : "text-slate-500"
                              }`}
                            >
                              {formatCurrency(apt.saldoAnterior)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-medium text-green-600">
                              {formatCurrency(apt.pagosMes)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-600">
                            {formatCurrency(apt.gastosComunesMes)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-600">
                            {formatCurrency(apt.fondoReservaMes)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold text-sm ${
                                apt.saldoActual > 0
                                  ? "bg-red-50 text-red-700"
                                  : apt.saldoActual < 0
                                  ? "bg-green-50 text-green-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {formatCurrency(apt.saldoActual)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Fila de totales - Diseño destacado */}
                      <TableRow className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                        <TableCell colSpan={2} className="py-4">
                          <span className="font-bold text-white text-base">TOTALES</span>
                        </TableCell>
                        <TableCell className="text-right font-bold text-white">
                          {formatCurrency(data.totales.totalSaldoAnterior)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-400">
                          {formatCurrency(data.totales.totalPagosMes)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-white">
                          {formatCurrency(data.totales.totalGastosComunesMes)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-white">
                          {formatCurrency(data.totales.totalFondoReservaMes)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`inline-flex items-center px-3 py-1.5 rounded-lg font-bold ${
                              data.totales.totalSaldoActual > 0
                                ? "bg-red-500 text-white"
                                : "bg-green-500 text-white"
                            }`}
                          >
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
        </>
      )}
    </div>
  )
}
