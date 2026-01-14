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
import { Building2, Plus, Search, Download, FileText, Share2, Edit, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import {
  createApartamento,
  updateApartamento,
  deleteApartamento,
} from "./actions"
import { generateApartamentoPDF } from "@/lib/pdf"

type Apartamento = {
  id: string
  numero: string
  piso: number | null
  metrosCuadrados: number | null
  habitaciones: number
  banos: number
  alicuota: number
  cuotaMensual: number
  estado: "DISPONIBLE" | "OCUPADO" | "MANTENIMIENTO"
  celular: string | null
  email: string | null
  notas: string | null
}

type Props = {
  initialApartamentos: Apartamento[]
}

const estadoLabels = {
  DISPONIBLE: "Disponible",
  OCUPADO: "Ocupado",
  MANTENIMIENTO: "Mantenimiento",
}

const estadoColors = {
  DISPONIBLE: "success" as const,
  OCUPADO: "info" as const,
  MANTENIMIENTO: "warning" as const,
}

export function ApartamentosClient({ initialApartamentos }: Props) {
  const [apartamentos, setApartamentos] = useState(initialApartamentos)
  const [search, setSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedApartamento, setSelectedApartamento] = useState<Apartamento | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    numero: "",
    piso: "",
    metrosCuadrados: "",
    habitaciones: "1",
    banos: "1",
    estado: "DISPONIBLE",
    cuotaMensual: "0",
    celular: "",
    email: "",
    notas: "",
  })

  const filteredApartamentos = apartamentos.filter((apt) =>
    apt.numero.toLowerCase().includes(search.toLowerCase())
  )

  const resetForm = () => {
    setFormData({
      numero: "",
      piso: "",
      metrosCuadrados: "",
      habitaciones: "1",
      banos: "1",
      estado: "DISPONIBLE",
      cuotaMensual: "0",
      celular: "",
      email: "",
      notas: "",
    })
    setSelectedApartamento(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (apt: Apartamento) => {
    setSelectedApartamento(apt)
    setFormData({
      numero: apt.numero,
      piso: apt.piso?.toString() || "",
      metrosCuadrados: apt.metrosCuadrados?.toString() || "",
      habitaciones: apt.habitaciones.toString(),
      banos: apt.banos.toString(),
      estado: apt.estado,
      cuotaMensual: apt.cuotaMensual.toString(),
      celular: apt.celular || "",
      email: apt.email || "",
      notas: apt.notas || "",
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (apt: Apartamento) => {
    setSelectedApartamento(apt)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const data = {
        numero: formData.numero,
        piso: formData.piso ? parseInt(formData.piso) : null,
        metrosCuadrados: formData.metrosCuadrados ? parseFloat(formData.metrosCuadrados) : null,
        habitaciones: parseInt(formData.habitaciones),
        banos: parseInt(formData.banos),
        estado: formData.estado as "DISPONIBLE" | "OCUPADO" | "MANTENIMIENTO",
        cuotaMensual: parseFloat(formData.cuotaMensual) || 0,
        celular: formData.celular || null,
        email: formData.email || null,
        notas: formData.notas || null,
      }

      if (selectedApartamento) {
        const updated = await updateApartamento(selectedApartamento.id, data)
        setApartamentos((prev) =>
          prev.map((apt) => (apt.id === updated.id ? updated : apt))
        )
      } else {
        const created = await createApartamento(data)
        setApartamentos((prev) => [...prev, created])
      }

      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error saving apartamento:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedApartamento) return
    setIsLoading(true)

    try {
      await deleteApartamento(selectedApartamento.id)
      setApartamentos((prev) => prev.filter((apt) => apt.id !== selectedApartamento.id))
      setIsDeleteDialogOpen(false)
      setSelectedApartamento(null)
    } catch (error) {
      console.error("Error deleting apartamento:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGeneratePDF = (apt: Apartamento) => {
    generateApartamentoPDF(apt)
  }

  const handleShareWhatsApp = (apt: Apartamento) => {
    const message = `Apartamento ${apt.numero}\nPiso: ${apt.piso || 'N/A'}\nHabitaciones: ${apt.habitaciones}\nBaños: ${apt.banos}\nCuota mensual: ${formatCurrency(apt.cuotaMensual)}\nEstado: ${estadoLabels[apt.estado]}`
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleExport = () => {
    const headers = ["Número", "Piso", "Habitaciones", "Baños", "Cuota Mensual", "Estado"]
    const rows = apartamentos.map((apt) => [
      apt.numero,
      apt.piso?.toString() || "",
      apt.habitaciones.toString(),
      apt.banos.toString(),
      apt.cuotaMensual.toString(),
      estadoLabels[apt.estado],
    ])

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "apartamentos.csv"
    a.click()
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Apartamentos</h1>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar apartamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Apartamento
          </Button>
        </div>
      </div>

      {/* Apartments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredApartamentos.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No hay apartamentos registrados</p>
          </div>
        ) : (
          filteredApartamentos.map((apt) => (
            <Card key={apt.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Apto {apt.numero}</h3>
                      <p className="text-sm text-slate-500">Piso {apt.piso || 'N/A'}</p>
                    </div>
                  </div>
                  <Badge variant={estadoColors[apt.estado]}>
                    {estadoLabels[apt.estado]}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
                  <span>{apt.metrosCuadrados || 0}</span>
                  <span>Hab: <strong>{apt.habitaciones}</strong> Baños: <strong>{apt.banos}</strong></span>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-slate-500">Cuota mensual</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(apt.cuotaMensual)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGeneratePDF(apt)}
                      title="Generar PDF"
                    >
                      <FileText className="h-4 w-4" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShareWhatsApp(apt)}
                      title="Compartir por WhatsApp"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(apt)}
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(apt)}
                      title="Eliminar"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
              {selectedApartamento ? "Editar Apartamento" : "Nuevo Apartamento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero">Número *</Label>
                <Input
                  id="numero"
                  placeholder="Ej: 101"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="piso">Piso</Label>
                <Input
                  id="piso"
                  type="number"
                  placeholder="Ej: 1"
                  value={formData.piso}
                  onChange={(e) => setFormData({ ...formData, piso: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="m2">m²</Label>
                <Input
                  id="m2"
                  type="number"
                  value={formData.metrosCuadrados}
                  onChange={(e) => setFormData({ ...formData, metrosCuadrados: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="habitaciones">Habitaciones</Label>
                <Input
                  id="habitaciones"
                  type="number"
                  min="1"
                  value={formData.habitaciones}
                  onChange={(e) => setFormData({ ...formData, habitaciones: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banos">Baños</Label>
                <Input
                  id="banos"
                  type="number"
                  min="1"
                  value={formData.banos}
                  onChange={(e) => setFormData({ ...formData, banos: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(value) => setFormData({ ...formData, estado: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DISPONIBLE">Disponible</SelectItem>
                    <SelectItem value="OCUPADO">Ocupado</SelectItem>
                    <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuotaMensual">Cuota mensual</Label>
                <Input
                  id="cuotaMensual"
                  type="number"
                  min="0"
                  value={formData.cuotaMensual}
                  onChange={(e) => setFormData({ ...formData, cuotaMensual: e.target.value })}
                />
              </div>
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                placeholder="Notas adicionales..."
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
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
            <AlertDialogTitle>¿Eliminar apartamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              apartamento {selectedApartamento?.numero}.
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
