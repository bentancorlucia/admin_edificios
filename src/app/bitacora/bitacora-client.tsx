"use client"

import { useState } from "react"
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
import { ClipboardList, Plus, Search, Download, Edit, Trash2, AlertCircle, Calendar, FileText } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  createRegistro,
  updateRegistro,
  deleteRegistro,
  type Registro as RegistroType,
} from "@/lib/database"
import { generateBitacoraPDF } from "@/lib/bitacora-pdf"
import { toast } from "@/hooks/use-toast"

type TipoRegistro =
  | "NOVEDAD"
  | "VENCIMIENTO"
  | "MANTENIMIENTO"
  | "REUNION"
  | "INCIDENTE"
  | "RECORDATORIO"
  | "OTRO"

type SituacionRegistro =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "REALIZADO"
  | "CANCELADO"
  | "VENCIDO"

type Registro = {
  id: string
  fecha: string
  tipo: string
  detalle: string
  observaciones: string | null
  situacion: string
}

type Props = {
  initialRegistros: Registro[]
}

const tipoRegistroLabels: Record<TipoRegistro, string> = {
  NOVEDAD: "Novedad",
  VENCIMIENTO: "Vencimiento",
  MANTENIMIENTO: "Mantenimiento",
  REUNION: "Reunión",
  INCIDENTE: "Incidente",
  RECORDATORIO: "Recordatorio",
  OTRO: "Otro",
}

const tipoRegistroColors: Record<TipoRegistro, "default" | "secondary" | "destructive" | "outline"> = {
  NOVEDAD: "default",
  VENCIMIENTO: "destructive",
  MANTENIMIENTO: "secondary",
  REUNION: "outline",
  INCIDENTE: "destructive",
  RECORDATORIO: "default",
  OTRO: "outline",
}

const situacionLabels: Record<SituacionRegistro, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En Proceso",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
  VENCIDO: "Vencido",
}

