"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BackToHome } from "@/components/back-to-home"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FolderKanban,
  Plus,
  Search,
  Edit,
  Trash2,
  FileText,
  TrendingUp,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react"
import {
  createProyecto,
  updateProyecto,
  deleteProyecto,
  getReporteProyecto,
  type Proyecto,
  type ReporteProyectoData,
} from "@/lib/database"
import { formatCurrency, formatDate } from "@/lib/utils"
import { generateReporteProyectoPDF } from "@/lib/proyecto-pdf"
import { savePDFWithDialog } from "@/lib/save-pdf"
import { toast } from "@/hooks/use-toast"

type Props = {
  initialProyectos: Proyecto[]
}

export function ProyectosClient({ initialProyectos }: Props) {
  const router = useRouter()
  const [proyectos, setProyectos] = useState(initialProyectos)
  const [search, setSearch] = useState("")
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activos" | "inactivos">("todos")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isReporteDialogOpen, setIsReporteDialogOpen] = useState(false)
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [reporteData, setReporteData] = useState<ReporteProyectoData | null>(null)

  const [form, setForm] = useState({
    nombre: "",
    presupuesto: 0,
    fechaInicio: "",
    fechaFin: "",
    observaciones: "",
    activo: true,
  })

  const filteredProyectos = proyectos.filter((p) => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase())
    const matchEstado =
      filtroEstado === "todos" ||
      (filtroEstado === "activos" && p.activo) ||
      (filtroEstado === "inactivos" && !p.activo)
    return matchSearch && matchEstado
  })

  const resetForm = () => {
    setForm({ nombre: "", presupuesto: 0, fechaInicio: "", fechaFin: "", observaciones: "", activo: true })
    setSelectedProyecto(null)
  }

  const openCreateDialog = () => {
    setIsEditMode(false)
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (proyecto: Proyecto) => {
    setSelectedProyecto(proyecto)
    setIsEditMode(true)
    setForm({
      nombre: proyecto.nombre,
      presupuesto: proyecto.presupuesto,
      fechaInicio: proyecto.fechaInicio ? proyecto.fechaInicio.split("T")[0] : "",
      fechaFin: proyecto.fechaFin ? proyecto.fechaFin.split("T")[0] : "",
      observaciones: proyecto.observaciones || "",
      activo: proyecto.activo,
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (proyecto: Proyecto) => {
    setSelectedProyecto(proyecto)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const data = {
        nombre: form.nombre,
        presupuesto: form.presupuesto,
        fechaInicio: form.fechaInicio || null,
        fechaFin: form.fechaFin || null,
        observaciones: form.observaciones,
        ...(isEditMode ? { activo: form.activo } : {}),
      }

      if (isEditMode && selectedProyecto) {
        const updated = await updateProyecto(selectedProyecto.id, data)
        setProyectos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        toast({ title: "Proyecto actualizado", description: `"${updated.nombre}" se actualizó correctamente.` })
      } else {
        const created = await createProyecto(data)
        setProyectos((prev) => [...prev, created])
        toast({ title: "Proyecto creado", description: `"${created.nombre}" se creó correctamente.` })
      }

      setIsDialogOpen(false)
      resetForm()
    } catch {
      toast({ title: "Error", description: "No se pudo guardar el proyecto.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedProyecto) return
    setIsLoading(true)

    try {
      await deleteProyecto(selectedProyecto.id)
      setProyectos((prev) => prev.filter((p) => p.id !== selectedProyecto.id))
      setIsDeleteDialogOpen(false)
      toast({ title: "Proyecto eliminado", description: `"${selectedProyecto.nombre}" fue eliminado.` })
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el proyecto.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleActivo = async (proyecto: Proyecto) => {
    try {
      const updated = await updateProyecto(proyecto.id, { activo: !proyecto.activo })
      setProyectos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      toast({
        title: updated.activo ? "Proyecto activado" : "Proyecto desactivado",
        description: `"${updated.nombre}" ahora está ${updated.activo ? "activo" : "inactivo"}.`,
      })
    } catch {
      toast({ title: "Error", description: "No se pudo cambiar el estado.", variant: "destructive" })
    }
  }

  const handleVerReporte = async (proyecto: Proyecto) => {
    try {
      const data = await getReporteProyecto(proyecto.id)
      setReporteData(data)
      setSelectedProyecto(proyecto)
      setIsReporteDialogOpen(true)
    } catch {
      toast({ title: "Error", description: "No se pudo generar el reporte.", variant: "destructive" })
    }
  }

  const handleDescargarPDF = async () => {
    if (!reporteData) return
    try {
      const result = generateReporteProyectoPDF(reporteData)
      const saved = await savePDFWithDialog(result)
      if (saved) toast({ title: "PDF guardado", description: "El reporte fue guardado correctamente." })
    } catch (error) {
      console.error("Error generando PDF:", error)
      toast({ title: "Error", description: `No se pudo generar el PDF: ${error}`, variant: "destructive" })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <BackToHome />
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderKanban className="h-7 w-7 text-blue-600" />
            Proyectos
          </h1>
          <p className="text-slate-500 mt-1">
            Gestiona los proyectos del edificio y sus presupuestos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/mensajes?contexto=proyecto')}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Notificar
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Proyecto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar proyectos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activos">Activos</SelectItem>
            <SelectItem value="inactivos">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Grid */}
      {filteredProyectos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg">No hay proyectos</p>
            <p className="text-slate-400 text-sm mt-1">
              Crea un proyecto para empezar a asignar movimientos
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProyectos.map((proyecto) => (
            <Card key={proyecto.id} className={!proyecto.activo ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{proyecto.nombre}</CardTitle>
                  <Badge variant={proyecto.activo ? "default" : "secondary"}>
                    {proyecto.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <DollarSign className="h-4 w-4" />
                  <span>Presupuesto: {formatCurrency(proyecto.presupuesto)}</span>
                </div>
                {proyecto.fechaInicio && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatDate(proyecto.fechaInicio)}
                      {proyecto.fechaFin ? ` - ${formatDate(proyecto.fechaFin)}` : " - En curso"}
                    </span>
                  </div>
                )}

                <div className="flex gap-1 pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={() => handleVerReporte(proyecto)} title="Ver reporte">
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(proyecto)} title="Editar">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActivo(proyecto)}
                    title={proyecto.activo ? "Desactivar" : "Activar"}
                  >
                    {proyecto.activo ? (
                      <XCircle className="h-4 w-4 text-orange-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(proyecto)} title="Eliminar">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: Crear/Editar Proyecto */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Editar Proyecto" : "Nuevo Proyecto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Proyecto *</Label>
              <Input
                id="nombre"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Reparacion Ascensor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="presupuesto">Presupuesto</Label>
              <Input
                id="presupuesto"
                type="number"
                min={0}
                step={0.01}
                value={form.presupuesto}
                onChange={(e) => setForm({ ...form, presupuesto: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                <Input
                  id="fechaInicio"
                  type="date"
                  value={form.fechaInicio}
                  onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaFin">Fecha Fin</Label>
                <Input
                  id="fechaFin"
                  type="date"
                  value={form.fechaFin}
                  onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                rows={3}
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Aspectos generales del proyecto..."
              />
            </div>

            {isEditMode && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Estado del Proyecto</Label>
                  <p className="text-sm text-slate-500">
                    {form.activo ? "El proyecto está activo" : "El proyecto está inactivo"}
                  </p>
                </div>
                <Select
                  value={form.activo ? "activo" : "inactivo"}
                  onValueChange={(v) => setForm({ ...form, activo: v === "activo" })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : isEditMode ? "Guardar Cambios" : "Crear Proyecto"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminacion */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Proyecto</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara el proyecto <strong>&quot;{selectedProyecto?.nombre}&quot;</strong> y
              desvinculara todos los movimientos bancarios asociados. Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isLoading}
            >
              {isLoading ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Reporte del Proyecto */}
      <Dialog open={isReporteDialogOpen} onOpenChange={setIsReporteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Reporte: {selectedProyecto?.nombre}
            </DialogTitle>
          </DialogHeader>

          {reporteData && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="flex items-center gap-4 text-sm border rounded-lg px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Presupuesto:</span>
                  <span className="font-semibold text-blue-700">{formatCurrency(reporteData.presupuesto)}</span>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Ejecutado:</span>
                  <span className="font-semibold text-red-700">{formatCurrency(reporteData.ejecutado)}</span>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Ingresos:</span>
                  <span className="font-semibold text-green-700">{formatCurrency(reporteData.totalIngresos)}</span>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">% Ejecutado:</span>
                  <span className="font-semibold text-slate-800">{reporteData.porcentajeEjecutado.toFixed(1)}%</span>
                </div>
              </div>

              {/* Barra de progreso */}
              {reporteData.presupuesto > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Ejecucion presupuestaria</span>
                    <span>{reporteData.porcentajeEjecutado.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        reporteData.porcentajeEjecutado > 100
                          ? "bg-red-500"
                          : reporteData.porcentajeEjecutado > 80
                          ? "bg-orange-500"
                          : "bg-blue-600"
                      }`}
                      style={{ width: `${Math.min(reporteData.porcentajeEjecutado, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Movimientos */}
              <div>
                <h3 className="font-medium text-slate-700 mb-2">
                  Movimientos ({reporteData.movimientos.length})
                </h3>
                {reporteData.movimientos.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">
                    No hay movimientos asociados a este proyecto
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Fecha</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Descripcion</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Cuenta</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {reporteData.movimientos.map((mov) => (
                          <tr key={mov.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600">{formatDate(mov.fecha)}</td>
                            <td className="px-3 py-2">{mov.descripcion}</td>
                            <td className="px-3 py-2 text-slate-500 text-xs">
                              {mov.cuentaBancaria}
                              <br />
                              {mov.numeroCuenta}
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${
                              mov.tipo === "INGRESO" ? "text-green-600" : "text-red-600"
                            }`}>
                              {mov.tipo === "INGRESO" ? "+" : "-"}{formatCurrency(mov.monto)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Boton descargar PDF */}
              <div className="flex justify-end pt-2">
                <Button onClick={handleDescargarPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Descargar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
