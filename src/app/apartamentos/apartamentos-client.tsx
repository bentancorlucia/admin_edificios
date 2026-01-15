"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
  AlertDialogTrigger,
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
import { Building2, Plus, Search, Download, FileText, Share2, Edit, Trash2, AlertCircle, Receipt, Wallet, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency } from "@/lib/utils"
import {
  createApartamento,
  updateApartamento,
  deleteApartamento,
  generarTransaccionesMensuales,
} from "./actions"
import {
  generateApartamentoPDF,
  generatePropietarioPDF,
  generateInquilinoPDF,
  generateApartamentoCompletoPDF
} from "@/lib/pdf"

type Apartamento = {
  id: string
  numero: string
  piso: number | null
  alicuota: number
  gastosComunes: number
  fondoReserva: number
  tipoOcupacion: "PROPIETARIO" | "INQUILINO"
  contactoNombre: string | null
  contactoApellido: string | null
  contactoCelular: string | null
  contactoEmail: string | null
  notas: string | null
}

type ApartamentoAgrupado = {
  numero: string
  piso: number | null
  propietario: Apartamento | null
  inquilino: Apartamento | null
}

type Props = {
  initialApartamentos: Apartamento[]
  initialSaldos: Record<string, number>
}

const tipoOcupacionLabels = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
}

const tipoOcupacionColors = {
  PROPIETARIO: "default" as const,
  INQUILINO: "secondary" as const,
}

const tipoOcupacionBadge = {
  PROPIETARIO: "P",
  INQUILINO: "I",
}

// Función para agrupar apartamentos por número
function agruparApartamentos(apartamentos: Apartamento[]): ApartamentoAgrupado[] {
  const grupos = new Map<string, ApartamentoAgrupado>()

  apartamentos.forEach((apt) => {
    const existing = grupos.get(apt.numero)
    if (existing) {
      if (apt.tipoOcupacion === "PROPIETARIO") {
        existing.propietario = apt
      } else {
        existing.inquilino = apt
      }
    } else {
      grupos.set(apt.numero, {
        numero: apt.numero,
        piso: apt.piso,
        propietario: apt.tipoOcupacion === "PROPIETARIO" ? apt : null,
        inquilino: apt.tipoOcupacion === "INQUILINO" ? apt : null,
      })
    }
  })

  return Array.from(grupos.values()).sort((a, b) => a.numero.localeCompare(b.numero))
}

