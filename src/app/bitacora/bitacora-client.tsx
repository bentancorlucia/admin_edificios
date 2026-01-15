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
import { ClipboardList, Plus, Search, Download, Edit, Trash2, AlertCircle, Calendar } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  createRegistro,
  updateRegistro,
  deleteRegistro,
} from "./actions"

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
  fecha: Date
  tipo: TipoRegistro
  detalle: string
  observaciones: string | null
  situacion: SituacionRegistro
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

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateForInput(date: Date): string {
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
      tipo: reg.tipo,
      detalle: reg.detalle,
      observaciones: reg.observaciones || "",
      situacion: reg.situacion,
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
        fecha: new Date(formData.fecha),
        tipo: formData.tipo,
        detalle: formData.detalle,
        observaciones: formData.observaciones || null,
        situacion: formData.situacion,
      }

      if (selectedRegistro) {
        const result = await updateRegistro(selectedRegistro.id, data)
        if (!result.success) {
          setError(result.error)
          return
        }
        setRegistros((prev) =>
          prev.map((reg) => (reg.id === result.data.id ? result.data : reg))
        )
      } else {
        const result = await createRegistro(data)
        if (!result.success) {
          setError(result.error)
          return
        }
        setRegistros((prev) => [result.data, ...prev])
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
      const result = await deleteRegistro(selectedRegistro.id)
      if (!result.success) {
        alert(result.error)
        return
      }
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

  const handleExport = () => {
    const headers = ["Fecha", "Tipo", "Detalle", "Observaciones", "Situación"]
    const rows = registros.map((reg) => [
      formatDate(reg.fecha),
      tipoRegistroLabels[reg.tipo],
      reg.detalle,
      reg.observaciones || "",
      situacionLabels[reg.situacion],
    ])

    const csvContent = [headers, ...rows].map((row) => row.map(cell => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bitacora.csv"
    a.click()
  }

  // Contadores para el resumen
  const pendientes = registros.filter(r => r.situacion === "PENDIENTE").length
  const enProceso = registros.filter(r => r.situacion === "EN_PROCESO").length
  const realizados = registros.filter(r => r.situacion === "REALIZADO").length
  const vencidos = registros.filter(r => r.situacion === "VENCIDO").length

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Bitácora de Gestión</h1>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{pendientes}</div>
            <div className="text-sm text-slate-500">Pendientes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{enProceso}</div>
            <div className="text-sm text-slate-500">En Proceso</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{realizados}</div>
            <div className="text-sm text-slate-500">Realizados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{vencidos}</div>
            <div className="text-sm text-slate-500">Vencidos</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Registro
          </Button>
        </div>
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
                      <Badge variant={tipoRegistroColors[reg.tipo]}>
                        {tipoRegistroLabels[reg.tipo]}
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
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${situacionColors[reg.situacion]}`}>
                      {situacionLabels[reg.situacion]}
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
