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
import { Users, Plus, Search, Download, Edit, Trash2, Phone, Mail, Building2 } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { createInquilino, updateInquilino, deleteInquilino } from "./actions"

type Apartamento = {
  id: string
  numero: string
}

type Inquilino = {
  id: string
  nombre: string
  apellido: string
  cedula: string | null
  email: string | null
  telefono: string | null
  tipo: "PROPIETARIO" | "INQUILINO"
  activo: boolean
  fechaIngreso: Date | string
  fechaSalida: Date | string | null
  notas: string | null
  apartamentoId: string | null
  apartamento: Apartamento | null
}

type Props = {
  initialInquilinos: Inquilino[]
  apartamentos: Apartamento[]
}

const tipoLabels = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
}

export function InquilinosClient({ initialInquilinos, apartamentos }: Props) {
  const [inquilinos, setInquilinos] = useState(initialInquilinos)
  const [search, setSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedInquilino, setSelectedInquilino] = useState<Inquilino | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    cedula: "",
    email: "",
    telefono: "",
    tipo: "INQUILINO",
    activo: true,
    apartamentoId: "",
    notas: "",
  })

  const filteredInquilinos = inquilinos.filter((inq) =>
    `${inq.nombre} ${inq.apellido}`.toLowerCase().includes(search.toLowerCase()) ||
    inq.cedula?.includes(search) ||
    inq.apartamento?.numero.includes(search)
  )

  const resetForm = () => {
    setFormData({
      nombre: "",
      apellido: "",
      cedula: "",
      email: "",
      telefono: "",
      tipo: "INQUILINO",
      activo: true,
      apartamentoId: "",
      notas: "",
    })
    setSelectedInquilino(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (inq: Inquilino) => {
    setSelectedInquilino(inq)
    setFormData({
      nombre: inq.nombre,
      apellido: inq.apellido,
      cedula: inq.cedula || "",
      email: inq.email || "",
      telefono: inq.telefono || "",
      tipo: inq.tipo,
      activo: inq.activo,
      apartamentoId: inq.apartamentoId || "",
      notas: inq.notas || "",
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (inq: Inquilino) => {
    setSelectedInquilino(inq)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const data = {
        nombre: formData.nombre,
        apellido: formData.apellido,
        cedula: formData.cedula || null,
        email: formData.email || null,
        telefono: formData.telefono || null,
        tipo: formData.tipo as "PROPIETARIO" | "INQUILINO",
        activo: formData.activo,
        apartamentoId: formData.apartamentoId || null,
        notas: formData.notas || null,
      }

      if (selectedInquilino) {
        const updated = await updateInquilino(selectedInquilino.id, data)
        setInquilinos((prev) =>
          prev.map((inq) => (inq.id === updated.id ? updated : inq))
        )
      } else {
        const created = await createInquilino(data)
        setInquilinos((prev) => [...prev, created])
      }

      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error saving inquilino:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedInquilino) return
    setIsLoading(true)

    try {
      await deleteInquilino(selectedInquilino.id)
      setInquilinos((prev) => prev.filter((inq) => inq.id !== selectedInquilino.id))
      setIsDeleteDialogOpen(false)
      setSelectedInquilino(null)
    } catch (error) {
      console.error("Error deleting inquilino:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = () => {
    const headers = ["Nombre", "Apellido", "Cédula", "Email", "Teléfono", "Tipo", "Apartamento", "Activo"]
    const rows = inquilinos.map((inq) => [
      inq.nombre,
      inq.apellido,
      inq.cedula || "",
      inq.email || "",
      inq.telefono || "",
      tipoLabels[inq.tipo],
      inq.apartamento?.numero || "",
      inq.activo ? "Sí" : "No",
    ])

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "inquilinos.csv"
    a.click()
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Inquilinos</h1>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar inquilino..."
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
            Nuevo Inquilino
          </Button>
        </div>
      </div>

      {/* Inquilinos List */}
      <Card>
        <CardContent className="p-0">
          {filteredInquilinos.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay inquilinos registrados</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredInquilinos.map((inq) => (
                <div
                  key={inq.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">
                          {inq.nombre} {inq.apellido}
                        </h3>
                        <Badge variant={inq.tipo === "PROPIETARIO" ? "info" : "secondary"}>
                          {tipoLabels[inq.tipo]}
                        </Badge>
                        {!inq.activo && (
                          <Badge variant="destructive">Inactivo</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        {inq.apartamento && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            Apto {inq.apartamento.numero}
                          </span>
                        )}
                        {inq.telefono && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {inq.telefono}
                          </span>
                        )}
                        {inq.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {inq.email}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Desde: {formatDate(inq.fechaIngreso)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(inq)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(inq)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedInquilino ? "Editar Inquilino" : "Nuevo Inquilino"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  placeholder="Nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido *</Label>
                <Input
                  id="apellido"
                  placeholder="Apellido"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cedula">Cédula</Label>
                <Input
                  id="cedula"
                  placeholder="Número de cédula"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INQUILINO">Inquilino</SelectItem>
                    <SelectItem value="PROPIETARIO">Propietario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  placeholder="Teléfono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apartamento">Apartamento</Label>
              <Select
                value={formData.apartamentoId}
                onValueChange={(value) => setFormData({ ...formData, apartamentoId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar apartamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin asignar</SelectItem>
                  {apartamentos.map((apt) => (
                    <SelectItem key={apt.id} value={apt.id}>
                      Apto {apt.numero}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo"
                checked={formData.activo}
                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="activo">Activo</Label>
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
            <AlertDialogTitle>¿Eliminar inquilino?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente a{" "}
              {selectedInquilino?.nombre} {selectedInquilino?.apellido}.
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
