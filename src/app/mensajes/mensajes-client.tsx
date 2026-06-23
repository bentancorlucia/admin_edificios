"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { BackToHome } from "@/components/back-to-home"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  MessageSquare,
  Mail,
  Send,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckSquare,
  Square,
  Eye,
  History,
  Save,
  Phone,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
} from "lucide-react"
import {
  type Destinatario,
  type PlantillaMensaje,
  type ContactoLibre,
  type HistorialMensaje,
  createContactoLibre,
  updateContactoLibre,
  deleteContactoLibre,
  createPlantilla,
  updatePlantilla,
  deletePlantilla,
  createHistorialMensaje,
  getDestinatariosMensajes,
  getPlantillas,
  getContactosLibres,
  getHistorialMensajes,
} from "@/lib/database"
import {
  VARIABLES_DISPONIBLES,
  resolveVariables,
  buildVariablesForDestinatario,
  sendWhatsApp,
  sendEmail,
  sendWhatsAppGeneric,
} from "@/lib/mensajes"
import { formatCurrency, formatDate } from "@/lib/utils"

type CanalEnvio = 'WHATSAPP' | 'EMAIL' | 'AMBOS'
type EstadoEnvio = 'PENDIENTE' | 'ENVIADO' | 'ERROR'

interface DestinatarioEnCola {
  destinatario: Destinatario
  canal: CanalEnvio
  mensajeResuelto: string
  asuntoResuelto: string
  estadoWA: EstadoEnvio
  estadoEmail: EstadoEnvio
}

interface MensajesClientProps {
  initialDestinatarios: Destinatario[]
  initialPlantillas: PlantillaMensaje[]
  initialContactosLibres: ContactoLibre[]
  initialHistorial: HistorialMensaje[]
  contexto: string | null
  contextoId: string | null
  contextoMes: string | null
  contextoAnio: string | null
}

