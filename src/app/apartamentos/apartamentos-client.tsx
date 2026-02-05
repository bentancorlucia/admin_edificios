"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
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
import { Building2, Plus, Search, Download, FileText, Share2, Edit, Trash2, AlertCircle, Receipt, Wallet, CheckCircle2, Mail } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency, formatPhoneForWhatsApp } from "@/lib/utils"
import {
  createApartamento,
  updateApartamento,
  deleteApartamento,
  generarTransaccionesMensuales,
  obtenerSaldosCuentaCorriente,
  getTransaccionesByApartamento,
  type Transaccion,
} from "@/lib/database"
import {
  generateApartamentoPDF,
  generatePropietarioPDF,
  generateInquilinoPDF,
} from "@/lib/pdf"
import { toast } from "@/hooks/use-toast"

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

  // Memoizar agrupación y filtrado para evitar re-cálculos innecesarios
  const apartamentosAgrupados = useMemo(
    () => agruparApartamentos(apartamentos),
    [apartamentos]
  )

  const filteredApartamentos = useMemo(
    () => apartamentosAgrupados.filter((grupo) =>
      grupo.numero.toLowerCase().includes(search.toLowerCase())
    ),
    [apartamentosAgrupados, search]
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
        setApartamentos((prev) =>
          prev.map((apt) => (apt.id === result.id ? result : apt))
        )
      } else {
        const result = await createApartamento(data)
        setApartamentos((prev) => [...prev, result])
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
      await deleteApartamento(selectedApartamento.id)
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

  // Memoizar handlers para evitar re-creación en cada render
  const handleGeneratePDF = useCallback((apt: Apartamento) => {
    generateApartamentoPDF(apt)
    toast({
      title: "PDF descargado",
      description: `Reporte del apartamento ${apt.numero} descargado correctamente`,
      variant: "success",
    })
  }, [])

  const handleGeneratePropietarioPDF = useCallback(async (grupo: ApartamentoAgrupado) => {
    if (!grupo.propietario) return
    try {
      const transacciones = await getTransaccionesByApartamento(grupo.propietario.id)
      generatePropietarioPDF(grupo, saldos, transacciones)
      toast({
        title: "PDF descargado",
        description: `Reporte de propietario del Apto ${grupo.numero} descargado correctamente`,
        variant: "success",
      })
    } catch (error) {
      console.error("Error al generar PDF:", error)
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      })
    }
  }, [saldos])

  const handleGenerateInquilinoPDF = useCallback(async (grupo: ApartamentoAgrupado) => {
    if (!grupo.inquilino) return
    try {
      const transacciones = await getTransaccionesByApartamento(grupo.inquilino.id)
      generateInquilinoPDF(grupo, saldos, transacciones)
      toast({
        title: "PDF descargado",
        description: `Reporte de inquilino del Apto ${grupo.numero} descargado correctamente`,
        variant: "success",
      })
    } catch (error) {
      console.error("Error al generar PDF:", error)
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      })
    }
  }, [saldos])

  const handleShareWhatsApp = useCallback(async (apt: Apartamento) => {
    const totalMensual = apt.gastosComunes + apt.fondoReserva
    const contacto = apt.contactoNombre ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim() : 'Sin contacto'
    const message = `Apartamento ${apt.numero}\nPiso: ${apt.piso || 'N/A'}\nTipo: ${tipoOcupacionLabels[apt.tipoOcupacion]}\nContacto: ${contacto}\nGastos Comunes: ${formatCurrency(apt.gastosComunes)}\nFondo Reserva: ${formatCurrency(apt.fondoReserva)}\nTotal Mensual: ${formatCurrency(totalMensual)}`
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`
    await open(url)
  }, [])

  const handleShareWhatsAppGrupo = useCallback(async (grupo: ApartamentoAgrupado, tipo: 'propietario' | 'inquilino') => {
    const apt = tipo === 'propietario' ? grupo.propietario : grupo.inquilino
    if (!apt) return
    if (!apt.contactoCelular) return
    const totalMensual = apt.gastosComunes + apt.fondoReserva
    const contacto = apt.contactoNombre ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim() : 'Sin contacto'
    const tipoLabel = tipo === 'propietario' ? 'Propietario' : 'Inquilino'
    const message = `Hola ${contacto},\n\nLe escribo desde la administración del edificio respecto al Apartamento ${grupo.numero}.\n\n${tipoLabel}\nPiso: ${grupo.piso || 'N/A'}\nGastos Comunes: ${formatCurrency(apt.gastosComunes)}\nFondo Reserva: ${formatCurrency(apt.fondoReserva)}\nTotal Mensual: ${formatCurrency(totalMensual)}`
    const url = `https://wa.me/${formatPhoneForWhatsApp(apt.contactoCelular)}?text=${encodeURIComponent(message)}`
    await open(url)
  }, [])

  const handleSendGmailGrupo = useCallback(async (grupo: ApartamentoAgrupado, tipo: 'propietario' | 'inquilino') => {
    const apt = tipo === 'propietario' ? grupo.propietario : grupo.inquilino
    if (!apt) return
    if (!apt.contactoEmail) return
    const totalMensual = apt.gastosComunes + apt.fondoReserva
    const contacto = apt.contactoNombre ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim() : ''
    const tipoLabel = tipo === 'propietario' ? 'Propietario' : 'Inquilino'
    const subject = `Administración del Edificio - Apartamento ${grupo.numero}`
    const body = `Estimado/a ${contacto},\n\nLe escribo desde la administración del edificio respecto al Apartamento ${grupo.numero}.\n\n${tipoLabel}\nPiso: ${grupo.piso || 'N/A'}\nGastos Comunes: ${formatCurrency(apt.gastosComunes)}\nFondo Reserva: ${formatCurrency(apt.fondoReserva)}\nTotal Mensual: ${formatCurrency(totalMensual)}\n\nSaludos cordiales.`
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(apt.contactoEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    await open(url)
  }, [])

  const handleExport = useCallback(() => {
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
    toast({
      title: "CSV descargado",
      description: "Lista de apartamentos exportada correctamente",
      variant: "success",
    })
  }, [apartamentos])

  const handleGenerarTransacciones = async () => {
    setIsGenerating(true)
    setError(null)
    setIsGenerateDialogOpen(false)

    try {
      const result = await generarTransaccionesMensuales()
      // Guardar datos y mostrar modal de éxito
      setSuccessData(result)
      setIsSuccessDialogOpen(true)

      // Actualizar saldos después de generar transacciones
      const saldosData = await obtenerSaldosCuentaCorriente()
      setSaldos(saldosData)
    } catch (err) {
      console.error("Error generando transacciones:", err)
      setError(`${err instanceof Error ? err.message : "Error desconocido"}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-8 px-4 md:px-8 lg:px-12 py-6">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6bTEwIDEwdjZoNnYtNmgtNnptMC0xMHY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Apartamentos</h1>
                <p className="text-blue-100 text-sm">
                  Gestión de unidades, propietarios e inquilinos
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={handleExport}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <AlertDialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="secondary"
                  disabled={isGenerating}
                  className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
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
            <Button
              onClick={openCreateDialog}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Apartamento
            </Button>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar apartamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
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
              <Card key={grupo.numero} className="group hover:shadow-md transition-all duration-200 border-slate-200 hover:border-slate-300">
                <CardContent className="p-4">
                  {/* Header compacto */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                        <span className="text-white font-bold text-sm">{grupo.numero}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">Apto {grupo.numero}</h3>
                        <p className="text-xs text-slate-500">Piso {grupo.piso || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {grupo.propietario && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">P</span>
                      )}
                      {grupo.inquilino && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">I</span>
                      )}
                    </div>
                  </div>

                  {/* Sección Propietario */}
                  {grupo.propietario && (
                    <div className="mb-3 p-3 bg-blue-50/70 rounded-lg border border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Propietario</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100" onClick={() => handleGeneratePropietarioPDF(grupo)} title="PDF">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          {grupo.propietario?.contactoCelular && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600 hover:bg-green-100" onClick={() => handleShareWhatsAppGrupo(grupo, 'propietario')} title="WhatsApp">
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {grupo.propietario?.contactoEmail && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:bg-red-100" onClick={() => handleSendGmailGrupo(grupo, 'propietario')} title="Gmail">
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-600 hover:bg-slate-100" onClick={() => openEditDialog(grupo.propietario!)} title="Editar">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:bg-red-100" onClick={() => openDeleteDialog(grupo.propietario!)} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="font-medium text-slate-800 text-sm truncate">
                        {grupo.propietario.contactoNombre
                          ? `${grupo.propietario.contactoNombre} ${grupo.propietario.contactoApellido || ''}`.trim()
                          : <span className="text-slate-400 italic">Sin contacto</span>
                        }
                      </p>
                      {grupo.propietario.contactoCelular && (
                        <p className="text-xs text-slate-500 mt-0.5">{grupo.propietario.contactoCelular}</p>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-200/50">
                        <div className="flex gap-3 text-xs">
                          <span className="text-slate-500">GC: <span className="font-medium text-slate-700">{formatCurrency(grupo.propietario.gastosComunes)}</span></span>
                          <span className="text-slate-500">FR: <span className="font-medium text-slate-700">{formatCurrency(grupo.propietario.fondoReserva)}</span></span>
                        </div>
                        <span className="text-xs font-bold text-blue-700">{formatCurrency(grupo.propietario.gastosComunes + grupo.propietario.fondoReserva)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-200/50">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Wallet className="h-3 w-3" /> Saldo
                        </span>
                        <span className={`text-xs font-bold ${(saldos[grupo.propietario.id] || 0) > 0 ? 'text-red-600' : (saldos[grupo.propietario.id] || 0) < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                          {(saldos[grupo.propietario.id] || 0) > 0 ? '-' : (saldos[grupo.propietario.id] || 0) < 0 ? '+' : ''}
                          {formatCurrency(Math.abs(saldos[grupo.propietario.id] || 0))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sección Inquilino */}
                  {grupo.inquilino && (
                    <div className="mb-3 p-3 bg-purple-50/70 rounded-lg border border-purple-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wide">Inquilino</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-purple-600 hover:bg-purple-100" onClick={() => handleGenerateInquilinoPDF(grupo)} title="PDF">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          {grupo.inquilino?.contactoCelular && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600 hover:bg-green-100" onClick={() => handleShareWhatsAppGrupo(grupo, 'inquilino')} title="WhatsApp">
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {grupo.inquilino?.contactoEmail && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:bg-red-100" onClick={() => handleSendGmailGrupo(grupo, 'inquilino')} title="Gmail">
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-600 hover:bg-slate-100" onClick={() => openEditDialog(grupo.inquilino!)} title="Editar">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:bg-red-100" onClick={() => openDeleteDialog(grupo.inquilino!)} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="font-medium text-slate-800 text-sm truncate">
                        {grupo.inquilino.contactoNombre
                          ? `${grupo.inquilino.contactoNombre} ${grupo.inquilino.contactoApellido || ''}`.trim()
                          : <span className="text-slate-400 italic">Sin contacto</span>
                        }
                      </p>
                      {grupo.inquilino.contactoCelular && (
                        <p className="text-xs text-slate-500 mt-0.5">{grupo.inquilino.contactoCelular}</p>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-200/50">
                        <div className="flex gap-3 text-xs">
                          <span className="text-slate-500">GC: <span className="font-medium text-slate-700">{formatCurrency(grupo.inquilino.gastosComunes)}</span></span>
                          <span className="text-slate-500">FR: <span className="font-medium text-slate-700">{formatCurrency(grupo.inquilino.fondoReserva)}</span></span>
                        </div>
                        <span className="text-xs font-bold text-purple-700">{formatCurrency(grupo.inquilino.gastosComunes + grupo.inquilino.fondoReserva)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-200/50">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Wallet className="h-3 w-3" /> Saldo
                        </span>
                        <span className={`text-xs font-bold ${(saldos[grupo.inquilino.id] || 0) > 0 ? 'text-red-600' : (saldos[grupo.inquilino.id] || 0) < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                          {(saldos[grupo.inquilino.id] || 0) > 0 ? '-' : (saldos[grupo.inquilino.id] || 0) < 0 ? '+' : ''}
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
                      className="w-full border-dashed text-xs h-8"
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
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar {grupo.propietario ? "Inquilino" : "Propietario"}
                    </Button>
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
