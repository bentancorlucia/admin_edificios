"use client"

import { useState, useEffect } from "react"
import { open } from "@tauri-apps/plugin-shell"
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
import { Wrench, Plus, Search, Download, Edit, Trash2, AlertCircle, Phone, Mail, FileText, Settings, X, Building2, CreditCard } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  createServicio,
  updateServicio,
  deleteServicio,
  getTiposServicioActivos,
  createTipoServicio,
  deleteTipoServicio,
  type Servicio as ServicioType,
  type TipoServicio as TipoServicioType,
} from "@/lib/database"
import { generateServiciosPDF } from "@/lib/servicios-pdf"
import { toast } from "@/hooks/use-toast"

type Servicio = {
  id: string
  tipo: string
  nombre: string
  celular: string | null
  email: string | null
  banco: string | null
  numeroCuenta: string | null
  observaciones: string | null
  activo: boolean
}

type Props = {
  initialServicios: Servicio[]
  initialTiposServicio: TipoServicioType[]
}

export function ServiciosClient({ initialServicios, initialTiposServicio }: Props) {
  const [servicios, setServicios] = useState(initialServicios)
  const [tiposServicio, setTiposServicio] = useState<TipoServicioType[]>(initialTiposServicio)
  const [search, setSearch] = useState("")
  const [filterTipo, setFilterTipo] = useState<string>("TODOS")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isTiposDialogOpen, setIsTiposDialogOpen] = useState(false)
  const [isDeleteTipoDialogOpen, setIsDeleteTipoDialogOpen] = useState(false)
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null)
  const [selectedTipoToDelete, setSelectedTipoToDelete] = useState<TipoServicioType | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tipoError, setTipoError] = useState<string | null>(null)
  const [nuevoTipo, setNuevoTipo] = useState({ codigo: "", nombre: "" })

  // Crear mapas de labels y colores dinámicos
  const tipoServicioLabels: Record<string, string> = {}
  const tipoServicioColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {}

  tiposServicio.forEach(tipo => {
    tipoServicioLabels[tipo.codigo] = tipo.nombre
    tipoServicioColors[tipo.codigo] = tipo.color as "default" | "secondary" | "destructive" | "outline"
  })

  const [formData, setFormData] = useState({
    tipo: tiposServicio[0]?.codigo || "",
    nombre: "",
    celular: "",
    email: "",
    banco: "",
    numeroCuenta: "",
    observaciones: "",
  })

  const filteredServicios = servicios.filter((srv) => {
    const tipoLabel = tipoServicioLabels[srv.tipo] || srv.tipo
    const matchesSearch = srv.nombre.toLowerCase().includes(search.toLowerCase()) ||
      tipoLabel.toLowerCase().includes(search.toLowerCase())
    const matchesTipo = filterTipo === "TODOS" || srv.tipo === filterTipo
    return matchesSearch && matchesTipo
  })

  const resetForm = () => {
    setFormData({
      tipo: "ELECTRICISTA",
      nombre: "",
      celular: "",
      email: "",
      banco: "",
      numeroCuenta: "",
      observaciones: "",
    })
    setSelectedServicio(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setError(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (srv: Servicio) => {
    setSelectedServicio(srv)
    setError(null)
    setFormData({
      tipo: srv.tipo,
      nombre: srv.nombre,
      celular: srv.celular || "",
      email: srv.email || "",
      banco: srv.banco || "",
      numeroCuenta: srv.numeroCuenta || "",
      observaciones: srv.observaciones || "",
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (srv: Servicio) => {
    setSelectedServicio(srv)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const data = {
        tipo: formData.tipo,
        nombre: formData.nombre,
        celular: formData.celular || null,
        email: formData.email || null,
        banco: formData.banco || null,
        numeroCuenta: formData.numeroCuenta || null,
        observaciones: formData.observaciones || null,
      }

      if (selectedServicio) {
        const result = await updateServicio(selectedServicio.id, data)
        setServicios((prev) =>
          prev.map((srv) => (srv.id === result.id ? result as Servicio : srv))
        )
      } else {
        const result = await createServicio(data)
        setServicios((prev) => [...prev, result as Servicio])
      }

      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error saving servicio:", error)
      setError("Error inesperado. Por favor intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedServicio) return
    setIsLoading(true)

    try {
      await deleteServicio(selectedServicio.id)
      setServicios((prev) => prev.filter((srv) => srv.id !== selectedServicio.id))
      setIsDeleteDialogOpen(false)
      setSelectedServicio(null)
    } catch (error) {
      console.error("Error deleting servicio:", error)
      alert("Error al eliminar el servicio")
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ["Tipo", "Nombre", "Celular", "Email", "Banco", "Número de Cuenta", "Observaciones"]
    const rows = servicios.map((srv) => [
      tipoServicioLabels[srv.tipo] || srv.tipo,
      srv.nombre,
      srv.celular || "",
      srv.email || "",
      srv.banco || "",
      srv.numeroCuenta || "",
      srv.observaciones || "",
    ])

    const csvContent = [headers, ...rows].map((row) => row.map(cell => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "servicios.csv"
    a.click()
    toast({
      title: "CSV descargado",
      description: "Directorio de servicios exportado correctamente",
      variant: "success",
    })
  }

  const handleExportPDF = () => {
    generateServiciosPDF(servicios, tiposServicio)
    toast({
      title: "PDF descargado",
      description: "Directorio de servicios exportado correctamente",
      variant: "success",
    })
  }

  const handleCallPhone = (celular: string) => {
    window.open(`tel:${celular}`, '_self')
  }

  const handleSendEmail = (email: string) => {
    window.open(`mailto:${email}`, '_blank')
  }

  // Funciones para gestionar tipos de servicio
  const handleAddTipoServicio = async () => {
    if (!nuevoTipo.codigo.trim() || !nuevoTipo.nombre.trim()) {
      setTipoError("El código y nombre son requeridos")
      return
    }

    // Normalizar el código: mayúsculas, sin espacios, solo letras/números/guión bajo
    const codigoNormalizado = nuevoTipo.codigo
      .toUpperCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '')

    if (!codigoNormalizado) {
      setTipoError("El código debe contener al menos una letra o número")
      return
    }

    // Verificar que el código no exista
    if (tiposServicio.some(t => t.codigo === codigoNormalizado)) {
      setTipoError("Ya existe un tipo con ese código")
      return
    }

    setIsLoading(true)
    setTipoError(null)

    try {
      const result = await createTipoServicio({
        codigo: codigoNormalizado,
        nombre: nuevoTipo.nombre.trim(),
      })
      setTiposServicio(prev => [...prev, result])
      setNuevoTipo({ codigo: "", nombre: "" })
      toast({
        title: "Tipo agregado",
        description: `Se agregó el tipo "${result.nombre}"`,
        variant: "success",
      })
    } catch (error) {
      console.error("Error adding tipo:", error)
      let errorMsg = "Error al agregar el tipo de servicio"
      if (error instanceof Error) {
        errorMsg = error.message
      } else if (typeof error === 'string') {
        errorMsg = error
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMsg = String((error as { message: unknown }).message)
      }
      setTipoError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTipoServicio = async () => {
    if (!selectedTipoToDelete) return

    setIsLoading(true)
    try {
      await deleteTipoServicio(selectedTipoToDelete.id)
      setTiposServicio(prev => prev.filter(t => t.id !== selectedTipoToDelete.id))
      setIsDeleteTipoDialogOpen(false)
      setSelectedTipoToDelete(null)
      toast({
        title: "Tipo eliminado",
        description: `Se eliminó el tipo "${selectedTipoToDelete.nombre}"`,
        variant: "success",
      })
    } catch (error) {
      console.error("Error deleting tipo:", error)
      const errorMsg = error instanceof Error ? error.message : "Error al eliminar el tipo"
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const openDeleteTipoDialog = (tipo: TipoServicioType) => {
    setSelectedTipoToDelete(tipo)
    setIsDeleteTipoDialogOpen(true)
  }

  const handleWhatsApp = async (srv: Servicio) => {
    if (!srv.celular) return
    const message = `Hola ${srv.nombre}, me comunico del edificio.`
    const url = `https://wa.me/${srv.celular.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
    await open(url)
  }

  return (
    <div className="space-y-8 px-4 md:px-8 lg:px-12 py-6">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6bTEwIDEwdjZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Wrench className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Directorio de Servicios</h1>
                <p className="text-amber-100 text-sm">
                  Proveedores y contactos de mantenimiento
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsTiposDialogOpen(true)}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
              title="Gestionar tipos de servicio"
            >
              <Settings className="h-4 w-4 mr-2" />
              Tipos
            </Button>
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
              Nuevo Servicio
            </Button>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nombre o tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterTipo} onValueChange={(value) => setFilterTipo(value)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los tipos</SelectItem>
            {tiposServicio.map((tipo) => (
              <SelectItem key={tipo.codigo} value={tipo.codigo}>{tipo.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServicios.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Wrench className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No hay servicios registrados</p>
          </div>
        ) : (
          filteredServicios.map((srv) => (
            <Card key={srv.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Wrench className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{srv.nombre}</h3>
                      <Badge variant={tipoServicioColors[srv.tipo]}>
                        {tipoServicioLabels[srv.tipo]}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Contacto */}
                <div className="mb-4 p-3 bg-slate-50 rounded-lg space-y-2">
                  {srv.celular && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <button
                        onClick={() => handleCallPhone(srv.celular!)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {srv.celular}
                      </button>
                    </div>
                  )}
                  {srv.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <button
                        onClick={() => handleSendEmail(srv.email!)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {srv.email}
                      </button>
                    </div>
                  )}
                  {!srv.celular && !srv.email && (
                    <p className="text-sm text-slate-400">Sin datos de contacto</p>
                  )}
                </div>

                {/* Datos Bancarios */}
                {(srv.banco || srv.numeroCuenta) && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg space-y-2">
                    <p className="text-xs text-blue-600 mb-1 font-medium">Datos Bancarios</p>
                    {srv.banco && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-slate-700">{srv.banco}</span>
                      </div>
                    )}
                    {srv.numeroCuenta && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-slate-700">{srv.numeroCuenta}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Observaciones */}
                {srv.observaciones && (
                  <div className="mb-4 p-3 bg-amber-50 rounded-lg">
                    <p className="text-xs text-amber-600 mb-1">Observaciones</p>
                    <p className="text-sm text-slate-700">{srv.observaciones}</p>
                  </div>
                )}

                <div className="flex gap-2 border-t pt-4">
                  {srv.celular && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleWhatsApp(srv)}
                      title="WhatsApp"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(srv)}
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(srv)}
                    title="Eliminar"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
              {selectedServicio ? "Editar Servicio" : "Nuevo Servicio"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Tipo de Servicio */}
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Servicio *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposServicio.map((tipo) => (
                    <SelectItem key={tipo.codigo} value={tipo.codigo}>{tipo.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                placeholder="Ej: Juan Pérez"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </div>

            {/* Contacto */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="celular">Celular</Label>
                <Input
                  id="celular"
                  placeholder="Ej: 3001234567"
                  value={formData.celular}
                  onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {/* Datos Bancarios */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="banco">Banco</Label>
                <Input
                  id="banco"
                  placeholder="Ej: BROU, Santander"
                  value={formData.banco}
                  onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numeroCuenta">Número de Cuenta</Label>
                <Input
                  id="numeroCuenta"
                  placeholder="Ej: 123456789"
                  value={formData.numeroCuenta}
                  onChange={(e) => setFormData({ ...formData, numeroCuenta: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                placeholder="Notas adicionales sobre el servicio..."
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              />
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
            <AlertDialogTitle>¿Eliminar servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              servicio {selectedServicio?.nombre}.
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

      {/* Tipos de Servicio Dialog */}
      <Dialog open={isTiposDialogOpen} onOpenChange={setIsTiposDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Gestionar Tipos de Servicio
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Agregar nuevo tipo */}
            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
              <h4 className="font-medium text-sm text-slate-700">Agregar nuevo tipo</h4>
              {tipoError && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{tipoError}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Código (ej: PORTERO)"
                  value={nuevoTipo.codigo}
                  onChange={(e) => setNuevoTipo({ ...nuevoTipo, codigo: e.target.value })}
                />
                <Input
                  placeholder="Nombre (ej: Portero)"
                  value={nuevoTipo.nombre}
                  onChange={(e) => setNuevoTipo({ ...nuevoTipo, nombre: e.target.value })}
                />
              </div>
              <Button
                size="sm"
                onClick={handleAddTipoServicio}
                disabled={isLoading || !nuevoTipo.codigo.trim() || !nuevoTipo.nombre.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Tipo
              </Button>
            </div>

            {/* Lista de tipos existentes */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-slate-700">Tipos existentes ({tiposServicio.length})</h4>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {tiposServicio.map((tipo) => (
                  <div
                    key={tipo.id}
                    className="flex items-center justify-between p-2 bg-white border rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={tipo.color as "default" | "secondary" | "destructive" | "outline"}>
                        {tipo.codigo}
                      </Badge>
                      <span className="text-sm text-slate-700">{tipo.nombre}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteTipoDialog(tipo)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setIsTiposDialogOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Tipo Confirmation Dialog */}
      <AlertDialog open={isDeleteTipoDialogOpen} onOpenChange={setIsDeleteTipoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tipo de servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el tipo &quot;{selectedTipoToDelete?.nombre}&quot;.
              No se puede eliminar si hay servicios usando este tipo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTipoServicio}
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