const situacionColors: Record<SituacionRegistro, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  EN_PROCESO: "bg-blue-100 text-blue-800",
  REALIZADO: "bg-green-100 text-green-800",
  CANCELADO: "bg-gray-100 text-gray-800",
  VENCIDO: "bg-red-100 text-red-800",
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateForInput(date: Date | string): string {
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

export function BitacoraClient({ initialRegistros }: Props) {
  const [registros, setRegistros] = useState(initialRegistros)
  const [search, setSearch] = useState("")
  const [filterTipo, setFilterTipo] = useState<TipoRegistro | "TODOS">("TODOS")
  const [filterSituacion, setFilterSituacion] = useState<SituacionRegistro | "TODOS">("TODOS")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedRegistro, setSelectedRegistro] = useState<Registro | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    fecha: formatDateForInput(new Date()),
    tipo: "NOVEDAD" as TipoRegistro,
    detalle: "",
    observaciones: "",
    situacion: "PENDIENTE" as SituacionRegistro,
  })

  const filteredRegistros = registros.filter((reg) => {
    const matchesSearch = reg.detalle.toLowerCase().includes(search.toLowerCase()) ||
      (reg.observaciones?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchesTipo = filterTipo === "TODOS" || reg.tipo === filterTipo
    const matchesSituacion = filterSituacion === "TODOS" || reg.situacion === filterSituacion
    return matchesSearch && matchesTipo && matchesSituacion
  })

  const resetForm = () => {
    setFormData({
      fecha: formatDateForInput(new Date()),
      tipo: "NOVEDAD",
      detalle: "",
      observaciones: "",
      situacion: "PENDIENTE",
    })
    setSelectedRegistro(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setError(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (reg: Registro) => {
    setSelectedRegistro(reg)
    setError(null)
    setFormData({
      fecha: formatDateForInput(reg.fecha),
      tipo: reg.tipo as TipoRegistro,
      detalle: reg.detalle,
      observaciones: reg.observaciones || "",
      situacion: reg.situacion as SituacionRegistro,
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (reg: Registro) => {
    setSelectedRegistro(reg)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const data = {
        fecha: new Date(formData.fecha).toISOString(),
        tipo: formData.tipo,
        detalle: formData.detalle,
        observaciones: formData.observaciones || null,
        situacion: formData.situacion,
      }

      if (selectedRegistro) {
        const result = await updateRegistro(selectedRegistro.id, data)
        setRegistros((prev) =>
          prev.map((reg) => (reg.id === result.id ? result as Registro : reg))
        )
      } else {
        const result = await createRegistro(data)
        setRegistros((prev) => [result as Registro, ...prev])
      }

      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error saving registro:", error)
      setError("Error inesperado. Por favor intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedRegistro) return
    setIsLoading(true)

    try {
      await deleteRegistro(selectedRegistro.id)
      setRegistros((prev) => prev.filter((reg) => reg.id !== selectedRegistro.id))
      setIsDeleteDialogOpen(false)
      setSelectedRegistro(null)
    } catch (error) {
      console.error("Error deleting registro:", error)
      alert("Error al eliminar el registro")
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ["Fecha", "Tipo", "Detalle", "Observaciones", "Situación"]
    const rows = registros.map((reg) => [
      formatDate(reg.fecha),
      tipoRegistroLabels[reg.tipo as TipoRegistro],
      reg.detalle,
      reg.observaciones || "",
      situacionLabels[reg.situacion as SituacionRegistro],
    ])

    const csvContent = [headers, ...rows].map((row) => row.map(cell => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bitacora.csv"
    a.click()
    toast({
      title: "CSV descargado",
      description: "Bitácora exportada correctamente",
      variant: "success",
    })
  }

  const handleExportPDF = () => {
    generateBitacoraPDF(registros)
    toast({
      title: "PDF descargado",
      description: "Bitácora exportada correctamente",
      variant: "success",
    })
  }

  // Contadores para el resumen
  const pendientes = registros.filter(r => r.situacion === "PENDIENTE").length
  const enProceso = registros.filter(r => r.situacion === "EN_PROCESO").length
  const realizados = registros.filter(r => r.situacion === "REALIZADO").length
  const vencidos = registros.filter(r => r.situacion === "VENCIDO").length

  return (
    <div className="space-y-8 px-4 md:px-8 lg:px-12 py-6">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6bTEwIDEwdjZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Bitácora de Gestión</h1>
                <p className="text-slate-300 text-sm">
                  Seguimiento de tareas, novedades y mantenimiento
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleExportPDF}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              onClick={openCreateDialog}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Registro
            </Button>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-yellow-50 to-amber-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{pendientes}</div>
            <div className="text-sm text-slate-500">Pendientes</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{enProceso}</div>
            <div className="text-sm text-slate-500">En Proceso</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{realizados}</div>
            <div className="text-sm text-slate-500">Realizados</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-rose-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{vencidos}</div>
            <div className="text-sm text-slate-500">Vencidos</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar en detalles u observaciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterTipo} onValueChange={(value) => setFilterTipo(value as TipoRegistro | "TODOS")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los tipos</SelectItem>
            {Object.entries(tipoRegistroLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSituacion} onValueChange={(value) => setFilterSituacion(value as SituacionRegistro | "TODOS")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtrar por situación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todas las situaciones</SelectItem>
            {Object.entries(situacionLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Registros List */}
      <div className="space-y-4">
        {filteredRegistros.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No hay registros en la bitácora</p>
          </div>
        ) : (
          filteredRegistros.map((reg) => (
            <Card key={reg.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Fecha y tipo */}
                  <div className="flex items-center gap-3 md:w-48 shrink-0">
                    <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{formatDate(reg.fecha)}</div>
                      <Badge variant={tipoRegistroColors[reg.tipo as TipoRegistro]}>
                        {tipoRegistroLabels[reg.tipo as TipoRegistro]}
                      </Badge>
                    </div>
                  </div>

                  {/* Detalle y observaciones */}
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-medium mb-1">{reg.detalle}</p>
                    {reg.observaciones && (
                      <p className="text-sm text-slate-500">{reg.observaciones}</p>
                    )}
                  </div>

                  {/* Situación y acciones */}
                  <div className="flex items-center gap-3 md:shrink-0">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${situacionColors[reg.situacion as SituacionRegistro]}`}>
                      {situacionLabels[reg.situacion as SituacionRegistro]}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(reg)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(reg)}
                        title="Eliminar"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedRegistro ? "Editar Registro" : "Nuevo Registro"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Fecha */}
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha *</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                required
              />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value as TipoRegistro })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoRegistroLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Detalle */}
            <div className="space-y-2">
              <Label htmlFor="detalle">Detalle *</Label>
              <Input
                id="detalle"
                placeholder="Descripción breve del registro"
                value={formData.detalle}
                onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                required
              />
            </div>

            {/* Observaciones */}
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                placeholder="Notas adicionales..."
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={3}
              />
            </div>

            {/* Situación */}
            <div className="space-y-2">
              <Label htmlFor="situacion">Situación *</Label>
              <Select
                value={formData.situacion}
                onValueChange={(value) => setFormData({ ...formData, situacion: value as SituacionRegistro })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(situacionLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              registro &quot;{selectedRegistro?.detalle}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