export function MensajesClient({
  initialDestinatarios,
  initialPlantillas,
  initialContactosLibres,
  initialHistorial,
  contexto,
  contextoId,
  contextoMes,
  contextoAnio,
}: MensajesClientProps) {
  const { toast } = useToast()

  // Data state
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>(initialDestinatarios)
  const [plantillas, setPlantillas] = useState<PlantillaMensaje[]>(initialPlantillas)
  const [contactosLibres, setContactosLibres] = useState<ContactoLibre[]>(initialContactosLibres)
  const [historial, setHistorial] = useState<HistorialMensaje[]>(initialHistorial)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS")
  const [filtroPiso, setFiltroPiso] = useState<string>("TODOS")
  const [filtroDeudores, setFiltroDeudores] = useState(false)

  // Composer state
  const [asunto, setAsunto] = useState("")
  const [cuerpoMensaje, setCuerpoMensaje] = useState("")
  const [canalEnvio, setCanalEnvio] = useState<CanalEnvio>("AMBOS")
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>("")
  const [vistaPrevia, setVistaPrevia] = useState(false)

  // Queue state
  const [colaEnvio, setColaEnvio] = useState<DestinatarioEnCola[]>([])
  const [enviando, setEnviando] = useState(false)
  const [progresoEnvio, setProgresoEnvio] = useState(0)

  // Dialog states
  const [showPlantillaDialog, setShowPlantillaDialog] = useState(false)
  const [showContactoDialog, setShowContactoDialog] = useState(false)
  const [showHistorialDialog, setShowHistorialDialog] = useState(false)
  const [showGuardarPlantillaDialog, setShowGuardarPlantillaDialog] = useState(false)
  const [editingPlantilla, setEditingPlantilla] = useState<PlantillaMensaje | null>(null)
  const [editingContacto, setEditingContacto] = useState<ContactoLibre | null>(null)

  // Form states
  const [plantillaForm, setPlantillaForm] = useState({ nombre: '', asunto: '', cuerpo: '', canal: 'AMBOS' as CanalEnvio, prioridad: 0 })
  const [contactoForm, setContactoForm] = useState({ nombre: '', apellido: '', celular: '', email: '', notas: '' })
  const [guardarPlantillaNombre, setGuardarPlantillaNombre] = useState("")

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Pisos disponibles
  const pisosDisponibles = Array.from(new Set(destinatarios
    .filter(d => d.apartamentoPiso !== undefined && d.apartamentoPiso !== null)
    .map(d => d.apartamentoPiso!)
  )).sort((a, b) => a - b)

  // Filtrar destinatarios
  const destinatariosFiltrados = destinatarios.filter(d => {
    // Filtro por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchName = d.nombre.toLowerCase().includes(term)
      const matchApellido = d.apellido?.toLowerCase().includes(term)
      const matchApto = d.apartamentoNumero?.toLowerCase().includes(term)
      if (!matchName && !matchApellido && !matchApto) return false
    }

    // Filtro por tipo
    if (filtroTipo !== 'TODOS' && d.tipo !== filtroTipo) return false

    // Filtro por piso
    if (filtroPiso !== 'TODOS' && d.apartamentoPiso?.toString() !== filtroPiso) return false

    // Filtro por deudores
    if (filtroDeudores && (d.saldo === undefined || d.saldo <= 0)) return false

    return true
  })

  // Aplicar contexto externo
  useEffect(() => {
    if (contexto === 'informe') {
      // Pre-seleccionar todos los propietarios
      const propietarios = destinatarios.filter(d => d.tipo === 'PROPIETARIO')
      setSelectedIds(new Set(propietarios.map(d => d.id)))
      const mesNum = contextoMes ? parseInt(contextoMes) : new Date().getMonth() + 1
      const anioNum = contextoAnio ? parseInt(contextoAnio) : new Date().getFullYear()
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
      setAsunto(`Informe mensual - ${meses[mesNum - 1]} ${anioNum}`)
      setCuerpoMensaje(`Estimado/a {nombre},\n\nSe adjunta el informe mensual correspondiente a ${meses[mesNum - 1]} ${anioNum} del Apartamento {apartamento}.\n\nSaldo actual: {saldo}\n\nSaludos cordiales.`)
    } else if (contexto === 'proyecto') {
      const propietarios = destinatarios.filter(d => d.tipo === 'PROPIETARIO')
      setSelectedIds(new Set(propietarios.map(d => d.id)))
      setCuerpoMensaje('Estimado/a {nombre},\n\nLe informamos sobre novedades del proyecto en curso.\n\nSaludos cordiales.')
      setAsunto('Actualización de Proyecto - Edificio')
    } else if (contexto === 'banco') {
      const propietarios = destinatarios.filter(d => d.tipo === 'PROPIETARIO')
      setSelectedIds(new Set(propietarios.map(d => d.id)))
      setCuerpoMensaje('Estimado/a {nombre},\n\nLe informamos sobre un movimiento bancario del edificio.\n\nSaludos cordiales.')
      setAsunto('Movimiento Bancario - Edificio')
    }
  }, [contexto, contextoId, contextoMes, contextoAnio, destinatarios])

  // Toggle selección individual
  const toggleDestinatario = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Seleccionar/deseleccionar todos los filtrados
  const toggleTodos = () => {
    const allFilteredIds = destinatariosFiltrados.map(d => d.id)
    const allSelected = allFilteredIds.every(id => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  // Insertar variable en textarea
  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = cuerpoMensaje
      const newText = text.substring(0, start) + variable + text.substring(end)
      setCuerpoMensaje(newText)
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length, start + variable.length)
      }, 0)
    } else {
      setCuerpoMensaje(prev => prev + variable)
    }
  }

  // Cargar plantilla
  const cargarPlantilla = (plantillaId: string) => {
    setPlantillaSeleccionada(plantillaId)
    const plantilla = plantillas.find(p => p.id === plantillaId)
    if (plantilla) {
      setCuerpoMensaje(plantilla.cuerpo)
      setAsunto(plantilla.asunto || '')
      if (plantilla.canal !== 'AMBOS') {
        setCanalEnvio(plantilla.canal)
      }
    }
  }

  // Preparar cola de envío
  const prepararCola = () => {
    if (selectedIds.size === 0) {
      toast({ title: "Sin destinatarios", description: "Seleccione al menos un destinatario", variant: "destructive" })
      return
    }
    if (!cuerpoMensaje.trim()) {
      toast({ title: "Sin mensaje", description: "Escriba un mensaje para enviar", variant: "destructive" })
      return
    }

    const cola: DestinatarioEnCola[] = []
    const idsArray = Array.from(selectedIds)
    for (const id of idsArray) {
      const dest = destinatarios.find(d => d.id === id)
      if (!dest) continue

      const variables = buildVariablesForDestinatario(dest)
      const mensajeResuelto = resolveVariables(cuerpoMensaje, variables)
      const asuntoResuelto = resolveVariables(asunto, variables)

      // Determinar canal para este destinatario
      let canal = canalEnvio
      if (canal === 'AMBOS') {
        // Si no tiene celular ni email, no enviamos
        if (!dest.celular && !dest.email) continue
      } else if (canal === 'WHATSAPP' && !dest.celular) {
        // Si solo WA pero no tiene celular, skip o solo email
        if (dest.email) canal = 'EMAIL'
        else continue
      } else if (canal === 'EMAIL' && !dest.email) {
        if (dest.celular) canal = 'WHATSAPP'
        else continue
      }

      cola.push({
        destinatario: dest,
        canal,
        mensajeResuelto,
        asuntoResuelto,
        estadoWA: (canal === 'WHATSAPP' || canal === 'AMBOS') && dest.celular ? 'PENDIENTE' : 'ENVIADO',
        estadoEmail: (canal === 'EMAIL' || canal === 'AMBOS') && dest.email ? 'PENDIENTE' : 'ENVIADO',
      })
    }

    if (cola.length === 0) {
      toast({ title: "Sin destinatarios válidos", description: "Los destinatarios seleccionados no tienen datos de contacto para el canal elegido", variant: "destructive" })
      return
    }

    setColaEnvio(cola)
  }

  // Enviar individual
  const enviarIndividual = async (index: number, canal: 'WHATSAPP' | 'EMAIL') => {
    const item = colaEnvio[index]
    if (!item) return

    try {
      if (canal === 'WHATSAPP' && item.destinatario.celular) {
        await sendWhatsApp(item.destinatario.celular, item.mensajeResuelto)
        setColaEnvio(prev => prev.map((c, i) => i === index ? { ...c, estadoWA: 'ENVIADO' } : c))
        await registrarEnvio(item, 'WHATSAPP', 'ENVIADO')
      } else if (canal === 'EMAIL' && item.destinatario.email) {
        await sendEmail(item.destinatario.email, item.asuntoResuelto, item.mensajeResuelto)
        setColaEnvio(prev => prev.map((c, i) => i === index ? { ...c, estadoEmail: 'ENVIADO' } : c))
        await registrarEnvio(item, 'EMAIL', 'ENVIADO')
      }
    } catch (error) {
      console.error('Error enviando:', error)
      if (canal === 'WHATSAPP') {
        setColaEnvio(prev => prev.map((c, i) => i === index ? { ...c, estadoWA: 'ERROR' } : c))
        await registrarEnvio(item, 'WHATSAPP', 'ERROR')
      } else {
        setColaEnvio(prev => prev.map((c, i) => i === index ? { ...c, estadoEmail: 'ERROR' } : c))
        await registrarEnvio(item, 'EMAIL', 'ERROR')
      }
    }
  }

  // Enviar todos
  const enviarTodos = async () => {
    setEnviando(true)
    setProgresoEnvio(0)

    const totalOperaciones = colaEnvio.reduce((acc, item) => {
      let ops = 0
      if (item.estadoWA === 'PENDIENTE') ops++
      if (item.estadoEmail === 'PENDIENTE') ops++
      return acc + ops
    }, 0)

    let completadas = 0

    for (let i = 0; i < colaEnvio.length; i++) {
      const item = colaEnvio[i]

      if (item.estadoWA === 'PENDIENTE' && item.destinatario.celular) {
        await enviarIndividual(i, 'WHATSAPP')
        completadas++
        setProgresoEnvio(Math.round((completadas / totalOperaciones) * 100))
        // Delay entre envíos para no saturar
        await new Promise(resolve => setTimeout(resolve, 800))
      }

      if (item.estadoEmail === 'PENDIENTE' && item.destinatario.email) {
        await enviarIndividual(i, 'EMAIL')
        completadas++
        setProgresoEnvio(Math.round((completadas / totalOperaciones) * 100))
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    setEnviando(false)
    toast({ title: "Envío completado", description: `Se procesaron ${completadas} mensajes` })

    // Recargar historial
    const nuevoHistorial = await getHistorialMensajes()
    setHistorial(nuevoHistorial)
  }

  // Registrar en historial
  const registrarEnvio = async (item: DestinatarioEnCola, canal: 'WHATSAPP' | 'EMAIL', estado: EstadoEnvio) => {
    await createHistorialMensaje({
      destinatarioNombre: `${item.destinatario.nombre} ${item.destinatario.apellido || ''}`.trim(),
      destinatarioContacto: canal === 'WHATSAPP' ? item.destinatario.celular : item.destinatario.email,
      destinatarioTipo: item.destinatario.tipo,
      canal,
      asunto: item.asuntoResuelto || null,
      contenido: item.mensajeResuelto,
      estado,
      plantillaId: plantillaSeleccionada || null,
      apartamentoId: item.destinatario.apartamentoId || null,
      servicioId: item.destinatario.servicioId || null,
      contactoLibreId: item.destinatario.contactoLibreId || null,
    })
  }

  // CRUD Contacto Libre
  const handleSaveContacto = async () => {
    if (!contactoForm.nombre.trim()) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" })
      return
    }

    try {
      if (editingContacto) {
        await updateContactoLibre(editingContacto.id, {
          nombre: contactoForm.nombre,
          apellido: contactoForm.apellido || null,
          celular: contactoForm.celular || null,
          email: contactoForm.email || null,
          notas: contactoForm.notas || null,
        })
        toast({ title: "Contacto actualizado" })
      } else {
        await createContactoLibre({
          nombre: contactoForm.nombre,
          apellido: contactoForm.apellido || null,
          celular: contactoForm.celular || null,
          email: contactoForm.email || null,
          notas: contactoForm.notas || null,
        })
        toast({ title: "Contacto creado" })
      }

      // Recargar datos
      const [newDest, newContacts] = await Promise.all([
        getDestinatariosMensajes(),
        getContactosLibres(),
      ])
      setDestinatarios(newDest)
      setContactosLibres(newContacts)
      setShowContactoDialog(false)
      setEditingContacto(null)
      setContactoForm({ nombre: '', apellido: '', celular: '', email: '', notas: '' })
    } catch (error) {
      console.error('Error guardando contacto:', error)
      toast({ title: "Error", description: "No se pudo guardar el contacto", variant: "destructive" })
    }
  }

  const handleDeleteContacto = async (id: string) => {
    try {
      await deleteContactoLibre(id)
      const [newDest, newContacts] = await Promise.all([
        getDestinatariosMensajes(),
        getContactosLibres(),
      ])
      setDestinatarios(newDest)
      setContactosLibres(newContacts)
      toast({ title: "Contacto eliminado" })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" })
    }
  }

  // CRUD Plantilla
  const handleSavePlantilla = async () => {
    if (!plantillaForm.nombre.trim() || !plantillaForm.cuerpo.trim()) {
      toast({ title: "Error", description: "Nombre y cuerpo son obligatorios", variant: "destructive" })
      return
    }

    try {
      if (editingPlantilla) {
        await updatePlantilla(editingPlantilla.id, {
          nombre: plantillaForm.nombre,
          asunto: plantillaForm.asunto || null,
          cuerpo: plantillaForm.cuerpo,
          canal: plantillaForm.canal as CanalEnvio,
          prioridad: plantillaForm.prioridad,
        })
        toast({ title: "Plantilla actualizada" })
      } else {
        await createPlantilla({
          nombre: plantillaForm.nombre,
          asunto: plantillaForm.asunto || null,
          cuerpo: plantillaForm.cuerpo,
          canal: plantillaForm.canal as CanalEnvio,
          prioridad: plantillaForm.prioridad,
        })
        toast({ title: "Plantilla creada" })
      }

      const newPlantillas = await getPlantillas()
      setPlantillas(newPlantillas)
      setShowPlantillaDialog(false)
      setEditingPlantilla(null)
      setPlantillaForm({ nombre: '', asunto: '', cuerpo: '', canal: 'AMBOS', prioridad: 0 })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar la plantilla", variant: "destructive" })
    }
  }

  const handleDeletePlantilla = async (id: string) => {
    const result = await deletePlantilla(id)
    if (!result) {
      toast({ title: "Error", description: "No se puede eliminar una plantilla predefinida", variant: "destructive" })
      return
    }
    const newPlantillas = await getPlantillas()
    setPlantillas(newPlantillas)
    toast({ title: "Plantilla eliminada" })
  }

  // Guardar mensaje actual como plantilla
  const handleGuardarComoPlantilla = async () => {
    if (!guardarPlantillaNombre.trim()) {
      toast({ title: "Error", description: "Ingrese un nombre para la plantilla", variant: "destructive" })
      return
    }
    await createPlantilla({
      nombre: guardarPlantillaNombre,
      asunto: asunto || null,
      cuerpo: cuerpoMensaje,
      canal: canalEnvio,
      prioridad: 0,
    })
    const newPlantillas = await getPlantillas()
    setPlantillas(newPlantillas)
    setShowGuardarPlantillaDialog(false)
    setGuardarPlantillaNombre("")
    toast({ title: "Plantilla guardada" })
  }

  // Vista previa del primer seleccionado
  const primerSeleccionado = destinatarios.find(d => selectedIds.has(d.id))
  const variablesPreview = primerSeleccionado ? buildVariablesForDestinatario(primerSeleccionado) : {}
  const mensajePreview = vistaPrevia && primerSeleccionado ? resolveVariables(cuerpoMensaje, variablesPreview) : cuerpoMensaje
  const asuntoPreview = vistaPrevia && primerSeleccionado ? resolveVariables(asunto, variablesPreview) : asunto

  // Helper para ícono de tipo
  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'PROPIETARIO': return <Badge variant="default" className="text-xs">Propietario</Badge>
      case 'INQUILINO': return <Badge variant="secondary" className="text-xs">Inquilino</Badge>
      case 'SERVICIO': return <Badge variant="outline" className="text-xs">Servicio</Badge>
      case 'LIBRE': return <Badge className="text-xs bg-purple-600">Libre</Badge>
      default: return null
    }
  }

  const getEstadoIcon = (estado: EstadoEnvio) => {
    switch (estado) {
      case 'PENDIENTE': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'ENVIADO': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'ERROR': return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <BackToHome />
          <h1 className="text-2xl font-bold text-slate-900">Mensajes</h1>
          <p className="text-sm text-slate-500">Gestión centralizada de comunicaciones</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistorialDialog(true)}>
            <History className="h-4 w-4 mr-1" />
            Historial
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            setEditingPlantilla(null)
            setPlantillaForm({ nombre: '', asunto: '', cuerpo: '', canal: 'AMBOS', prioridad: 0 })
            setShowPlantillaDialog(true)
          }}>
            <Edit2 className="h-4 w-4 mr-1" />
            Gestionar Plantillas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Panel Izquierdo: Selección de destinatarios */}
        <div className="col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Destinatarios
                  <Badge variant="secondary" className="text-xs">{selectedIds.size}</Badge>
                </span>
                <Button size="sm" variant="ghost" onClick={() => {
                  setEditingContacto(null)
                  setContactoForm({ nombre: '', apellido: '', celular: '', email: '', notas: '' })
                  setShowContactoDialog(true)
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </CardTitle>

              {/* Búsqueda */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-slate-400" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>

              {/* Filtros */}
              <div className="flex gap-2">
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="PROPIETARIO">Propietarios</SelectItem>
                    <SelectItem value="INQUILINO">Inquilinos</SelectItem>
                    <SelectItem value="SERVICIO">Servicios</SelectItem>
                    <SelectItem value="LIBRE">Libres</SelectItem>
                  </SelectContent>
                </Select>

                {pisosDisponibles.length > 0 && (
                  <Select value={filtroPiso} onValueChange={setFiltroPiso}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Piso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos los pisos</SelectItem>
                      {pisosDisponibles.map(p => (
                        <SelectItem key={p} value={p.toString()}>Piso {p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={toggleTodos}>
                  {destinatariosFiltrados.every(d => selectedIds.has(d.id)) && destinatariosFiltrados.length > 0
                    ? <><Square className="h-3 w-3 mr-1" /> Deseleccionar</>
                    : <><CheckSquare className="h-3 w-3 mr-1" /> Seleccionar todos</>
                  }
                </Button>
                <Button
                  size="sm"
                  variant={filtroDeudores ? "default" : "outline"}
                  className="text-xs h-7"
                  onClick={() => setFiltroDeudores(!filtroDeudores)}
                >
                  Deudores
                </Button>
              </div>
            </CardHeader>

            <CardContent className="overflow-y-auto max-h-[calc(100vh-420px)] space-y-1 pt-0">
              {destinatariosFiltrados.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Sin resultados</p>
              ) : (
                destinatariosFiltrados.map(dest => (
                  <div
                    key={dest.id}
                    onClick={() => toggleDestinatario(dest.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-sm ${
                      selectedIds.has(dest.id)
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    {selectedIds.has(dest.id) ? (
                      <CheckSquare className="h-4 w-4 text-blue-600 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-300 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">
                          {dest.nombre} {dest.apellido || ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        {dest.apartamentoNumero && <span>Apto {dest.apartamentoNumero}</span>}
                        {dest.saldo !== undefined && dest.saldo > 0 && (
                          <span className="text-red-500 font-medium">{formatCurrency(dest.saldo)}</span>
                        )}
                        {getTipoBadge(dest.tipo)}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {dest.celular && <Phone className="h-3.5 w-3.5 text-green-500" />}
                      {dest.email && <Mail className="h-3.5 w-3.5 text-blue-500" />}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel Central: Compositor */}
        <div className="col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Compositor</CardTitle>

              {/* Selector de plantilla */}
              <div className="flex gap-2">
                <Select value={plantillaSeleccionada} onValueChange={cargarPlantilla}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccionar plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    {plantillas.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} {p.predefinida && '(predefinida)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (cuerpoMensaje.trim()) {
                      setShowGuardarPlantillaDialog(true)
                    } else {
                      toast({ title: "Sin contenido", description: "Escriba un mensaje primero" })
                    }
                  }}
                  title="Guardar como plantilla"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>

              {/* Canal de envío */}
              <div className="flex gap-1">
                {(['WHATSAPP', 'EMAIL', 'AMBOS'] as CanalEnvio[]).map(canal => (
                  <Button
                    key={canal}
                    size="sm"
                    variant={canalEnvio === canal ? 'default' : 'outline'}
                    className={`text-xs h-8 flex-1 ${
                      canalEnvio === canal
                        ? canal === 'WHATSAPP' ? 'bg-green-600 hover:bg-green-700' :
                          canal === 'EMAIL' ? 'bg-blue-600 hover:bg-blue-700' : ''
                        : ''
                    }`}
                    onClick={() => setCanalEnvio(canal)}
                  >
                    {canal === 'WHATSAPP' && <MessageSquare className="h-3.5 w-3.5 mr-1" />}
                    {canal === 'EMAIL' && <Mail className="h-3.5 w-3.5 mr-1" />}
                    {canal === 'AMBOS' && <Send className="h-3.5 w-3.5 mr-1" />}
                    {canal === 'WHATSAPP' ? 'WhatsApp' : canal === 'EMAIL' ? 'Email' : 'Ambos'}
                  </Button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              {/* Asunto (solo si canal incluye email) */}
              {(canalEnvio === 'EMAIL' || canalEnvio === 'AMBOS') && (
                <div>
                  <Label className="text-xs text-slate-500">Asunto (Email)</Label>
                  <Input
                    value={vistaPrevia ? asuntoPreview : asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                    placeholder="Asunto del correo..."
                    className="h-9"
                    readOnly={vistaPrevia}
                  />
                </div>
              )}

              {/* Variables */}
              <div>
                <Label className="text-xs text-slate-500">Variables disponibles</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {VARIABLES_DISPONIBLES.map(v => (
                    <Button
                      key={v.key}
                      size="sm"
                      variant="outline"
                      className="text-xs h-6 px-2"
                      onClick={() => insertVariable(v.key)}
                      title={v.description}
                      disabled={vistaPrevia}
                    >
                      {v.key}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Cuerpo del mensaje */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-slate-500">Mensaje</Label>
                  <Button
                    size="sm"
                    variant={vistaPrevia ? "default" : "ghost"}
                    className="text-xs h-6"
                    onClick={() => setVistaPrevia(!vistaPrevia)}
                    disabled={!primerSeleccionado}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {vistaPrevia ? 'Editar' : 'Vista previa'}
                  </Button>
                </div>
                <Textarea
                  ref={textareaRef}
                  value={vistaPrevia ? mensajePreview : cuerpoMensaje}
                  onChange={(e) => setCuerpoMensaje(e.target.value)}
                  placeholder="Escriba su mensaje aquí..."
                  className="min-h-[200px] text-sm resize-none"
                  readOnly={vistaPrevia}
                />
                {vistaPrevia && primerSeleccionado && (
                  <p className="text-xs text-slate-400 mt-1">
                    Vista previa para: {primerSeleccionado.nombre} {primerSeleccionado.apellido || ''}
                  </p>
                )}
              </div>

              {/* Botón preparar envío */}
              <Button
                onClick={prepararCola}
                className="w-full"
                disabled={selectedIds.size === 0 || !cuerpoMensaje.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Preparar envío ({selectedIds.size} destinatarios)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Panel Derecho: Cola de envío */}
        <div className="col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Cola de envío</span>
                {colaEnvio.length > 0 && (
                  <Badge variant="secondary">{colaEnvio.length}</Badge>
                )}
              </CardTitle>
              {colaEnvio.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={enviarTodos}
                    disabled={enviando || colaEnvio.every(c => c.estadoWA !== 'PENDIENTE' && c.estadoEmail !== 'PENDIENTE')}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {enviando ? `Enviando... ${progresoEnvio}%` : 'Enviar todos'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setColaEnvio([])}
                    disabled={enviando}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {enviando && (
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progresoEnvio}%` }}
                  />
                </div>
              )}
            </CardHeader>

            <CardContent className="overflow-y-auto max-h-[calc(100vh-380px)] space-y-2 pt-0">
              {colaEnvio.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Seleccione destinatarios y prepare el envío</p>
                </div>
              ) : (
                colaEnvio.map((item, index) => (
                  <div
                    key={item.destinatario.id}
                    className="border rounded-lg p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.destinatario.nombre} {item.destinatario.apellido || ''}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.destinatario.apartamentoNumero
                            ? `Apto ${item.destinatario.apartamentoNumero}`
                            : item.destinatario.tipo === 'SERVICIO' ? 'Servicio' : 'Contacto'}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">{item.mensajeResuelto}</p>

                    <div className="flex items-center gap-1">
                      {/* WhatsApp */}
                      {item.destinatario.celular && (item.canal === 'WHATSAPP' || item.canal === 'AMBOS') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => enviarIndividual(index, 'WHATSAPP')}
                          disabled={enviando || item.estadoWA !== 'PENDIENTE'}
                        >
                          {getEstadoIcon(item.estadoWA)}
                          <MessageSquare className="h-3 w-3 text-green-600" />
                          WA
                        </Button>
                      )}

                      {/* Email */}
                      {item.destinatario.email && (item.canal === 'EMAIL' || item.canal === 'AMBOS') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => enviarIndividual(index, 'EMAIL')}
                          disabled={enviando || item.estadoEmail !== 'PENDIENTE'}
                        >
                          {getEstadoIcon(item.estadoEmail)}
                          <Mail className="h-3 w-3 text-blue-600" />
                          Email
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog: Gestionar Plantillas */}
      <Dialog open={showPlantillaDialog} onOpenChange={setShowPlantillaDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlantilla ? 'Editar Plantilla' : 'Gestionar Plantillas'}</DialogTitle>
            <DialogDescription>
              {editingPlantilla ? 'Modifique los datos de la plantilla' : 'Administre las plantillas de mensajes'}
            </DialogDescription>
          </DialogHeader>

          {!editingPlantilla ? (
            <>
              {/* Lista de plantillas */}
              <div className="space-y-2">
                {plantillas.map(p => (
                  <div key={p.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{p.nombre}</span>
                        {p.predefinida && <Badge variant="secondary" className="text-xs">Predefinida</Badge>}
                        <Badge variant="outline" className="text-xs">{p.canal}</Badge>
                        {p.prioridad > 0 && <Badge variant="default" className="text-xs">#{p.prioridad}</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{p.cuerpo}</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingPlantilla(p)
                        setPlantillaForm({
                          nombre: p.nombre,
                          asunto: p.asunto || '',
                          cuerpo: p.cuerpo,
                          canal: p.canal,
                          prioridad: p.prioridad || 0,
                        })
                      }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {!p.predefinida && (
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeletePlantilla(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button onClick={() => {
                  setEditingPlantilla({ id: '', nombre: '', asunto: '', cuerpo: '', canal: 'AMBOS', predefinida: false, activo: true, prioridad: 0, createdAt: '', updatedAt: '' })
                  setPlantillaForm({ nombre: '', asunto: '', cuerpo: '', canal: 'AMBOS', prioridad: 0 })
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nueva Plantilla
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {/* Formulario de plantilla */}
              <div className="space-y-3">
                <div>
                  <Label>Nombre</Label>
                  <Input
                    value={plantillaForm.nombre}
                    onChange={(e) => setPlantillaForm(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Nombre de la plantilla"
                  />
                </div>
                <div>
                  <Label>Asunto (Email)</Label>
                  <Input
                    value={plantillaForm.asunto}
                    onChange={(e) => setPlantillaForm(prev => ({ ...prev, asunto: e.target.value }))}
                    placeholder="Asunto para emails"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Canal</Label>
                    <Select
                      value={plantillaForm.canal}
                      onValueChange={(v) => setPlantillaForm(prev => ({ ...prev, canal: v as CanalEnvio }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AMBOS">Ambos</SelectItem>
                        <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                        <SelectItem value="EMAIL">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Prioridad</Label>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      value={plantillaForm.prioridad}
                      onChange={(e) => setPlantillaForm(prev => ({ ...prev, prioridad: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                    <p className="text-xs text-slate-500 mt-0.5">Mayor número = aparece primero</p>
                  </div>
                </div>
                <div>
                  <Label>Variables disponibles</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {VARIABLES_DISPONIBLES.map(v => (
                      <Badge key={v.key} variant="outline" className="text-xs cursor-pointer hover:bg-slate-100"
                        onClick={() => setPlantillaForm(prev => ({ ...prev, cuerpo: prev.cuerpo + v.key }))}>
                        {v.key}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Cuerpo del mensaje</Label>
                  <Textarea
                    value={plantillaForm.cuerpo}
                    onChange={(e) => setPlantillaForm(prev => ({ ...prev, cuerpo: e.target.value }))}
                    placeholder="Escriba el contenido de la plantilla..."
                    className="min-h-[150px]"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditingPlantilla(null)}>
                  Volver
                </Button>
                <Button onClick={handleSavePlantilla}>
                  <Save className="h-4 w-4 mr-1" />
                  Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Nuevo/Editar Contacto Libre */}
      <Dialog open={showContactoDialog} onOpenChange={setShowContactoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContacto ? 'Editar Contacto' : 'Nuevo Contacto'}</DialogTitle>
            <DialogDescription>
              Contacto libre, no vinculado a apartamento ni servicio
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={contactoForm.nombre}
                  onChange={(e) => setContactoForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Nombre"
                />
              </div>
              <div>
                <Label>Apellido</Label>
                <Input
                  value={contactoForm.apellido}
                  onChange={(e) => setContactoForm(prev => ({ ...prev, apellido: e.target.value }))}
                  placeholder="Apellido"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Celular</Label>
                <Input
                  value={contactoForm.celular}
                  onChange={(e) => setContactoForm(prev => ({ ...prev, celular: e.target.value }))}
                  placeholder="09X XXX XXX"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={contactoForm.email}
                  onChange={(e) => setContactoForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={contactoForm.notas}
                onChange={(e) => setContactoForm(prev => ({ ...prev, notas: e.target.value }))}
                placeholder="Observaciones..."
                className="min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactoDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveContacto}>
              <Save className="h-4 w-4 mr-1" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Guardar como Plantilla */}
      <Dialog open={showGuardarPlantillaDialog} onOpenChange={setShowGuardarPlantillaDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar como Plantilla</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nombre de la plantilla</Label>
            <Input
              value={guardarPlantillaNombre}
              onChange={(e) => setGuardarPlantillaNombre(e.target.value)}
              placeholder="Ej: Mi plantilla personalizada"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGuardarPlantillaDialog(false)}>Cancelar</Button>
            <Button onClick={handleGuardarComoPlantilla}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Historial de Mensajes */}
      <Dialog open={showHistorialDialog} onOpenChange={setShowHistorialDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Mensajes</DialogTitle>
            <DialogDescription>Registro de mensajes enviados</DialogDescription>
          </DialogHeader>

          {historial.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No hay mensajes en el historial</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Mensaje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.slice(0, 100).map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(h.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{h.destinatarioNombre}</div>
                      <div className="text-xs text-slate-400">{h.destinatarioContacto}</div>
                    </TableCell>
                    <TableCell>
                      {h.canal === 'WHATSAPP' ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">WA</Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-700 text-xs">Email</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {getEstadoIcon(h.estado)}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {h.contenido}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