export function ApartamentosClient({ initialApartamentos, initialSaldos }: Props) {
  const router = useRouter()
  const [apartamentos, setApartamentos] = useState(initialApartamentos)
  const [saldos, setSaldos] = useState(initialSaldos)
  const [search, setSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedApartamento, setSelectedApartamento] = useState<Apartamento | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
  const [successData, setSuccessData] = useState<{ creadas: number; mes: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    numero: "",
    piso: "",
    tipoOcupacion: "PROPIETARIO",
    gastosComunes: "0",
    fondoReserva: "0",
    contactoNombre: "",
    contactoApellido: "",
    contactoCelular: "",
    contactoEmail: "",
    notas: "",
  })

  const apartamentosAgrupados = agruparApartamentos(apartamentos)
  const filteredApartamentos = apartamentosAgrupados.filter((grupo) =>
    grupo.numero.toLowerCase().includes(search.toLowerCase())
  )

  const resetForm = () => {
    setFormData({
      numero: "",
      piso: "",
      tipoOcupacion: "PROPIETARIO",
      gastosComunes: "0",
      fondoReserva: "0",
      contactoNombre: "",
      contactoApellido: "",
      contactoCelular: "",
      contactoEmail: "",
      notas: "",
    })
    setSelectedApartamento(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setError(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (apt: Apartamento) => {
    setSelectedApartamento(apt)
    setError(null)
    setFormData({
      numero: apt.numero,
      piso: apt.piso?.toString() || "",
      tipoOcupacion: apt.tipoOcupacion,
      gastosComunes: apt.gastosComunes.toString(),
      fondoReserva: apt.fondoReserva.toString(),
      contactoNombre: apt.contactoNombre || "",
      contactoApellido: apt.contactoApellido || "",
      contactoCelular: apt.contactoCelular || "",
      contactoEmail: apt.contactoEmail || "",
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
    setError(null)

    try {
      const data = {
        numero: formData.numero,
        piso: formData.piso ? parseInt(formData.piso) : null,
        tipoOcupacion: formData.tipoOcupacion as "PROPIETARIO" | "INQUILINO",
        gastosComunes: parseFloat(formData.gastosComunes) || 0,
        fondoReserva: parseFloat(formData.fondoReserva) || 0,
        contactoNombre: formData.contactoNombre || null,
        contactoApellido: formData.contactoApellido || null,
        contactoCelular: formData.contactoCelular || null,
        contactoEmail: formData.contactoEmail || null,
        notas: formData.notas || null,
      }

      if (selectedApartamento) {
        const result = await updateApartamento(selectedApartamento.id, data)
        if (!result.success) {
          setError(result.error)
          return
        }
        setApartamentos((prev) =>
          prev.map((apt) => (apt.id === result.data.id ? result.data : apt))
        )
      } else {
        const result = await createApartamento(data)
        if (!result.success) {
          setError(result.error)
          return
        }
        setApartamentos((prev) => [...prev, result.data])
      }

      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error saving apartamento:", error)
      setError("Error inesperado. Por favor intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedApartamento) return
    setIsLoading(true)

    try {
      const result = await deleteApartamento(selectedApartamento.id)
      if (!result.success) {
        alert(result.error)
        return
      }
      setApartamentos((prev) => prev.filter((apt) => apt.id !== selectedApartamento.id))
      setIsDeleteDialogOpen(false)
      setSelectedApartamento(null)
    } catch (error) {
      console.error("Error deleting apartamento:", error)
      alert("Error al eliminar el apartamento")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGeneratePDF = (apt: Apartamento) => {
    generateApartamentoPDF(apt)
  }

  const handleGeneratePropietarioPDF = (grupo: ApartamentoAgrupado) => {
    generatePropietarioPDF(grupo, saldos)
  }

  const handleGenerateInquilinoPDF = (grupo: ApartamentoAgrupado) => {
    generateInquilinoPDF(grupo, saldos)
  }

  const handleGenerateCompletoPDF = (grupo: ApartamentoAgrupado) => {
    generateApartamentoCompletoPDF(grupo, saldos)
  }

  const handleShareWhatsApp = (apt: Apartamento) => {
    const totalMensual = apt.gastosComunes + apt.fondoReserva
    const contacto = apt.contactoNombre ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim() : 'Sin contacto'
    const message = `Apartamento ${apt.numero}\nPiso: ${apt.piso || 'N/A'}\nTipo: ${tipoOcupacionLabels[apt.tipoOcupacion]}\nContacto: ${contacto}\nGastos Comunes: ${formatCurrency(apt.gastosComunes)}\nFondo Reserva: ${formatCurrency(apt.fondoReserva)}\nTotal Mensual: ${formatCurrency(totalMensual)}`
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleShareWhatsAppGrupo = (grupo: ApartamentoAgrupado, tipo: 'propietario' | 'inquilino') => {
    const apt = tipo === 'propietario' ? grupo.propietario : grupo.inquilino
    if (!apt) return
    const totalMensual = apt.gastosComunes + apt.fondoReserva
    const contacto = apt.contactoNombre ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim() : 'Sin contacto'
    const tipoLabel = tipo === 'propietario' ? 'Propietario' : 'Inquilino'
    const message = `Apartamento ${grupo.numero} - ${tipoLabel}\nPiso: ${grupo.piso || 'N/A'}\nContacto: ${contacto}\nGastos Comunes: ${formatCurrency(apt.gastosComunes)}\nFondo Reserva: ${formatCurrency(apt.fondoReserva)}\nTotal Mensual: ${formatCurrency(totalMensual)}`
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleExport = () => {
    const headers = ["Número", "Piso", "Tipo", "Contacto", "Gastos Comunes", "Fondo Reserva", "Total Mensual"]
    const rows = apartamentos.map((apt) => [
      apt.numero,
      apt.piso?.toString() || "",
      tipoOcupacionLabels[apt.tipoOcupacion],
      apt.contactoNombre ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim() : "",
      apt.gastosComunes.toString(),
      apt.fondoReserva.toString(),
      (apt.gastosComunes + apt.fondoReserva).toString(),
    ])

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "apartamentos.csv"
    a.click()
  }

  const handleGenerarTransacciones = async () => {
    setIsGenerating(true)
    setError(null)
    setIsGenerateDialogOpen(false)

    try {
      const result = await generarTransaccionesMensuales()
      if (result.success) {
        // Guardar datos y mostrar modal de éxito
        setSuccessData(result.data)
        setIsSuccessDialogOpen(true)

        // Actualizar saldos después de generar transacciones
        const { obtenerSaldosCuentaCorriente } = await import("./actions")
        const saldosResult = await obtenerSaldosCuentaCorriente()
        if (saldosResult.success) {
          setSaldos(saldosResult.data)
        }

        // Refrescar la página para que transacciones se actualice
        router.refresh()
      } else {
        setError(result.error || "Error desconocido")
      }
    } catch (err) {
      console.error("Error generando transacciones:", err)
      setError(`Error inesperado: ${err instanceof Error ? err.message : "desconocido"}`)
    } finally {
      setIsGenerating(false)
    }
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
          <AlertDialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isGenerating}
                className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:text-green-800"
              >
                <Receipt className="h-4 w-4 mr-2" />
                {isGenerating ? "Generando..." : "Generar Transacciones"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generar Transacciones del Mes</AlertDialogTitle>
                <AlertDialogDescription>
                  Se generarán cargos de Gastos Comunes y Fondo de Reserva para todos los apartamentos que tengan montos configurados.
                  <br /><br />
                  <strong>Apartamentos con montos:</strong> {apartamentos.filter(a => a.gastosComunes > 0 || a.fondoReserva > 0).length} de {apartamentos.length}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <Button
                  onClick={handleGenerarTransacciones}
                  disabled={isGenerating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isGenerating ? "Generando..." : "Generar Transacciones"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Apartamento
          </Button>
        </div>
      </div>

      {/* Mensaje de error */}
      {error && !isDialogOpen && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Apartments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredApartamentos.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No hay apartamentos registrados</p>
          </div>
        ) : (
          filteredApartamentos.map((grupo) => {
            const tieneAmbos = grupo.propietario && grupo.inquilino
            const aptPrincipal = grupo.propietario || grupo.inquilino!

            return (
              <Card key={grupo.numero} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">Apto {grupo.numero}</h3>
                          {tieneAmbos ? (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                              P/I
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              {tipoOcupacionBadge[aptPrincipal.tipoOcupacion]}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">Piso {grupo.piso || 'N/A'}</p>
                      </div>
                    </div>
                    {tieneAmbos ? (
                      <Badge variant="info">P / I</Badge>
                    ) : (
                      <Badge variant={tipoOcupacionColors[aptPrincipal.tipoOcupacion]}>
                        {tipoOcupacionLabels[aptPrincipal.tipoOcupacion]}
                      </Badge>
                    )}
                  </div>

                  {/* Sección Propietario */}
                  {grupo.propietario && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-blue-700">PROPIETARIO</p>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                            onClick={() => handleGeneratePropietarioPDF(grupo)}
                            title="PDF Propietario"
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                            onClick={() => handleShareWhatsAppGrupo(grupo, 'propietario')}
                            title="WhatsApp Propietario"
                          >
                            <Share2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => openEditDialog(grupo.propietario!)}
                            title="Editar Propietario"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                            onClick={() => openDeleteDialog(grupo.propietario!)}
                            title="Eliminar Propietario"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {grupo.propietario.contactoNombre ? (
                        <p className="font-medium text-slate-900 text-sm">
                          {grupo.propietario.contactoNombre} {grupo.propietario.contactoApellido || ''}
                          {grupo.propietario.contactoCelular && (
                            <span className="text-slate-500 font-normal"> · {grupo.propietario.contactoCelular}</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400">Sin contacto</p>
                      )}
                      {/* Gastos del Propietario */}
                      <div className="mt-2 pt-2 border-t border-blue-200 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-500">G. Comunes</p>
                          <p className="font-semibold text-slate-800">{formatCurrency(grupo.propietario.gastosComunes)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">F. Reserva</p>
                          <p className="font-semibold text-slate-800">{formatCurrency(grupo.propietario.fondoReserva)}</p>
                        </div>
                        <div>
                          <p className="text-blue-600 font-medium">Total</p>
                          <p className="font-bold text-blue-700">{formatCurrency(grupo.propietario.gastosComunes + grupo.propietario.fondoReserva)}</p>
                        </div>
                      </div>
                      {/* Cuenta Corriente Propietario */}
                      <div className="mt-2 pt-2 border-t border-blue-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Wallet className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-xs text-slate-600 font-medium">Cuenta Corriente</span>
                        </div>
                        <span className={`text-sm font-bold ${(saldos[grupo.propietario.id] || 0) > 0 ? 'text-red-600' : (saldos[grupo.propietario.id] || 0) < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                          {(saldos[grupo.propietario.id] || 0) > 0 ? 'Debe: ' : (saldos[grupo.propietario.id] || 0) < 0 ? 'A favor: ' : ''}
                          {formatCurrency(Math.abs(saldos[grupo.propietario.id] || 0))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sección Inquilino */}
                  {grupo.inquilino && (
                    <div className="mb-3 p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-purple-700">INQUILINO</p>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                            onClick={() => handleGenerateInquilinoPDF(grupo)}
                            title="PDF Inquilino"
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                            onClick={() => handleShareWhatsAppGrupo(grupo, 'inquilino')}
                            title="WhatsApp Inquilino"
                          >
                            <Share2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => openEditDialog(grupo.inquilino!)}
                            title="Editar Inquilino"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                            onClick={() => openDeleteDialog(grupo.inquilino!)}
                            title="Eliminar Inquilino"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {grupo.inquilino.contactoNombre ? (
                        <p className="font-medium text-slate-900 text-sm">
                          {grupo.inquilino.contactoNombre} {grupo.inquilino.contactoApellido || ''}
                          {grupo.inquilino.contactoCelular && (
                            <span className="text-slate-500 font-normal"> · {grupo.inquilino.contactoCelular}</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400">Sin contacto</p>
                      )}
                      {/* Gastos del Inquilino */}
                      <div className="mt-2 pt-2 border-t border-purple-200 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-500">G. Comunes</p>
                          <p className="font-semibold text-slate-800">{formatCurrency(grupo.inquilino.gastosComunes)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">F. Reserva</p>
                          <p className="font-semibold text-slate-800">{formatCurrency(grupo.inquilino.fondoReserva)}</p>
                        </div>
                        <div>
                          <p className="text-purple-600 font-medium">Total</p>
                          <p className="font-bold text-purple-700">{formatCurrency(grupo.inquilino.gastosComunes + grupo.inquilino.fondoReserva)}</p>
                        </div>
                      </div>
                      {/* Cuenta Corriente Inquilino */}
                      <div className="mt-2 pt-2 border-t border-purple-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Wallet className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-xs text-slate-600 font-medium">Cuenta Corriente</span>
                        </div>
                        <span className={`text-sm font-bold ${(saldos[grupo.inquilino.id] || 0) > 0 ? 'text-red-600' : (saldos[grupo.inquilino.id] || 0) < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                          {(saldos[grupo.inquilino.id] || 0) > 0 ? 'Debe: ' : (saldos[grupo.inquilino.id] || 0) < 0 ? 'A favor: ' : ''}
                          {formatCurrency(Math.abs(saldos[grupo.inquilino.id] || 0))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Botón para agregar el tipo faltante */}
                  {!tieneAmbos && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mb-3 border-dashed"
                      onClick={() => {
                        const tipoFaltante = grupo.propietario ? "INQUILINO" : "PROPIETARIO"
                        setFormData({
                          numero: grupo.numero,
                          piso: grupo.piso?.toString() || "",
                          tipoOcupacion: tipoFaltante,
                          gastosComunes: "0",
                          fondoReserva: "0",
                          contactoNombre: "",
                          contactoApellido: "",
                          contactoCelular: "",
                          contactoEmail: "",
                          notas: "",
                        })
                        setSelectedApartamento(null)
                        setError(null)
                        setIsDialogOpen(true)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar {grupo.propietario ? "Inquilino" : "Propietario"}
                    </Button>
                  )}

                  {/* Botón PDF Completo (cuando hay ambos) */}
                  {tieneAmbos && (
                    <div className="border-t pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleGenerateCompletoPDF(grupo)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF Completo (Propietario + Inquilino)
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
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
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Número y Piso */}
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

            {/* Tipo de Ocupación */}
            <div className="space-y-2">
              <Label htmlFor="tipoOcupacion">Tipo de Registro *</Label>
              <Select
                value={formData.tipoOcupacion}
                onValueChange={(value) => setFormData({ ...formData, tipoOcupacion: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROPIETARIO">Propietario (P)</SelectItem>
                  <SelectItem value="INQUILINO">Inquilino (I)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Puedes crear un registro de Propietario y otro de Inquilino para el mismo apartamento
              </p>
            </div>

            {/* Gastos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gastosComunes">Gastos Comunes</Label>
                <Input
                  id="gastosComunes"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.gastosComunes}
                  onChange={(e) => setFormData({ ...formData, gastosComunes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fondoReserva">Fondo de Reserva</Label>
                <Input
                  id="fondoReserva"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.fondoReserva}
                  onChange={(e) => setFormData({ ...formData, fondoReserva: e.target.value })}
                />
              </div>
            </div>

            {/* Contacto */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-slate-700 mb-3">
                Contacto ({tipoOcupacionLabels[formData.tipoOcupacion as keyof typeof tipoOcupacionLabels]})
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactoNombre">Nombre</Label>
                  <Input
                    id="contactoNombre"
                    placeholder="Nombre"
                    value={formData.contactoNombre}
                    onChange={(e) => setFormData({ ...formData, contactoNombre: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactoApellido">Apellido</Label>
                  <Input
                    id="contactoApellido"
                    placeholder="Apellido"
                    value={formData.contactoApellido}
                    onChange={(e) => setFormData({ ...formData, contactoApellido: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="contactoCelular">Celular</Label>
                  <Input
                    id="contactoCelular"
                    placeholder="Ej: 3001234567"
                    value={formData.contactoCelular}
                    onChange={(e) => setFormData({ ...formData, contactoCelular: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactoEmail">Email</Label>
                  <Input
                    id="contactoEmail"
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={formData.contactoEmail}
                    onChange={(e) => setFormData({ ...formData, contactoEmail: e.target.value })}
                  />
                </div>
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

      {/* Success Dialog - Modal de éxito */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-6 w-6" />
              Transacciones Generadas
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-center text-2xl font-bold text-green-700">
                {successData?.creadas || 0}
              </p>
              <p className="text-center text-sm text-green-600">
                transacciones creadas
              </p>
            </div>
            <p className="text-slate-600 text-center">
              Se han generado los cargos de <strong>Gastos Comunes</strong> y <strong>Fondo de Reserva</strong> para <strong>{successData?.mes}</strong>.
            </p>
            <p className="text-slate-500 text-sm text-center mt-2">
              Las transacciones ya están disponibles en la sección de Transacciones.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsSuccessDialogOpen(false)}
            >
              Cerrar
            </Button>
            <Button
              onClick={() => {
                setIsSuccessDialogOpen(false)
                router.push("/transacciones")
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Ver Transacciones
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
