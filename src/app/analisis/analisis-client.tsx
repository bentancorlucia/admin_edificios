"use client"

import { useState, useTransition, useEffect, useMemo } from "react"
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
  BarChart3
} from "lucide-react"
import {
  getAnalisisData,
  getAnalisisDataPorRango,
  getServiciosConActividad,
  getAnalisisDetalladoPorServicioMes,
  type AnalisisData,
  type AnalisisDataRango,
  type AnalisisDetalladoServicios,
  type TipoServicio
} from "@/lib/database"

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

  // Calcular el máximo para la escala del gráfico de barras
  const maxMontoPorMes = useMemo(() => {
    if (!reporteDetallado) return 0
    return Math.max(...reporteDetallado.totalesPorMes.map(m => m.monto), 1)
  }, [reporteDetallado])

  return (
    <div className="p-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <PieChart className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Análisis de Egresos</h1>
            <p className="text-sm text-slate-500">Detalle y totalizador por servicio</p>
          </div>
        </div>

        <Tabs defaultValue="mensual" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="mensual" className="gap-2">
              <Calendar className="h-4 w-4" />
              Por Mes
            </TabsTrigger>
            <TabsTrigger value="rango" className="gap-2">
              <CalendarRange className="h-4 w-4" />
              Por Rango de Fechas
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
        </Tabs>
      </div>
    </div>
  )
}
