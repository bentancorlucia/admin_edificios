"use client"

import { useState, useTransition, useEffect, useMemo } from "react"
import { BackToHome } from "@/components/back-to-home"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Loader2,
  PieChart,
  Calendar,
  CalendarRange,
  BarChart3,
  Receipt,
  TrendingUp,
  Target,
  Percent
} from "lucide-react"
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  getAnalisisData,
  getAnalisisDataPorRango,
  getServiciosConActividad,
  getAnalisisDetalladoPorServicioMes,
  getReporteGastosData,
  type AnalisisData,
  type AnalisisDataRango,
  type AnalisisDetalladoServicios,
  type TipoServicio,
  type ReporteGastosData,
  type ProyeccionMesItem,
} from "@/lib/database"
import { formatCurrency } from "@/lib/utils"

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

interface AnalisisClientProps {
  initialData: AnalisisData
  initialMes: number
  initialAnio: number
  tiposServicio: TipoServicio[]
}

export function AnalisisClient({
  initialData,
  initialMes,
  initialAnio,
  tiposServicio: initialTiposServicio,
}: AnalisisClientProps) {
  // Estados para vista mensual
  const [data, setData] = useState<AnalisisData>(initialData)
  const [mes, setMes] = useState(initialMes)
  const [anio, setAnio] = useState(initialAnio)
  const [clasificacion, setClasificacion] = useState<'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS'>('AMBOS')
  const [servicioId, setServicioId] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  // Estados para vista por rango de fechas
  const [fechaInicio, setFechaInicio] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  )
  const [fechaFin, setFechaFin] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [dataRango, setDataRango] = useState<AnalisisDataRango | null>(null)
  const [serviciosConActividad, setServiciosConActividad] = useState<TipoServicio[]>([])
  const [loadingRango, setLoadingRango] = useState(false)

  // Estados para reporte detallado por servicio/mes
  const [reporteDetallado, setReporteDetallado] = useState<AnalisisDetalladoServicios | null>(null)
  const [loadingDetallado, setLoadingDetallado] = useState(false)
  const [mostrarReporteDetallado, setMostrarReporteDetallado] = useState(false)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  // Estados para Reporte de Gastos
  const [reporteMesInicio, setReporteMesInicio] = useState(1)
  const [reporteAnioInicio, setReporteAnioInicio] = useState(currentYear)
  const [reporteMesFin, setReporteMesFin] = useState(new Date().getMonth() + 1)
  const [reporteAnioFin, setReporteAnioFin] = useState(currentYear)
  const [reporteGastos, setReporteGastos] = useState<ReporteGastosData | null>(null)
  const [loadingReporte, setLoadingReporte] = useState(false)
  const [mesesProyeccion, setMesesProyeccion] = useState(6)
  const [proyeccion, setProyeccion] = useState<ProyeccionMesItem[] | null>(null)

  // Cargar servicios con actividad cuando cambia el rango de fechas
  useEffect(() => {
    async function loadServiciosConActividad() {
      try {
        const servicios = await getServiciosConActividad(fechaInicio, fechaFin)
        setServiciosConActividad(servicios)
      } catch (error) {
        console.error("Error cargando servicios con actividad:", error)
      }
    }
    loadServiciosConActividad()
  }, [fechaInicio, fechaFin])

  // Servicios a mostrar en el selector (con actividad en el período)
  const serviciosParaFiltro = useMemo(() => {
    return serviciosConActividad.length > 0 ? serviciosConActividad : initialTiposServicio
  }, [serviciosConActividad, initialTiposServicio])

  const handleDataChange = (
    newMes?: number,
    newAnio?: number,
    newClasificacion?: 'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS',
    newServicioId?: string | null
  ) => {
    const targetMes = newMes ?? mes
    const targetAnio = newAnio ?? anio
    const targetClasificacion = newClasificacion ?? clasificacion
    const targetServicioId = newServicioId !== undefined ? newServicioId : servicioId

    if (newMes !== undefined) setMes(newMes)
    if (newAnio !== undefined) setAnio(newAnio)
    if (newClasificacion !== undefined) setClasificacion(newClasificacion)
    if (newServicioId !== undefined) setServicioId(newServicioId)

    startTransition(async () => {
      const newData = await getAnalisisData(targetMes, targetAnio, targetClasificacion, targetServicioId)
      setData(newData)
    })
  }

  const handlePrevMonth = () => {
    let newMes = mes - 1
    let newAnio = anio
    if (newMes < 1) {
      newMes = 12
      newAnio = anio - 1
    }
    handleDataChange(newMes, newAnio)
  }

  const handleNextMonth = () => {
    let newMes = mes + 1
    let newAnio = anio
    if (newMes > 12) {
      newMes = 1
      newAnio = anio + 1
    }
    handleDataChange(newMes, newAnio)
  }

  // Handler para cargar datos por rango
  const handleLoadRango = async () => {
    setLoadingRango(true)
    try {
      const newData = await getAnalisisDataPorRango(fechaInicio, fechaFin, clasificacion, servicioId)
      setDataRango(newData)
    } catch (error) {
      console.error("Error cargando datos por rango:", error)
    } finally {
      setLoadingRango(false)
    }
  }

  // Handler para generar reporte detallado por servicio/mes
  const handleGenerarReporteDetallado = async () => {
    setLoadingDetallado(true)
    try {
      const reporte = await getAnalisisDetalladoPorServicioMes(fechaInicio, fechaFin, clasificacion)
      setReporteDetallado(reporte)
      setMostrarReporteDetallado(true)
    } catch (error) {
      console.error("Error generando reporte detallado:", error)
    } finally {
      setLoadingDetallado(false)
    }
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("es-UY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const getClasificacionLabel = (clasificacion: string) => {
    switch (clasificacion) {
      case 'GASTO_COMUN':
        return 'Gasto Común'
      case 'FONDO_RESERVA':
        return 'Fondo Reserva'
      default:
        return clasificacion
    }
  }

  const getClasificacionBadgeVariant = (clasificacion: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (clasificacion) {
      case 'GASTO_COMUN':
        return 'default'
      case 'FONDO_RESERVA':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  // Handler para generar reporte de gastos
  const handleGenerarReporteGastos = async () => {
    setLoadingReporte(true)
    setProyeccion(null)
    try {
      const fi = new Date(reporteAnioInicio, reporteMesInicio - 1, 1).toISOString()
      const ff = new Date(reporteAnioFin, reporteMesFin, 0, 23, 59, 59, 999).toISOString()
      const result = await getReporteGastosData(fi, ff)
      setReporteGastos(result)
    } catch (error) {
      console.error("Error generando reporte de gastos:", error)
    } finally {
      setLoadingReporte(false)
    }
  }

  // Handler para calcular proyección (client-side)
  const handleCalcularProyeccion = () => {
    if (!reporteGastos || reporteGastos.meses.length === 0) return
    const { resumen, meses: mesesData } = reporteGastos
    const cantMeses = mesesData.length
    const avgCargos = resumen.totalCargos / cantMeses
    const avgCobros = resumen.totalCobrado / cantMeses

    let pendienteAcumulado = resumen.totalPendiente
    const result: ProyeccionMesItem[] = []

    const ultimoMes = mesesData[mesesData.length - 1]
    let mesActual = ultimoMes.mes
    let anioActual = ultimoMes.anio

    const mesesNombresCortos = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

    for (let i = 0; i < mesesProyeccion; i++) {
      mesActual++
      if (mesActual > 12) { mesActual = 1; anioActual++ }
      pendienteAcumulado += (avgCargos - avgCobros)
      result.push({
        mes: mesActual,
        anio: anioActual,
        mesLabel: `${mesesNombresCortos[mesActual - 1]} ${anioActual}`,
        cargosProyectados: avgCargos,
        cobrosProyectados: avgCobros,
        pendienteAcumulado: Math.max(0, pendienteAcumulado),
      })
    }
    setProyeccion(result)
  }

  // Tooltip formatter para recharts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currencyFormatter = (value: any) => formatCurrency(Number(value || 0))

  // Calcular el máximo para la escala del gráfico de barras
  const maxMontoPorMes = useMemo(() => {
    if (!reporteDetallado) return 0
    return Math.max(...reporteDetallado.totalesPorMes.map(m => m.monto), 1)
  }, [reporteDetallado])

  return (
    <div className="p-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <BackToHome />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <PieChart className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Análisis de Egresos</h1>
              <p className="text-sm text-slate-500">Detalle y totalizador por servicio</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="mensual" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="mensual" className="gap-2">
              <Calendar className="h-4 w-4" />
              Por Mes
            </TabsTrigger>
            <TabsTrigger value="rango" className="gap-2">
              <CalendarRange className="h-4 w-4" />
              Por Rango de Fechas
            </TabsTrigger>
            <TabsTrigger value="reporte-gastos" className="gap-2">
              <Receipt className="h-4 w-4" />
              Reporte de Gastos
            </TabsTrigger>
          </TabsList>

          {/* Tab: Análisis Mensual */}
          <TabsContent value="mensual" className="space-y-6">
            {/* Selector de fecha mensual */}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevMonth}
                disabled={isPending}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Select
                value={mes.toString()}
                onValueChange={(value) => handleDataChange(parseInt(value), undefined)}
              >
                <SelectTrigger className="w-[130px] h-8 bg-transparent border-0 focus:ring-0">
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
                onValueChange={(value) => handleDataChange(undefined, parseInt(value))}
              >
                <SelectTrigger className="w-[90px] h-8 bg-transparent border-0 focus:ring-0">
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

              <Button
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
                disabled={isPending}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-500 ml-2" />}
            </div>

            {/* Filtros para vista mensual */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Clasificación</label>
                    <Select
                      value={clasificacion}
                      onValueChange={(value: 'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS') =>
                        handleDataChange(undefined, undefined, value)
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AMBOS">Ambos</SelectItem>
                        <SelectItem value="GASTO_COMUN">Gasto Común</SelectItem>
                        <SelectItem value="FONDO_RESERVA">Fondo de Reserva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Tipo de Servicio</label>
                    <Select
                      value={servicioId || "TODOS"}
                      onValueChange={(value) =>
                        handleDataChange(undefined, undefined, undefined, value === "TODOS" ? null : value)
                      }
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos los servicios</SelectItem>
                        {serviciosParaFiltro.map((tipo) => (
                          <SelectItem key={tipo.id} value={tipo.id}>
                            {tipo.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumen de totales */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                      <TrendingDown className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Total Egresos</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(data.totales.montoTotal)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                      <TrendingDown className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Gastos Comunes</p>
                      <p className="text-xl font-bold text-blue-600">{formatCurrency(data.totales.montoGastoComun)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                      <TrendingDown className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Fondo de Reserva</p>
                      <p className="text-xl font-bold text-orange-600">{formatCurrency(data.totales.montoFondoReserva)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                      <span className="text-lg font-bold text-green-600">#</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Transacciones</p>
                      <p className="text-xl font-bold text-green-600">{data.totales.cantidadTotal}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabla de análisis por servicio */}
            <Card>
              <CardHeader>
                <CardTitle>Detalle por Servicio</CardTitle>
              </CardHeader>
              <CardContent>
                {data.items.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No hay egresos registrados para el período seleccionado
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.items.map((item) => {
                      const isExpanded = expandedItems.has(item.servicioId || 'SIN_SERVICIO')
                      const itemKey = item.servicioId || 'SIN_SERVICIO'

                      return (
                        <Collapsible key={itemKey} open={isExpanded}>
                          <div className="border rounded-lg">
                            <CollapsibleTrigger asChild>
                              <button
                                onClick={() => toggleExpanded(itemKey)}
                                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-slate-500" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-slate-500" />
                                  )}
                                  <Badge variant={item.servicioColor as "default" | "secondary" | "destructive" | "outline"}>
                                    {item.servicioNombre}
                                  </Badge>
                                  <span className="text-sm text-slate-500">
                                    ({item.cantidad} {item.cantidad === 1 ? 'egreso' : 'egresos'})
                                  </span>
                                </div>
                                <span className="text-lg font-semibold text-slate-900">
                                  {formatCurrency(item.montoTotal)}
                                </span>
                              </button>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="border-t">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[100px]">Fecha</TableHead>
                                      <TableHead>Descripción</TableHead>
                                      <TableHead className="w-[130px]">Clasificación</TableHead>
                                      <TableHead className="w-[120px]">Banco</TableHead>
                                      <TableHead className="text-right w-[120px]">Monto</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {item.detalles.map((detalle) => (
                                      <TableRow key={detalle.id}>
                                        <TableCell className="text-slate-600">
                                          {formatDate(detalle.fecha)}
                                        </TableCell>
                                        <TableCell>{detalle.descripcion}</TableCell>
                                        <TableCell>
                                          <Badge variant={getClasificacionBadgeVariant(detalle.clasificacion)}>
                                            {getClasificacionLabel(detalle.clasificacion)}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-slate-600">{detalle.banco}</TableCell>
                                        <TableCell className="text-right font-medium">
                                          {formatCurrency(detalle.monto)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabla resumen totalizador */}
            {data.items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Resumen Totalizador</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Servicio</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((item) => (
                        <TableRow key={item.servicioId || 'SIN_SERVICIO'}>
                          <TableCell>
                            <Badge variant={item.servicioColor as "default" | "secondary" | "destructive" | "outline"}>
                              {item.servicioNombre}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{item.cantidad}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.montoTotal)}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">
                            {data.totales.montoTotal > 0
                              ? ((item.montoTotal / data.totales.montoTotal) * 100).toFixed(1)
                              : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-center">{data.totales.cantidadTotal}</TableCell>
                        <TableCell className="text-right">{formatCurrency(data.totales.montoTotal)}</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Análisis por Rango de Fechas */}
          <TabsContent value="rango" className="space-y-6">
            {/* Selector de rango de fechas y filtros */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarRange className="h-4 w-4 text-purple-600" />
                  Filtros por Rango de Fechas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-4 rounded-lg bg-slate-50 p-4">
                  <div className="flex-1 min-w-[180px]">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Fecha Inicio
                    </label>
                    <Input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Fecha Fin
                    </label>
                    <Input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Clasificación
                    </label>
                    <Select
                      value={clasificacion}
                      onValueChange={(value: 'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS') =>
                        setClasificacion(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AMBOS">Ambos</SelectItem>
                        <SelectItem value="GASTO_COMUN">Gasto Común</SelectItem>
                        <SelectItem value="FONDO_RESERVA">Fondo de Reserva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Tipo de Servicio
                      {serviciosConActividad.length > 0 && (
                        <span className="ml-1 text-xs text-slate-400">
                          ({serviciosConActividad.length} con actividad)
                        </span>
                      )}
                    </label>
                    <Select
                      value={servicioId || "TODOS"}
                      onValueChange={(value) => setServicioId(value === "TODOS" ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos los servicios</SelectItem>
                        {serviciosConActividad.map((tipo) => (
                          <SelectItem key={tipo.id} value={tipo.id}>
                            {tipo.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleLoadRango}
                    disabled={loadingRango}
                    className="gap-2"
                  >
                    {loadingRango ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PieChart className="h-4 w-4" />
                    )}
                    Generar Análisis
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleGenerarReporteDetallado}
                    disabled={loadingDetallado}
                    className="gap-2"
                  >
                    {loadingDetallado ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <BarChart3 className="h-4 w-4" />
                    )}
                    Reporte por Servicio/Mes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resultados del análisis por rango */}
            {dataRango && !mostrarReporteDetallado && (
              <>
                {/* Periodo info */}
                <div className="rounded-lg bg-purple-50 p-3 text-center text-sm text-purple-700">
                  Periodo: <span className="font-semibold">{formatDate(dataRango.fechaInicio)}</span>
                  {" "} al {" "}
                  <span className="font-semibold">{formatDate(dataRango.fechaFin)}</span>
                </div>

                {/* Resumen de totales */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                          <TrendingDown className="h-5 w-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Total Egresos</p>
                          <p className="text-xl font-bold text-slate-900">{formatCurrency(dataRango.totales.montoTotal)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                          <TrendingDown className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Gastos Comunes</p>
                          <p className="text-xl font-bold text-blue-600">{formatCurrency(dataRango.totales.montoGastoComun)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                          <TrendingDown className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Fondo de Reserva</p>
                          <p className="text-xl font-bold text-orange-600">{formatCurrency(dataRango.totales.montoFondoReserva)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                          <span className="text-lg font-bold text-green-600">#</span>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Transacciones</p>
                          <p className="text-xl font-bold text-green-600">{dataRango.totales.cantidadTotal}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabla resumen totalizador */}
                {dataRango.items.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Resumen por Servicio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Servicio</TableHead>
                            <TableHead className="text-center">Cantidad</TableHead>
                            <TableHead className="text-right">Monto Total</TableHead>
                            <TableHead className="text-right">% del Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dataRango.items.map((item) => (
                            <TableRow key={item.servicioId || 'SIN_SERVICIO'}>
                              <TableCell>
                                <Badge variant={item.servicioColor as "default" | "secondary" | "destructive" | "outline"}>
                                  {item.servicioNombre}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">{item.cantidad}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(item.montoTotal)}
                              </TableCell>
                              <TableCell className="text-right text-slate-600">
                                {dataRango.totales.montoTotal > 0
                                  ? ((item.montoTotal / dataRango.totales.montoTotal) * 100).toFixed(1)
                                  : 0}%
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-slate-50 font-bold">
                            <TableCell>TOTAL</TableCell>
                            <TableCell className="text-center">{dataRango.totales.cantidadTotal}</TableCell>
                            <TableCell className="text-right">{formatCurrency(dataRango.totales.montoTotal)}</TableCell>
                            <TableCell className="text-right">100%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {dataRango.items.length === 0 && (
                  <div className="text-center py-8 text-slate-500 border rounded-lg bg-slate-50">
                    No hay egresos registrados para el período seleccionado
                  </div>
                )}
              </>
            )}

            {/* Reporte Detallado por Servicio/Mes */}
            {mostrarReporteDetallado && reporteDetallado && (
              <>
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-teal-50 p-3 text-sm text-teal-700">
                    <span className="font-semibold">Reporte Detallado por Servicio/Mes</span>
                    {" - "}
                    {formatDate(reporteDetallado.fechaInicio)} al {formatDate(reporteDetallado.fechaFin)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMostrarReporteDetallado(false)}
                  >
                    Volver al Análisis
                  </Button>
                </div>

                {/* Gráfico de barras por mes - Totales */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-teal-600" />
                      Egresos Totales por Mes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {reporteDetallado.totalesPorMes.map((mes) => (
                        <div key={`${mes.mes}-${mes.anio}`} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{mes.mesLabel}</span>
                            <span className="font-semibold text-slate-900">{formatCurrency(mes.monto)}</span>
                          </div>
                          <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full transition-all duration-500"
                              style={{ width: `${(mes.monto / maxMontoPorMes) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Total General</span>
                      <span className="text-xl font-bold text-teal-600">
                        {formatCurrency(reporteDetallado.totalGeneral)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Detalle por Servicio con gráficos */}
                {reporteDetallado.servicios.map((servicio) => {
                  const maxMontoServicio = Math.max(...servicio.meses.map(m => m.monto), 1)

                  return (
                    <Card key={servicio.servicioId || 'SIN_SERVICIO'}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={servicio.servicioColor as "default" | "secondary" | "destructive" | "outline"}>
                              {servicio.servicioNombre}
                            </Badge>
                            <span className="text-sm text-slate-500">
                              ({servicio.cantidadTotal} {servicio.cantidadTotal === 1 ? 'egreso' : 'egresos'})
                            </span>
                          </div>
                          <span className="text-lg font-bold text-slate-900">
                            {formatCurrency(servicio.total)}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {servicio.meses.map((mes) => (
                            <div key={`${servicio.servicioId}-${mes.mes}-${mes.anio}`} className="flex items-center gap-3">
                              <span className="w-32 text-sm text-slate-600 truncate">{mes.mesLabel}</span>
                              <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                {mes.monto > 0 && (
                                  <div
                                    className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-500"
                                    style={{ width: `${(mes.monto / maxMontoServicio) * 100}%` }}
                                  />
                                )}
                              </div>
                              <span className="w-28 text-right text-sm font-medium text-slate-900">
                                {formatCurrency(mes.monto)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Tabla de detalle */}
                        <div className="mt-4 pt-4 border-t">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Mes</TableHead>
                                <TableHead className="text-center">Cantidad</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                                <TableHead className="text-right">% del Servicio</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {servicio.meses.filter(m => m.monto > 0).map((mes) => (
                                <TableRow key={`table-${servicio.servicioId}-${mes.mes}-${mes.anio}`}>
                                  <TableCell className="text-slate-600">{mes.mesLabel}</TableCell>
                                  <TableCell className="text-center">{mes.cantidad}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(mes.monto)}
                                  </TableCell>
                                  <TableCell className="text-right text-slate-600">
                                    {servicio.total > 0
                                      ? ((mes.monto / servicio.total) * 100).toFixed(1)
                                      : 0}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </>
            )}

            {/* Estado inicial sin datos */}
            {!dataRango && !mostrarReporteDetallado && !loadingRango && (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-slate-400">
                <CalendarRange className="mb-3 h-10 w-10" />
                <p className="font-medium">Selecciona un rango de fechas</p>
                <p className="text-sm">Haz clic en &quot;Generar Análisis&quot; para ver los datos</p>
              </div>
            )}
          </TabsContent>

          {/* Tab: Reporte de Gastos */}
          <TabsContent value="reporte-gastos" className="space-y-6">
            {/* Selector de período */}
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Desde</p>
                    <div className="flex gap-2">
                      <Select value={reporteMesInicio.toString()} onValueChange={(v) => setReporteMesInicio(Number(v))}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {meses.map((m) => (
                            <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={reporteAnioInicio.toString()} onValueChange={(v) => setReporteAnioInicio(Number(v))}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Hasta</p>
                    <div className="flex gap-2">
                      <Select value={reporteMesFin.toString()} onValueChange={(v) => setReporteMesFin(Number(v))}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {meses.map((m) => (
                            <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={reporteAnioFin.toString()} onValueChange={(v) => setReporteAnioFin(Number(v))}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleGenerarReporteGastos} disabled={loadingReporte}>
                    {loadingReporte ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                    Generar Reporte
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loadingReporte && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            )}

            {reporteGastos && !loadingReporte && (
              <>
                {/* Tarjetas resumen */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Cargos</p>
                          <p className="text-xl font-bold text-slate-900">{formatCurrency(reporteGastos.resumen.totalCargos)}</p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Receipt className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Cobrado</p>
                          <p className="text-xl font-bold text-green-600">{formatCurrency(reporteGastos.resumen.totalCobrado)}</p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Pendiente</p>
                          <p className={`text-xl font-bold ${reporteGastos.resumen.totalPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(reporteGastos.resumen.totalPendiente)}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                          <Target className="h-5 w-5 text-red-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Tasa de Cobro</p>
                          <p className={`text-xl font-bold ${reporteGastos.resumen.tasaCobroGeneral >= 80 ? 'text-green-600' : reporteGastos.resumen.tasaCobroGeneral >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {reporteGastos.resumen.tasaCobroGeneral.toFixed(1)}%
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <Percent className="h-5 w-5 text-amber-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Gráfico Cargos vs Cobrado */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Cargos vs Cobrado por Mes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={reporteGastos.meses.map(m => ({
                        name: m.mesLabel.split(' ')[0].substring(0, 3),
                        'Gastos Comunes': m.cargosGC,
                        'Fondo Reserva': m.cargosFR,
                        'Cobrado': m.cobradoTotal,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={currencyFormatter} />
                        <Legend />
                        <Bar dataKey="Gastos Comunes" stackId="cargos" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Fondo Reserva" stackId="cargos" fill="#f97316" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="Cobrado" stroke="#22c55e" strokeWidth={2.5} dot={{ fill: '#22c55e', r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico Morosidad */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Morosidad por Mes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={reporteGastos.meses.map(m => ({
                        name: m.mesLabel.split(' ')[0].substring(0, 3),
                        Pendiente: m.pendiente,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={currencyFormatter} />
                        <Area type="monotone" dataKey="Pendiente" fill="#fecaca" stroke="#ef4444" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Tabla desglose mensual */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Desglose Mensual</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mes</TableHead>
                            <TableHead className="text-right">Cargos GC</TableHead>
                            <TableHead className="text-right">Cargos FR</TableHead>
                            <TableHead className="text-right">Total Cargos</TableHead>
                            <TableHead className="text-right">Cobrado GC</TableHead>
                            <TableHead className="text-right">Cobrado FR</TableHead>
                            <TableHead className="text-right">Total Cobrado</TableHead>
                            <TableHead className="text-right">Pendiente</TableHead>
                            <TableHead className="text-right">% Cobro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reporteGastos.meses.map((m) => (
                            <TableRow key={`${m.mes}-${m.anio}`}>
                              <TableCell className="font-medium">{m.mesLabel}</TableCell>
                              <TableCell className="text-right">{formatCurrency(m.cargosGC)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(m.cargosFR)}</TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(m.cargosTotal)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatCurrency(m.cobradoGC)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatCurrency(m.cobradoFR)}</TableCell>
                              <TableCell className="text-right font-semibold text-green-600">{formatCurrency(m.cobradoTotal)}</TableCell>
                              <TableCell className={`text-right font-semibold ${m.pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(m.pendiente)}
                              </TableCell>
                              <TableCell className={`text-right ${m.tasaCobro >= 80 ? 'text-green-600' : m.tasaCobro >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {m.tasaCobro.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Fila de totales */}
                          <TableRow className="bg-slate-50 font-bold">
                            <TableCell>TOTAL</TableCell>
                            <TableCell className="text-right">{formatCurrency(reporteGastos.resumen.totalCargosGC)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(reporteGastos.resumen.totalCargosFR)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(reporteGastos.resumen.totalCargos)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(reporteGastos.resumen.totalCobradoGC)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(reporteGastos.resumen.totalCobradoFR)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(reporteGastos.resumen.totalCobrado)}</TableCell>
                            <TableCell className={`text-right ${reporteGastos.resumen.totalPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(reporteGastos.resumen.totalPendiente)}
                            </TableCell>
                            <TableCell className={`text-right ${reporteGastos.resumen.tasaCobroGeneral >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                              {reporteGastos.resumen.tasaCobroGeneral.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Desglose GC vs FR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-5">
                      <p className="text-xs font-semibold text-blue-700 mb-3 uppercase">Gastos Comunes</p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">Cargado</span>
                          <span className="text-sm font-semibold">{formatCurrency(reporteGastos.resumen.totalCargosGC)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">Cobrado</span>
                          <span className="text-sm font-semibold text-green-600">{formatCurrency(reporteGastos.resumen.totalCobradoGC)}</span>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Pendiente</span>
                            <span className={`text-sm font-bold ${reporteGastos.resumen.totalCargosGC - reporteGastos.resumen.totalCobradoGC > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(reporteGastos.resumen.totalCargosGC - reporteGastos.resumen.totalCobradoGC)}
                            </span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-slate-400">Tasa de cobro</span>
                            <span className="text-xs text-slate-500">
                              {reporteGastos.resumen.totalCargosGC > 0
                                ? ((reporteGastos.resumen.totalCobradoGC / reporteGastos.resumen.totalCargosGC) * 100).toFixed(1)
                                : '0.0'}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="p-5">
                      <p className="text-xs font-semibold text-orange-700 mb-3 uppercase">Fondo de Reserva</p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">Cargado</span>
                          <span className="text-sm font-semibold">{formatCurrency(reporteGastos.resumen.totalCargosFR)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">Cobrado</span>
                          <span className="text-sm font-semibold text-green-600">{formatCurrency(reporteGastos.resumen.totalCobradoFR)}</span>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Pendiente</span>
                            <span className={`text-sm font-bold ${reporteGastos.resumen.totalCargosFR - reporteGastos.resumen.totalCobradoFR > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(reporteGastos.resumen.totalCargosFR - reporteGastos.resumen.totalCobradoFR)}
                            </span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-slate-400">Tasa de cobro</span>
                            <span className="text-xs text-slate-500">
                              {reporteGastos.resumen.totalCargosFR > 0
                                ? ((reporteGastos.resumen.totalCobradoFR / reporteGastos.resumen.totalCargosFR) * 100).toFixed(1)
                                : '0.0'}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Proyección */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Proyección</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-4 mb-6">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Meses a proyectar</p>
                        <Input
                          type="number"
                          min={1}
                          max={24}
                          value={mesesProyeccion}
                          onChange={(e) => setMesesProyeccion(Math.max(1, Math.min(24, Number(e.target.value))))}
                          className="w-[100px]"
                        />
                      </div>
                      <Button variant="outline" onClick={handleCalcularProyeccion}>
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Calcular Proyección
                      </Button>
                    </div>

                    {proyeccion && (
                      <div className="space-y-6">
                        {/* Gráfico de proyección */}
                        <ResponsiveContainer width="100%" height={320}>
                          <ComposedChart data={[
                            ...reporteGastos.meses.map(m => ({
                              name: m.mesLabel.split(' ')[0].substring(0, 3),
                              Cargos: m.cargosTotal,
                              Cobrado: m.cobradoTotal,
                              'Pendiente Acum.': null as number | null,
                              tipo: 'historico',
                            })),
                            ...proyeccion.map(p => ({
                              name: p.mesLabel.split(' ')[0].substring(0, 3),
                              Cargos: p.cargosProyectados,
                              Cobrado: p.cobrosProyectados,
                              'Pendiente Acum.': p.pendienteAcumulado,
                              tipo: 'proyeccion',
                            })),
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={currencyFormatter} />
                            <Legend />
                            <Bar dataKey="Cargos" fill="#3b82f6" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Cobrado" fill="#22c55e" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="Pendiente Acum." stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#ef4444', r: 3 }} connectNulls={false} />
                          </ComposedChart>
                        </ResponsiveContainer>

                        {/* Tabla de proyección */}
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Mes</TableHead>
                                <TableHead className="text-right">Cargos Proyectados</TableHead>
                                <TableHead className="text-right">Cobros Proyectados</TableHead>
                                <TableHead className="text-right">Pendiente Acumulado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {proyeccion.map((p) => (
                                <TableRow key={`${p.mes}-${p.anio}`}>
                                  <TableCell className="font-medium">{p.mesLabel}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(p.cargosProyectados)}</TableCell>
                                  <TableCell className="text-right text-green-600">{formatCurrency(p.cobrosProyectados)}</TableCell>
                                  <TableCell className={`text-right font-semibold ${p.pendienteAcumulado > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(p.pendienteAcumulado)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
                          <p className="font-medium mb-1">Nota sobre la proyección</p>
                          <p>Basada en el promedio mensual del período seleccionado: cargos promedio de {formatCurrency(reporteGastos.resumen.totalCargos / reporteGastos.meses.length)} y cobros promedio de {formatCurrency(reporteGastos.resumen.totalCobrado / reporteGastos.meses.length)} por mes.</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* Estado inicial */}
            {!reporteGastos && !loadingReporte && (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-slate-400">
                <Receipt className="mb-3 h-10 w-10" />
                <p className="font-medium">Selecciona un período</p>
                <p className="text-sm">Haz clic en &quot;Generar Reporte&quot; para ver el análisis de gastos</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
