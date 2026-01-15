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
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  FileSpreadsheet,
  FileText,
  Calendar,
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
} from "lucide-react"
import {
  InformeData,
  AvisoInforme,
  getInformeData,
  createAvisoInforme,
  updateAvisoInforme,
  deleteAvisoInforme,
  reorderAvisosInforme,
  getAvisosInforme,
} from "./actions"
import { generateInformePDF } from "@/lib/informe-pdf"
import { generateInformeExcel } from "@/lib/informe-excel"

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
}

export function InformesClient({ initialData, initialMes, initialAnio }: Props) {
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

  const formatCurrency = (value: number) => {
    return `$ ${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getMesLabel = () => {
    const mesObj = meses.find((m) => m.value === mes)
    return mesObj ? `${mesObj.label} ${anio}` : ""
  }

  const handleExportPDF = () => {
    generateInformePDF(data, getMesLabel())
  }

  const handleExportExcel = () => {
    generateInformeExcel(data, getMesLabel())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Informe Mensual</h1>
          <p className="text-sm text-slate-500">
            Estado de cuenta corriente por apartamento y resumen bancario
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de fecha */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <Select
              value={mes.toString()}
              onValueChange={(v) => handleDateChange(parseInt(v), undefined)}
            >
              <SelectTrigger className="w-[140px]">
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
              <SelectTrigger className="w-[100px]">
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

          {/* Botones de exportación */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={isPending}
            >
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={isPending}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-600">Cargando datos...</span>
        </div>
      )}

      {!isPending && (
        <>
          {/* Resumen de totales */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <Wallet className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Saldo Anterior</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(data.totales.totalSaldoAnterior)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Pagos del Mes</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(data.totales.totalPagosMes)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Gastos Comunes</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(data.totales.totalGastosComunesMes)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-2">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fondo Reserva</p>
                    <p className="text-lg font-bold text-purple-600">
                      {formatCurrency(data.totales.totalFondoReservaMes)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-lg p-2 ${
                      data.totales.totalSaldoActual > 0
                        ? "bg-red-100"
                        : "bg-green-100"
                    }`}
                  >
                    <TrendingDown
                      className={`h-5 w-5 ${
                        data.totales.totalSaldoActual > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Saldo Actual</p>
                    <p
                      className={`text-lg font-bold ${
                        data.totales.totalSaldoActual > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {formatCurrency(data.totales.totalSaldoActual)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumen Bancario */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Landmark className="h-5 w-5 text-blue-600" />
                Resumen Bancario - {getMesLabel()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {/* Ingresos */}
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Ingreso G. Comunes
                    </span>
                  </div>
                  <p className="text-xl font-bold text-green-700">
                    {formatCurrency(data.resumenBancario.ingresoGastosComunes)}
                  </p>
                </div>

                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Ingreso F. Reserva
                    </span>
                  </div>
                  <p className="text-xl font-bold text-green-700">
                    {formatCurrency(data.resumenBancario.ingresoFondoReserva)}
                  </p>
                </div>

                {/* Egresos */}
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">
                      Egreso G. Comunes
                    </span>
                  </div>
                  <p className="text-xl font-bold text-red-700">
                    {formatCurrency(data.resumenBancario.egresoGastosComunes)}
                  </p>
                </div>

                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">
                      Egreso F. Reserva
                    </span>
                  </div>
                  <p className="text-xl font-bold text-red-700">
                    {formatCurrency(data.resumenBancario.egresoFondoReserva)}
                  </p>
                </div>

                {/* Saldo Bancario */}
                <div className="rounded-lg border border-blue-300 bg-blue-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Landmark className="h-4 w-4 text-blue-700" />
                    <span className="text-sm font-medium text-blue-800">
                      Saldo Bancario
                    </span>
                  </div>
                  <p className="text-xl font-bold text-blue-800">
                    {formatCurrency(data.resumenBancario.saldoBancarioTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mini Bitácora de Avisos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-amber-600" />
                Avisos para el Informe - {getMesLabel()}
              </CardTitle>
              <p className="text-sm text-slate-500">
                Los avisos activos se incluirán en los PDF/Excel generados. Arrastra para reordenar.
              </p>
            </CardHeader>
            <CardContent>
              {/* Formulario para agregar nuevo aviso */}
              <div className="flex gap-2 mb-4">
                <Textarea
                  placeholder="Escribe un aviso para incluir en el informe..."
                  value={nuevoAviso}
                  onChange={(e) => setNuevoAviso(e.target.value)}
                  className="flex-1 min-h-[60px] resize-none"
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
                  className="self-end"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>

              {/* Lista de avisos */}
              {avisos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500 border-2 border-dashed rounded-lg">
                  <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
                  <p>No hay avisos para este mes</p>
                  <p className="text-xs">Agrega avisos que aparecerán en los informes</p>
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

          {/* Tabla de apartamentos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-slate-600" />
                Desglose por Apartamento - {getMesLabel()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.apartamentos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Building2 className="h-12 w-12 mb-3 opacity-50" />
                  <p>No hay apartamentos registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Apto</TableHead>
                        <TableHead className="font-semibold">Tipo</TableHead>
                        <TableHead className="text-right font-semibold">
                          Saldo Anterior
                        </TableHead>
                        <TableHead className="text-right font-semibold">
                          Pagos del Mes
                        </TableHead>
                        <TableHead className="text-right font-semibold">
                          Gastos Comunes
                        </TableHead>
                        <TableHead className="text-right font-semibold">
                          Fondo Reserva
                        </TableHead>
                        <TableHead className="text-right font-semibold">
                          Saldo Actual
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.apartamentos.map((apt) => (
                        <TableRow key={apt.apartamentoId} className="hover:bg-slate-50">
                          <TableCell className="font-medium">
                            {apt.numero}
                            {apt.piso && (
                              <span className="ml-1 text-xs text-slate-400">
                                (Piso {apt.piso})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                apt.tipoOcupacion === "PROPIETARIO"
                                  ? "border-blue-300 bg-blue-50 text-blue-700"
                                  : "border-purple-300 bg-purple-50 text-purple-700"
                              }
                            >
                              {tipoOcupacionLabels[apt.tipoOcupacion]}
                            </Badge>
                          </TableCell>
                          
                          <TableCell className="text-right">
                            <span
                              className={
                                apt.saldoAnterior > 0
                                  ? "text-red-600"
                                  : apt.saldoAnterior < 0
                                  ? "text-green-600"
                                  : "text-slate-600"
                              }
                            >
                              {formatCurrency(apt.saldoAnterior)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-green-600">
                              {formatCurrency(apt.pagosMes)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(apt.gastosComunesMes)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(apt.fondoReservaMes)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`font-semibold ${
                                apt.saldoActual > 0
                                  ? "text-red-600"
                                  : apt.saldoActual < 0
                                  ? "text-green-600"
                                  : "text-slate-600"
                              }`}
                            >
                              {formatCurrency(apt.saldoActual)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Fila de totales */}
                      <TableRow className="bg-slate-100 font-bold">
                        <TableCell colSpan={2}>TOTALES</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(data.totales.totalSaldoAnterior)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(data.totales.totalPagosMes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(data.totales.totalGastosComunesMes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(data.totales.totalFondoReservaMes)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            data.totales.totalSaldoActual > 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {formatCurrency(data.totales.totalSaldoActual)}
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
