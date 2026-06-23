"use client"

import { useState, useTransition, useRef, useEffect, useCallback } from "react"
import { BackToHome } from "@/components/back-to-home"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Button } from "@/components/ui/button"
import {
  ArrowDownUp,
  TrendingUp,
  TrendingDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Building2,
  RotateCcw,
  Pencil,
} from "lucide-react"
import { getFlujoCajaData, saveFlujoCajaOverride, deleteFlujoCajaOverrides, type FlujoCajaData } from "@/lib/database"
import { generateFlujoCajaPDF, type FlujoCajaEffectiveValues } from "@/lib/flujo-caja-pdf"
import { savePDFWithDialog } from "@/lib/save-pdf"
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

// Celda editable para proyecciones
function EditableCell({
  value,
  pendingValue,
  isOverridden,
  onEdit,
  className = "",
  textClassName = "",
}: {
  value: number
  pendingValue?: number
  isOverridden: boolean
  onEdit: (newValue: number) => void
  className?: string
  textClassName?: string
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const displayValue = pendingValue !== undefined ? pendingValue : value
  const hasPending = pendingValue !== undefined

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleSave = () => {
    setEditing(false)
    const parsed = parseFloat(editValue.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(parsed) && parsed !== displayValue) {
      onEdit(parsed)
    }
  }

  if (editing) {
    return (
      <TableCell className={`text-right p-1 ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-full text-right border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </TableCell>
    )
  }

  return (
    <TableCell
      className={`text-right cursor-pointer hover:bg-blue-50 group relative ${className}`}
      onClick={() => {
        setEditValue(String(Math.round(displayValue)))
        setEditing(true)
      }}
    >
      <div className={`${textClassName}`}>
        {formatCurrency(displayValue)}
      </div>
      {hasPending && (
        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-orange-500" title="Pendiente de recalcular" />
      )}
      {!hasPending && isOverridden && (
        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" title="Valor editado" />
      )}
      <Pencil className="h-3 w-3 text-slate-400 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </TableCell>
  )
}

// Selector inline de modo de proyeccion por fila
function ModoProyeccionSelect({
  value,
  onChange,
}: {
  value: 'promedio' | 'maximo'
  onChange: (v: 'promedio' | 'maximo') => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as 'promedio' | 'maximo')}
      className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-slate-300 bg-white text-slate-500 cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      title="Modo de proyección"
    >
      <option value="promedio">Prom.</option>
      <option value="maximo">Máx.</option>
    </select>
  )
}

interface FlujoCajaClientProps {
  initialData: FlujoCajaData
}

export function FlujoCajaClient({ initialData }: FlujoCajaClientProps) {
  const now = new Date()
  const [data, setData] = useState<FlujoCajaData>(initialData)
  const [mesInicio, setMesInicio] = useState(1)
  const [anioInicio, setAnioInicio] = useState(now.getFullYear())
  const [mesFin, setMesFin] = useState(now.getMonth() + 1)
  const [anioFin, setAnioFin] = useState(now.getFullYear())
  const [mesesProyeccion, setMesesProyeccion] = useState(3)
  const [clasificacion, setClasificacion] = useState<'GASTO_COMUN' | 'FONDO_RESERVA' | 'AMBOS'>('AMBOS')
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)
  // Cambios pendientes: key = "anio-mes:concepto", value = nuevo valor
  const [pendingOverrides, setPendingOverrides] = useState<Record<string, { mes: number; anio: number; concepto: string; valor: number }>>({})
  // Modo de proyeccion por fila: key = concepto (ej: "cargos_mensuales", "egreso_gc_unitario", "servicio:123"), value = 'promedio' | 'maximo'
  const [modoProyeccion, setModoProyeccion] = useState<Record<string, 'promedio' | 'maximo'>>({})

  const anios = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  const recargar = useCallback(() => {
    setIsLoading(true)
    const fechaInicio = new Date(anioInicio, mesInicio - 1, 1).toISOString()
    const fechaFin = new Date(anioFin, mesFin, 0, 23, 59, 59).toISOString()

    startTransition(async () => {
      try {
        const result = await getFlujoCajaData(fechaInicio, fechaFin, mesesProyeccion, clasificacion)
        setData(result)
        setPendingOverrides({})
      } catch (error) {
        console.error("Error:", error)
      } finally {
        setIsLoading(false)
      }
    })
  }, [anioInicio, mesInicio, anioFin, mesFin, mesesProyeccion, clasificacion])

  const loading = isPending || isLoading

  const exportarPDF = async () => {
    try {
      // Construir valores efectivos (con modos y pendientes) para el PDF
      const servicioProyeccion: Record<string, number[]> = {}
      for (const s of data.servicios) {
        const sKey = s.servicioId || '__sin_servicio__'
        servicioProyeccion[sKey] = s.montosPorMes.map((v, i) => {
          if (data.columnas[i].esProyeccion) {
            const conceptoKey = `servicio:${sKey}`
            const pend = getPending(data.columnas[i].anio, data.columnas[i].mes, conceptoKey)
            if (pend !== undefined) return pend
            return v !== null ? v : getServicioBaseProyeccion(s)
          }
          return v || 0
        })
      }
      // GC promedio (meses reales)
      const gcPromedio = realCols.length > 0 && data.cantApartamentosGC > 0
        ? realCols.reduce((s, { i }) => s + effectiveEgresoGCUnitario[i], 0) / realCols.length
        : 0
      // GC proyeccion (primer mes proyectado o promedio de proyectados)
      const gcProyeccion = proyCols.length > 0 && data.cantApartamentosGC > 0
        ? effectiveEgresoGCUnitario[proyCols[0].i]
        : gcPromedio

      const effective: FlujoCajaEffectiveValues = {
        cargosTotalPorMes: effectiveCargosTotal,
        totalEgresosPorMes: effectiveTotalEgresos,
        balancePorMes: effectiveBalance,
        servicioProyeccion,
        gcPromedio: Math.round(gcPromedio * 100) / 100,
        gcProyeccion: Math.round(gcProyeccion * 100) / 100,
      }
      const result = generateFlujoCajaPDF(data, effective)
      const saved = await savePDFWithDialog(result)
      if (saved) {
        console.log("PDF guardado exitosamente")
      }
    } catch (error) {
      console.error("Error al generar PDF:", error)
    }
  }

  // Acumular edicion local (sin guardar en BD)
  const editarProyeccion = (mes: number, anio: number, concepto: string, valor: number) => {
    const key = `${anio}-${mes}:${concepto}`
    setPendingOverrides(prev => ({ ...prev, [key]: { mes, anio, concepto, valor } }))
  }

  // Guardar todos los pendientes en BD y recargar
  const recalcular = async () => {
    try {
      setIsLoading(true)
      for (const entry of Object.values(pendingOverrides)) {
        await saveFlujoCajaOverride(entry.mes, entry.anio, entry.concepto, entry.valor, clasificacion)
      }
      recargar()
    } catch (error) {
      console.error("Error guardando overrides:", error)
      setIsLoading(false)
    }
  }

  // Reset: borrar todos los overrides de meses proyectados
  const resetProyecciones = async () => {
    const mesesProy = data.columnas
      .filter(c => c.esProyeccion)
      .map(c => ({ mes: c.mes, anio: c.anio }))
    if (mesesProy.length === 0) return
    try {
      await deleteFlujoCajaOverrides(mesesProy, clasificacion)
      setPendingOverrides({})
      recargar()
    } catch (error) {
      console.error("Error reseteando proyecciones:", error)
    }
  }

  const hasPendingChanges = Object.keys(pendingOverrides).length > 0
  const hasOverrides = Object.keys(data.overrides).length > 0

  // Helpers
  const isOverridden = (anio: number, mes: number, concepto: string) => {
    return `${anio}-${mes}:${concepto}` in data.overrides
  }
  const getPending = (anio: number, mes: number, concepto: string) => {
    const key = `${anio}-${mes}:${concepto}`
    return pendingOverrides[key]?.valor
  }
  const getModo = (concepto: string): 'promedio' | 'maximo' => modoProyeccion[concepto] || 'promedio'
  const setModo = (concepto: string, modo: 'promedio' | 'maximo') => {
    setModoProyeccion(prev => ({ ...prev, [concepto]: modo }))
  }

  // Valor base de proyeccion para un servicio segun el modo
  const getServicioBaseProyeccion = (s: typeof data.servicios[0]) => {
    const sKey = `servicio:${s.servicioId || '__sin_servicio__'}`
    return getModo(sKey) === 'maximo' ? s.maximo : s.promedio
  }

  // Recalcular valores con pendientes para vista previa
  const effectiveEgresoGCUnitario = data.egresoGCUnitarioPorMes.map((val, i) => {
    const col = data.columnas[i]
    if (!col.esProyeccion) return val
    // Si hay override directo de egreso_gc_unitario pendiente, usarlo
    const pendEgGC = getPending(col.anio, col.mes, 'egreso_gc_unitario')
    if (pendEgGC !== undefined) return pendEgGC
    // Recalcular el total de egresos para este mes considerando modos y pendientes
    let totalEgresosMes = 0
    for (const s of data.servicios) {
      const sKey = `servicio:${s.servicioId || '__sin_servicio__'}`
      const pendServ = getPending(col.anio, col.mes, sKey)
      if (pendServ !== undefined) {
        totalEgresosMes += pendServ
      } else {
        const sVal = s.montosPorMes[i]
        totalEgresosMes += sVal !== null ? sVal : getServicioBaseProyeccion(s)
      }
    }
    if (data.cantApartamentosGC > 0) {
      return Math.round(totalEgresosMes / data.cantApartamentosGC * 100) / 100
    }
    return val
  })

  const effectiveCargosTotal = data.cargosTotalPorMes.map((val, i) => {
    const col = data.columnas[i]
    if (!col.esProyeccion) return val
    const pend = getPending(col.anio, col.mes, 'cargos_mensuales')
    if (pend !== undefined) return pend
    return getModo('cargos_mensuales') === 'maximo' ? data.maximoCargosGlobal : val
  })

  const effectiveTotalEgresos = data.totalEgresosPorMes.map((val, i) => {
    const col = data.columnas[i]
    if (!col.esProyeccion) return val
    let total = 0
    for (const s of data.servicios) {
      const sKey = `servicio:${s.servicioId || '__sin_servicio__'}`
      const pendServ = getPending(col.anio, col.mes, sKey)
      if (pendServ !== undefined) {
        total += pendServ
      } else {
        const sVal = s.montosPorMes[i]
        total += sVal !== null ? sVal : getServicioBaseProyeccion(s)
      }
    }
    return Math.round(total * 100) / 100
  })

  const effectiveBalance = effectiveCargosTotal.map((c, i) => Math.round((c - effectiveTotalEgresos[i]) * 100) / 100)

  // Columnas indexadas para separar reales de proyectadas
  const indexedCols = data.columnas.map((c, i) => ({ ...c, i }))
  const realCols = indexedCols.filter(c => !c.esProyeccion)
  const proyCols = indexedCols.filter(c => c.esProyeccion)

  // Resumen cards
  const totalCargosReales = data.cargosTotalPorMes
    .filter((_, i) => !data.columnas[i].esProyeccion)
    .reduce((s, v) => s + v, 0)
  const totalEgresosReales = data.totalEgresosPorMes
    .filter((_, i) => !data.columnas[i].esProyeccion)
    .reduce((s, v) => s + v, 0)
  const balanceReal = totalCargosReales - totalEgresosReales

  const clasificacionLabel = clasificacion === 'GASTO_COMUN'
    ? 'Gastos Comunes'
    : clasificacion === 'FONDO_RESERVA'
      ? 'Fondo de Reserva'
      : 'Todos'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <BackToHome />
        <h1 className="text-2xl font-bold text-slate-900">Flujo de Caja</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cargos mensuales vs gastos con proyeccion
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            {/* Desde */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Desde</label>
              <div className="flex gap-2">
                <Select value={String(mesInicio)} onValueChange={v => setMesInicio(Number(v))}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(anioInicio)} onValueChange={v => setAnioInicio(Number(v))}>
                  <SelectTrigger className="w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anios.map(a => (
                      <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hasta */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Hasta</label>
              <div className="flex gap-2">
                <Select value={String(mesFin)} onValueChange={v => setMesFin(Number(v))}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(anioFin)} onValueChange={v => setAnioFin(Number(v))}>
                  <SelectTrigger className="w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anios.map(a => (
                      <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Proyeccion */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Meses proyeccion</label>
              <Select value={String(mesesProyeccion)} onValueChange={v => setMesesProyeccion(Number(v))}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 6, 9, 12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clasificacion */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Clasificacion</label>
              <Select value={clasificacion} onValueChange={v => setClasificacion(v as typeof clasificacion)}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AMBOS">Todos</SelectItem>
                  <SelectItem value="GASTO_COMUN">Gastos Comunes</SelectItem>
                  <SelectItem value="FONDO_RESERVA">Fondo de Reserva</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={recargar} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownUp className="h-4 w-4 mr-2" />}
              Consultar
            </Button>
            <Button variant="outline" onClick={exportarPDF} disabled={loading}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
            {hasPendingChanges && (
              <Button
                onClick={recalcular}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownUp className="h-4 w-4 mr-2" />}
                Recalcular ({Object.keys(pendingOverrides).length})
              </Button>
            )}
            {(hasOverrides || hasPendingChanges) && (
              <Button
                variant="outline"
                onClick={resetProyecciones}
                disabled={loading}
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restablecer Proyeccion
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">Total Cargos Mensuales</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalCargosReales)}</div>
            <div className="text-xs text-slate-400 mt-1">Promedio: {formatCurrency(data.promedioCargosGlobal)}/mes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">Total Gastos</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalEgresosReales)}</div>
            <div className="text-xs text-slate-400 mt-1">Promedio: {formatCurrency(data.promedioEgresosGlobal)}/mes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">Resultado</div>
            <div className={`text-2xl font-bold mt-1 ${balanceReal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(balanceReal)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {balanceReal >= 0 ? 'Superavit' : 'Deficit'}
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">Gasto Comun / Apto</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(data.gastoComUnActual)}</div>
            <div className="text-xs text-slate-400 mt-1">{data.cantApartamentosGC} apartamentos con G.C.</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">Proveedores/Servicios</div>
            <div className="text-2xl font-bold text-slate-700 mt-1">{data.servicios.length}</div>
            <div className="text-xs text-slate-400 mt-1">Filtro: {clasificacionLabel}</div>
          </CardContent>
        </Card>
      </div>

      {/* Analisis Gasto Comun por Apartamento */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                Gasto Comun por Apartamento
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">{data.cantApartamentosGC} apartamentos con Gasto Comun</p>
            </div>
            {/* Cards de resumen GC ejecutado */}
            {(() => {
              const mesesRealesIdx = data.columnas.map((c, i) => ({ ...c, i })).filter(c => !c.esProyeccion)
              const mesesProyIdx = data.columnas.map((c, i) => ({ ...c, i })).filter(c => c.esProyeccion)
              // Reales
              const ingresosGCReal = mesesRealesIdx.reduce((s, c) => s + data.cargosGCPorMes[c.i], 0)
              const egresosGCReal = mesesRealesIdx.reduce((s, c) => s + (data.egresoGCUnitarioPorMes[c.i] * data.cantApartamentosGC), 0)
              const resultadoGCReal = ingresosGCReal - egresosGCReal
              // Proyectados (con effective)
              const ingresosGCProy = mesesProyIdx.reduce((s, c) => s + effectiveCargosTotal[c.i], 0)
              const egresosGCProy = mesesProyIdx.reduce((s, c) => s + (effectiveEgresoGCUnitario[c.i] * data.cantApartamentosGC), 0)
              const resultadoGCProy = ingresosGCProy - egresosGCProy

              return (
                <div className="flex gap-3">
                  <div className="border rounded-lg px-4 py-2 bg-white min-w-[180px]">
                    <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Ejecutado (Real)</div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className={`text-lg font-bold ${resultadoGCReal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(resultadoGCReal)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      <span className="text-blue-600">{formatCurrency(ingresosGCReal)}</span>
                      {' - '}
                      <span className="text-red-600">{formatCurrency(egresosGCReal)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{mesesRealesIdx.length} {mesesRealesIdx.length === 1 ? 'mes' : 'meses'}</div>
                  </div>
                  {mesesProyIdx.length > 0 && (
                    <div className="border border-amber-200 rounded-lg px-4 py-2 bg-amber-50/40 min-w-[180px]">
                      <div className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">Proyectado</div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className={`text-lg font-bold ${resultadoGCProy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(resultadoGCProy)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        <span className="text-blue-600">{formatCurrency(ingresosGCProy)}</span>
                        {' - '}
                        <span className="text-red-600">{formatCurrency(egresosGCProy)}</span>
                      </div>
                      <div className="text-[10px] text-amber-500">{mesesProyIdx.length} {mesesProyIdx.length === 1 ? 'mes' : 'meses'}</div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 min-w-[200px]">Concepto</TableHead>
                  {realCols.map(({ i, label }) => (
                    <TableHead key={i} className="text-right min-w-[120px]">
                      <div>{label}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[120px] bg-slate-50 font-bold">Promedio</TableHead>
                  {proyCols.map(({ i, label }) => (
                    <TableHead key={i} className="text-right min-w-[120px] bg-amber-50">
                      <div>{label}</div>
                      <Badge variant="outline" className="text-[10px] mt-1 bg-amber-100 text-amber-700 border-amber-300">
                        Proyeccion
                      </Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Cargo GC por apto */}
                <TableRow className="bg-blue-50/50">
                  <TableCell className="sticky left-0 bg-blue-50/50 z-10 font-medium text-blue-700">
                    Cargo G.C. / Apto
                  </TableCell>
                  {realCols.map(({ i }) => (
                    <TableCell key={i} className="text-right text-blue-700">
                      {formatCurrency(data.gastoComunUnitarioPorMes[i])}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-blue-700 bg-slate-50 font-medium">
                    {formatCurrency(
                      realCols.reduce((s, { i }) => s + data.gastoComunUnitarioPorMes[i], 0) /
                      Math.max(1, realCols.length)
                    )}
                  </TableCell>
                  {proyCols.map(({ i }) => (
                    <TableCell key={i} className="text-right text-blue-700 bg-amber-50/50 italic">
                      {formatCurrency(data.gastoComunUnitarioPorMes[i])}
                    </TableCell>
                  ))}
                </TableRow>

                {/* Egreso GC real por apto - EDITABLE en proyeccion */}
                <TableRow className="bg-red-50/50">
                  <TableCell className="sticky left-0 bg-red-50/50 z-10 font-medium text-red-700">
                    Gasto Real / Apto
                  </TableCell>
                  {realCols.map(({ i }) => (
                    <TableCell key={i} className="text-right text-red-700">
                      {formatCurrency(effectiveEgresoGCUnitario[i])}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-red-700 bg-slate-50 font-medium">
                    {formatCurrency(
                      realCols.reduce((s, { i }) => s + effectiveEgresoGCUnitario[i], 0) /
                      Math.max(1, realCols.length)
                    )}
                  </TableCell>
                  {proyCols.map((col) => {
                    const val = effectiveEgresoGCUnitario[col.i]
                    return (
                      <EditableCell
                        key={col.i}
                        value={data.egresoGCUnitarioPorMes[col.i]}
                        pendingValue={val !== data.egresoGCUnitarioPorMes[col.i] ? val : getPending(col.anio, col.mes, 'egreso_gc_unitario')}
                        isOverridden={isOverridden(col.anio, col.mes, 'egreso_gc_unitario')}
                        onEdit={newVal => editarProyeccion(col.mes, col.anio, 'egreso_gc_unitario', newVal)}
                        className="bg-amber-50/50"
                        textClassName="text-red-700 italic"
                      />
                    )
                  })}
                </TableRow>

                {/* Diferencia */}
                {(() => {
                  const difPorMes = data.gastoComunUnitarioPorMes.map((cargo, i) => cargo - effectiveEgresoGCUnitario[i]);
                  const difReales = realCols.map(({ i }) => difPorMes[i]);
                  const promDif = difReales.length > 0 ? difReales.reduce((s, v) => s + v, 0) / difReales.length : 0;
                  return (
                    <TableRow className="font-semibold border-t">
                      <TableCell className="sticky left-0 bg-white z-10">
                        Diferencia
                      </TableCell>
                      {realCols.map(({ i }) => (
                        <TableCell key={i} className={`text-right font-semibold ${difPorMes[i] >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(difPorMes[i])}
                        </TableCell>
                      ))}
                      <TableCell className={`text-right font-semibold bg-slate-50 ${promDif >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(promDif)}
                      </TableCell>
                      {proyCols.map(({ i }) => (
                        <TableCell key={i} className={`text-right font-semibold bg-amber-50/50 ${difPorMes[i] >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(difPorMes[i])}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })()}

                {/* Variacion mes a mes del gasto real */}
                <TableRow className="text-sm">
                  <TableCell className="sticky left-0 bg-white z-10 text-slate-500">
                    Variacion mensual
                  </TableCell>
                  {realCols.map(({ i }) => {
                    if (i === 0) {
                      return (
                        <TableCell key={i} className="text-right text-slate-400">
                          -
                        </TableCell>
                      );
                    }
                    const anterior = effectiveEgresoGCUnitario[i - 1];
                    const diff = effectiveEgresoGCUnitario[i] - anterior;
                    const pct = anterior > 0 ? (diff / anterior) * 100 : 0;
                    return (
                      <TableCell key={i} className="text-right">
                        <div className={`${diff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                        </div>
                        <div className={`text-[11px] ${diff >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {diff >= 0 ? '+' : ''}{pct.toFixed(1)}%
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right text-slate-400 bg-slate-50">-</TableCell>
                  {proyCols.map(({ i }) => {
                    const anterior = effectiveEgresoGCUnitario[i - 1];
                    const diff = effectiveEgresoGCUnitario[i] - anterior;
                    const pct = anterior > 0 ? (diff / anterior) * 100 : 0;
                    return (
                      <TableCell key={i} className="text-right bg-amber-50/30">
                        <div className={`${diff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                        </div>
                        <div className={`text-[11px] ${diff >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {diff >= 0 ? '+' : ''}{pct.toFixed(1)}%
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tabla principal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalle Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 min-w-[200px]">Concepto</TableHead>
                  {realCols.map(({ i, label }) => (
                    <TableHead key={i} className="text-right min-w-[120px]">
                      <div>{label}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[120px] bg-slate-50 font-bold">Promedio</TableHead>
                  {proyCols.map(({ i, label }) => (
                    <TableHead key={i} className="text-right min-w-[120px] bg-amber-50">
                      <div>{label}</div>
                      <Badge variant="outline" className="text-[10px] mt-1 bg-amber-100 text-amber-700 border-amber-300">
                        Proyeccion
                      </Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* SECCION: CARGOS MENSUALES */}
                <TableRow className="bg-blue-50 font-semibold">
                  <TableCell className="sticky left-0 bg-blue-50 z-10">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      CARGOS MENSUALES
                      {proyCols.length > 0 && (
                        <ModoProyeccionSelect
                          value={getModo('cargos_mensuales')}
                          onChange={v => setModo('cargos_mensuales', v)}
                        />
                      )}
                    </div>
                  </TableCell>
                  {realCols.map(({ i }) => (
                    <TableCell key={i} className="text-right font-semibold text-blue-700">
                      {formatCurrency(data.cargosTotalPorMes[i])}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold text-blue-700 bg-slate-50">
                    {formatCurrency(data.promedioCargosGlobal)}
                  </TableCell>
                  {proyCols.map((col) => (
                    <EditableCell
                      key={col.i}
                      value={data.cargosTotalPorMes[col.i]}
                      pendingValue={getPending(col.anio, col.mes, 'cargos_mensuales')}
                      isOverridden={isOverridden(col.anio, col.mes, 'cargos_mensuales')}
                      onEdit={newVal => editarProyeccion(col.mes, col.anio, 'cargos_mensuales', newVal)}
                      className="bg-amber-50/50"
                      textClassName="font-semibold text-blue-700"
                    />
                  ))}
                </TableRow>

                {/* Detalle GC y FR si es AMBOS */}
                {clasificacion === 'AMBOS' && (
                  <>
                    <TableRow className="text-sm">
                      <TableCell className="sticky left-0 bg-white z-10 pl-8 text-slate-500">
                        Gastos Comunes
                      </TableCell>
                      {realCols.map(({ i }) => (
                        <TableCell key={i} className="text-right text-slate-600">
                          {formatCurrency(data.cargosGCPorMes[i])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-slate-600 bg-slate-50">
                        {data.cargosGCPorMes.length > 0
                          ? formatCurrency(realCols.reduce((s, { i }) => s + data.cargosGCPorMes[i], 0) / Math.max(1, realCols.length))
                          : '-'}
                      </TableCell>
                      {proyCols.map(({ i }) => (
                        <TableCell key={i} className="text-right text-slate-600 bg-amber-50/30">
                          {formatCurrency(data.cargosGCPorMes[i])}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="text-sm">
                      <TableCell className="sticky left-0 bg-white z-10 pl-8 text-slate-500">
                        Fondo de Reserva
                      </TableCell>
                      {realCols.map(({ i }) => (
                        <TableCell key={i} className="text-right text-slate-600">
                          {formatCurrency(data.cargosFRPorMes[i])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-slate-600 bg-slate-50">
                        {data.cargosFRPorMes.length > 0
                          ? formatCurrency(realCols.reduce((s, { i }) => s + data.cargosFRPorMes[i], 0) / Math.max(1, realCols.length))
                          : '-'}
                      </TableCell>
                      {proyCols.map(({ i }) => (
                        <TableCell key={i} className="text-right text-slate-600 bg-amber-50/30">
                          {formatCurrency(data.cargosFRPorMes[i])}
                        </TableCell>
                      ))}
                    </TableRow>
                  </>
                )}

                {/* Separador */}
                <TableRow>
                  <TableCell colSpan={data.columnas.length + 2} className="h-2 p-0 border-0" />
                </TableRow>

                {/* SECCION: GASTOS (EGRESOS) */}
                <TableRow className="bg-red-50 font-semibold">
                  <TableCell className="sticky left-0 bg-red-50 z-10">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      GASTOS
                    </div>
                  </TableCell>
                  {realCols.map(({ i }) => (
                    <TableCell key={i} className="text-right font-semibold text-red-700">
                      {formatCurrency(effectiveTotalEgresos[i])}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold text-red-700 bg-slate-50">
                    {formatCurrency(data.promedioEgresosGlobal)}
                  </TableCell>
                  {proyCols.map(({ i }) => (
                    <TableCell key={i} className="text-right font-semibold text-red-700 bg-amber-50/50">
                      {formatCurrency(effectiveTotalEgresos[i])}
                    </TableCell>
                  ))}
                </TableRow>

                {/* Detalle por servicio/proveedor - EDITABLE en proyeccion */}
                {data.servicios.map((servicio) => {
                  const conceptoKey = `servicio:${servicio.servicioId || '__sin_servicio__'}`
                  return (
                    <TableRow key={servicio.servicioId || '__sin'} className="text-sm hover:bg-slate-50">
                      <TableCell className="sticky left-0 bg-white z-10 pl-8 text-slate-600">
                        <div className="flex items-center">
                          {servicio.servicioNombre}
                          {proyCols.length > 0 && (
                            <ModoProyeccionSelect
                              value={getModo(conceptoKey)}
                              onChange={v => setModo(conceptoKey, v)}
                            />
                          )}
                        </div>
                      </TableCell>
                      {realCols.map(({ i }) => {
                        const val = servicio.montosPorMes[i]
                        return (
                          <TableCell
                            key={i}
                            className={`text-right text-slate-600 ${val === null ? 'text-slate-300' : ''}`}
                          >
                            {val === null ? '-' : formatCurrency(val || 0)}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right text-slate-600 bg-slate-50 font-medium">
                        {formatCurrency(servicio.promedio)}
                      </TableCell>
                      {proyCols.map((col) => {
                        const val = servicio.montosPorMes[col.i]
                        const mostrar = val !== null ? val : getServicioBaseProyeccion(servicio)
                        return (
                          <EditableCell
                            key={col.i}
                            value={mostrar}
                            pendingValue={getPending(col.anio, col.mes, conceptoKey)}
                            isOverridden={isOverridden(col.anio, col.mes, conceptoKey)}
                            onEdit={newVal => editarProyeccion(col.mes, col.anio, conceptoKey, newVal)}
                            className="bg-amber-50/30"
                            textClassName="text-amber-700 italic"
                          />
                        )
                      })}
                    </TableRow>
                  )
                })}

                {data.servicios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={data.columnas.length + 2} className="text-center text-slate-400 py-4">
                      No hay gastos registrados en el periodo seleccionado
                    </TableCell>
                  </TableRow>
                )}

                {/* Separador */}
                <TableRow>
                  <TableCell colSpan={data.columnas.length + 2} className="h-2 p-0 border-0" />
                </TableRow>

                {/* RESULTADO */}
                <TableRow className="font-bold border-t-2 border-slate-300">
                  <TableCell className="sticky left-0 bg-white z-10">
                    RESULTADO
                  </TableCell>
                  {realCols.map(({ i }) => (
                    <TableCell
                      key={i}
                      className={`text-right font-bold ${effectiveBalance[i] >= 0 ? 'text-green-700' : 'text-red-700'}`}
                    >
                      {formatCurrency(effectiveBalance[i])}
                    </TableCell>
                  ))}
                  <TableCell className={`text-right font-bold bg-slate-50 ${balanceReal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(data.promedioCargosGlobal - data.promedioEgresosGlobal)}
                  </TableCell>
                  {proyCols.map(({ i }) => (
                    <TableCell
                      key={i}
                      className={`text-right font-bold bg-amber-50/50 ${effectiveBalance[i] >= 0 ? 'text-green-700' : 'text-red-700'}`}
                    >
                      {formatCurrency(effectiveBalance[i])}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
          <span>Meses proyectados (basados en promedios)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="italic text-amber-700">Italica</span>
          <span>= valor proyectado por servicio</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-300">-</span>
          <span>= sin dato en ese mes</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          <span>= cambio pendiente</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>= valor editado guardado</span>
        </div>
      </div>
    </div>
  )
}
