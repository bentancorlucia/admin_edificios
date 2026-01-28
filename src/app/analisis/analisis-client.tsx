"use client"

import { useState, useTransition } from "react"
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
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, TrendingDown, Loader2, PieChart } from "lucide-react"
import { getAnalisisData, type AnalisisData, type TipoServicio } from "@/lib/database"

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
  tiposServicio,
}: AnalisisClientProps) {
  const [data, setData] = useState<AnalisisData>(initialData)
  const [mes, setMes] = useState(initialMes)
  const [anio, setAnio] = useState(initialAnio)
  const [clasificacion, setClasificacion] = useState<'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS'>('AMBOS')
  const [servicioId, setServicioId] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

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

  return (
    <div className="p-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <PieChart className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Análisis de Egresos</h1>
              <p className="text-sm text-slate-500">Detalle y totalizador por servicio</p>
            </div>
          </div>

          {/* Selector de fecha */}
          <div className="flex items-center gap-2">
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
        </div>

        {/* Filtros */}
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
                    {tiposServicio.map((tipo) => (
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
      </div>
    </div>
  )
}
