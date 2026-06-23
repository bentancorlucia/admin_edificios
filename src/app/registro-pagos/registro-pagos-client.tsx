"use client"

import { useState, useEffect, useCallback } from "react"
import { BackToHome } from "@/components/back-to-home"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  HandCoins,
  Building2,
  Search,
  Star,
  Receipt,
  Calendar,
  ArrowLeft,
  AlertCircle,
  Wallet,
  Filter,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  createReciboPago,
  obtenerDeudasPorConcepto,
  calcularDistribucionPago,
  obtenerSaldosCuentaCorriente,
  getTransaccionesByApartamento,
  getCreditosPendientes,
  type Apartamento,
  type CuentaBancaria,
  type DeudasPorConcepto,
  type DistribucionPago,
  type Transaccion,
  type CreditoPendiente,
} from "@/lib/database"
import { toast } from "@/hooks/use-toast"

type Props = {
  apartamentos: Apartamento[]
  cuentasBancarias: CuentaBancaria[]
  initialSaldos: Record<string, number>
}

export function RegistroPagosClient({ apartamentos, cuentasBancarias, initialSaldos }: Props) {
  const [saldos, setSaldos] = useState(initialSaldos)
  const [searchTerm, setSearchTerm] = useState("")
  const [filtroDeuda, setFiltroDeuda] = useState<"CON_DEUDA" | "TODOS" | "AL_DIA">("CON_DEUDA")
  const [selectedApartamento, setSelectedApartamento] = useState<Apartamento | null>(null)

  // Estado del panel de detalle
  const [deudaApartamento, setDeudaApartamento] = useState<DeudasPorConcepto | null>(null)
  const [creditosPendientes, setCreditosPendientes] = useState<CreditoPendiente[]>([])
  const [ultimosPagos, setUltimosPagos] = useState<Transaccion[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  // Estado del formulario de pago
  const [isPagoDialogOpen, setIsPagoDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const cuentaPorDefecto = cuentasBancarias.find((c) => c.porDefecto)

  const [pagoForm, setPagoForm] = useState({
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
    metodoPago: "TRANSFERENCIA",
    cuentaBancariaId: cuentaPorDefecto?.id || "",
    referencia: "",
    notas: "",
    clasificacionPago: "GASTO_COMUN" as "GASTO_COMUN" | "FONDO_RESERVA" | "OTROS_GASTOS",
    excedentePara: "GASTO_COMUN" as "GASTO_COMUN" | "FONDO_RESERVA" | "OTROS_GASTOS",
  })

  const [distribucionPago, setDistribucionPago] = useState<DistribucionPago | null>(null)

  // Distribución manual: cuando está activa, el usuario edita los 3 montos directamente
  const [distribucionManual, setDistribucionManual] = useState(false)
  const [montoManualGC, setMontoManualGC] = useState("0")
  const [montoManualFR, setMontoManualFR] = useState("0")
  const [montoManualOG, setMontoManualOG] = useState("0")

  type ApartamentoAgrupado = {
    numero: string
    piso: number | null
    propietario: Apartamento | null
    inquilino: Apartamento | null
  }

  // Agrupar apartamentos por número (propietario + inquilino)
  const apartamentosAgrupados: ApartamentoAgrupado[] = (() => {
    const grupos = new Map<string, ApartamentoAgrupado>()
    apartamentos.forEach((apt) => {
      const existing = grupos.get(apt.numero)
      if (existing) {
        if (apt.tipoOcupacion === "PROPIETARIO") existing.propietario = apt
        else existing.inquilino = apt
      } else {
        grupos.set(apt.numero, {
          numero: apt.numero,
          piso: apt.piso ?? null,
          propietario: apt.tipoOcupacion === "PROPIETARIO" ? apt : null,
          inquilino: apt.tipoOcupacion === "INQUILINO" ? apt : null,
        })
      }
    })
    return Array.from(grupos.values()).sort((a, b) => {
      const aIsNum = /^\d+$/.test(a.numero)
      const bIsNum = /^\d+$/.test(b.numero)
      if (aIsNum && !bIsNum) return -1
      if (!aIsNum && bIsNum) return 1
      if (aIsNum && bIsNum) return parseInt(a.numero) - parseInt(b.numero)
      return a.numero.localeCompare(b.numero)
    })
  })()

  // Filtrar por búsqueda y deuda
  const filteredApartamentos = apartamentosAgrupados.filter((grupo) => {
    // Filtro por texto
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchesSearch =
        grupo.numero.toLowerCase().includes(term) ||
        grupo.propietario?.contactoNombre?.toLowerCase().includes(term) ||
        grupo.propietario?.contactoApellido?.toLowerCase().includes(term) ||
        grupo.inquilino?.contactoNombre?.toLowerCase().includes(term) ||
        grupo.inquilino?.contactoApellido?.toLowerCase().includes(term)
      if (!matchesSearch) return false
    }

    // Filtro por deuda
    if (filtroDeuda !== "TODOS") {
      const saldoProp = grupo.propietario ? (saldos[grupo.propietario.id] || 0) : 0
      const saldoInq = grupo.inquilino ? (saldos[grupo.inquilino.id] || 0) : 0
      const tieneDeuda = saldoProp > 0 || saldoInq > 0
      if (filtroDeuda === "CON_DEUDA" && !tieneDeuda) return false
      if (filtroDeuda === "AL_DIA" && tieneDeuda) return false
    }

    return true
  })

  // Cargar detalle del apartamento seleccionado
  const cargarDetalleApartamento = useCallback(async (apt: Apartamento) => {
    setCargandoDetalle(true)
    try {
      const [deudas, creditos, transacciones] = await Promise.all([
        obtenerDeudasPorConcepto(apt.id),
        getCreditosPendientes(apt.id),
        getTransaccionesByApartamento(apt.id),
      ])
      setDeudaApartamento(deudas)
      setCreditosPendientes(creditos)
      // Solo últimos 5 pagos (RECIBO_PAGO)
      setUltimosPagos(
        transacciones
          .filter((t) => t.tipo === "RECIBO_PAGO")
          .slice(0, 5)
      )
    } catch (error) {
      console.error("Error cargando detalle:", error)
    } finally {
      setCargandoDetalle(false)
    }
  }, [])

  // Cuando se selecciona un apartamento
  const handleSelectApartamento = useCallback(
    (apt: Apartamento) => {
      setSelectedApartamento(apt)
      cargarDetalleApartamento(apt)
    },
    [cargarDetalleApartamento]
  )

  // Calcular distribución cuando cambia el monto
  useEffect(() => {
    const calcular = async () => {
      if (!selectedApartamento || !pagoForm.monto) {
        setDistribucionPago(null)
        return
      }
      const montoNum = parseFloat(pagoForm.monto)
      if (isNaN(montoNum) || montoNum <= 0) {
        setDistribucionPago(null)
        return
      }
      try {
        const dist = await calcularDistribucionPago(selectedApartamento.id, montoNum)
        setDistribucionPago(dist)
      } catch (error) {
        console.error("Error calculando distribución:", error)
        setDistribucionPago(null)
      }
    }
    calcular()
  }, [selectedApartamento, pagoForm.monto])

  // Abrir dialog de pago
  const handleAbrirPago = () => {
    const sinDeuda = !deudaApartamento || deudaApartamento.total === 0
    setPagoForm({
      monto: deudaApartamento && deudaApartamento.total > 0 ? deudaApartamento.total.toFixed(2) : "",
      fecha: new Date().toISOString().split("T")[0],
      metodoPago: "TRANSFERENCIA",
      cuentaBancariaId: cuentaPorDefecto?.id || "",
      referencia: "",
      notas: "",
      clasificacionPago: "GASTO_COMUN",
      excedentePara: "GASTO_COMUN",
    })
    setDistribucionPago(null)
    // Sin deuda → manual obligatorio (no hay FIFO posible)
    setDistribucionManual(sinDeuda)
    setMontoManualGC("0")
    setMontoManualFR("0")
    setMontoManualOG("0")
    setIsPagoDialogOpen(true)
  }

  // Helpers para manual
  const sumManual = (parseFloat(montoManualGC) || 0) + (parseFloat(montoManualFR) || 0) + (parseFloat(montoManualOG) || 0)
  const montoTotal = parseFloat(pagoForm.monto) || 0
  const diferenciaManual = montoTotal - sumManual
  const sumaCuadra = Math.abs(diferenciaManual) < 0.01

  const excedeDeuda = (() => {
    if (!distribucionManual || !deudaApartamento) return null
    const overGC = (parseFloat(montoManualGC) || 0) > deudaApartamento.gastosComunes
    const overFR = (parseFloat(montoManualFR) || 0) > deudaApartamento.fondoReserva
    const overOG = (parseFloat(montoManualOG) || 0) > deudaApartamento.otrosGastos
    if (overGC || overFR || overOG) {
      const overs: string[] = []
      if (overGC) overs.push(`GC (deuda ${formatCurrency(deudaApartamento.gastosComunes)})`)
      if (overFR) overs.push(`FR (deuda ${formatCurrency(deudaApartamento.fondoReserva)})`)
      if (overOG) overs.push(`OG (deuda ${formatCurrency(deudaApartamento.otrosGastos)})`)
      return overs
    }
    return null
  })()

  // Al activar el toggle manual, pre-llenar con FIFO + excedente
  const handleToggleManual = (activo: boolean) => {
    setDistribucionManual(activo)
    if (activo) {
      const tieneDeuda = !!(deudaApartamento && deudaApartamento.total > 0)
      if (tieneDeuda && distribucionPago) {
        let gc = distribucionPago.aplicadoGastosComunes
        let fr = distribucionPago.aplicadoFondoReserva
        let og = distribucionPago.aplicadoOtrosGastos
        if (distribucionPago.excedente > 0) {
          if (pagoForm.excedentePara === "GASTO_COMUN") gc += distribucionPago.excedente
          else if (pagoForm.excedentePara === "FONDO_RESERVA") fr += distribucionPago.excedente
          else og += distribucionPago.excedente
        }
        setMontoManualGC(gc.toFixed(2))
        setMontoManualFR(fr.toFixed(2))
        setMontoManualOG(og.toFixed(2))
      } else {
        // Sin deuda: arrancar todo en cero
        setMontoManualGC("0")
        setMontoManualFR("0")
        setMontoManualOG("0")
      }
    }
  }

  // Registrar pago
  const handlePagoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedApartamento) return
    if (!pagoForm.monto || parseFloat(pagoForm.monto) <= 0) {
      toast({ title: "Error", description: "El monto debe ser mayor a 0", variant: "destructive" })
      return
    }

    // Validación distribución manual
    if (distribucionManual && !sumaCuadra) {
      toast({
        title: "La distribución no coincide",
        description: `La suma de GC + FR + OG (${formatCurrency(sumManual)}) difiere del monto total (${formatCurrency(montoTotal)}) en ${formatCurrency(Math.abs(diferenciaManual))}.`,
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const fechaParts = pagoForm.fecha.split("-")
      const fechaCorrecta = new Date(
        Date.UTC(
          parseInt(fechaParts[0]),
          parseInt(fechaParts[1]) - 1,
          parseInt(fechaParts[2]),
          12, 0, 0
        )
      )

      const tieneDeuda = !!(deudaApartamento && deudaApartamento.total > 0)
      const tieneExcedente = !!(distribucionPago && distribucionPago.excedente > 0)

      const data = distribucionManual
        ? {
            monto: parseFloat(pagoForm.monto),
            apartamentoId: selectedApartamento.id,
            fecha: fechaCorrecta.toISOString(),
            metodoPago: pagoForm.metodoPago,
            cuentaBancariaId: pagoForm.cuentaBancariaId || null,
            referencia: pagoForm.referencia || null,
            notas: pagoForm.notas || null,
            clasificacionPago: pagoForm.clasificacionPago as "GASTO_COMUN" | "FONDO_RESERVA" | "OTROS_GASTOS",
            distribucionManual: true,
            montoGastoComun: parseFloat(montoManualGC) || 0,
            montoFondoReserva: parseFloat(montoManualFR) || 0,
            montoOtrosGastos: parseFloat(montoManualOG) || 0,
          }
        : {
            monto: parseFloat(pagoForm.monto),
            apartamentoId: selectedApartamento.id,
            fecha: fechaCorrecta.toISOString(),
            metodoPago: pagoForm.metodoPago,
            cuentaBancariaId: pagoForm.cuentaBancariaId || null,
            referencia: pagoForm.referencia || null,
            notas: pagoForm.notas || null,
            clasificacionPago: pagoForm.clasificacionPago as "GASTO_COMUN" | "FONDO_RESERVA" | "OTROS_GASTOS",
            usarDistribucionAutomatica: tieneDeuda,
            excedentePara: tieneExcedente ? pagoForm.excedentePara : undefined,
          }

      console.log("Datos del pago a registrar:", JSON.stringify(data, null, 2))
      await createReciboPago(data)

      // Refrescar saldos y detalle
      const nuevosSaldos = await obtenerSaldosCuentaCorriente()
      setSaldos(nuevosSaldos)
      await cargarDetalleApartamento(selectedApartamento)

      setIsPagoDialogOpen(false)
      toast({
        title: "Pago registrado",
        description: `Pago de ${formatCurrency(parseFloat(pagoForm.monto))} registrado para Apto ${selectedApartamento.numero}`,
        variant: "success",
      })
    } catch (error) {
      console.error("Error registrando pago:", error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast({ title: "Error", description: `Error al registrar el pago: ${errorMsg}`, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  // Volver a la lista
  const handleVolver = () => {
    setSelectedApartamento(null)
    setDeudaApartamento(null)
    setCreditosPendientes([])
    setUltimosPagos([])
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedApartamento && (
            <Button variant="ghost" size="icon" onClick={handleVolver}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            {!selectedApartamento && <BackToHome />}
            <h1 className="text-2xl font-bold text-slate-900">
              {selectedApartamento
                ? `Apto ${selectedApartamento.numero}`
                : "Registro de Pagos"}
            </h1>
            <p className="text-sm text-slate-500">
              {selectedApartamento
                ? `${selectedApartamento.tipoOcupacion === "PROPIETARIO" ? "Propietario" : "Inquilino"}${selectedApartamento.contactoNombre ? ` - ${selectedApartamento.contactoNombre} ${selectedApartamento.contactoApellido || ""}` : ""}`
                : "Seleccione un apartamento para registrar un pago"}
            </p>
          </div>
        </div>
        {selectedApartamento && (
          <Button onClick={handleAbrirPago} className="gap-2">
            <HandCoins className="h-4 w-4" />
            Registrar Pago
          </Button>
        )}
      </div>

      {/* Vista: Lista de Apartamentos */}
      {!selectedApartamento && (
        <>
          {/* Búsqueda y Filtro */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative max-w-md flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por N de apto o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <Filter className="h-4 w-4 text-slate-400 ml-2 mr-1" />
              <Button
                variant={filtroDeuda === "CON_DEUDA" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFiltroDeuda("CON_DEUDA")}
                className="text-xs h-8"
              >
                Con deuda
              </Button>
              <Button
                variant={filtroDeuda === "TODOS" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFiltroDeuda("TODOS")}
                className="text-xs h-8"
              >
                Todos
              </Button>
              <Button
                variant={filtroDeuda === "AL_DIA" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFiltroDeuda("AL_DIA")}
                className="text-xs h-8"
              >
                Al día
              </Button>
            </div>
          </div>

          {/* Grid de Apartamentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredApartamentos.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">
                  {searchTerm
                    ? "No se encontraron apartamentos con ese criterio"
                    : filtroDeuda === "CON_DEUDA"
                    ? "No hay apartamentos con deuda pendiente"
                    : filtroDeuda === "AL_DIA"
                    ? "No hay apartamentos al día"
                    : "No hay apartamentos registrados"}
                </p>
              </div>
            ) : (
              filteredApartamentos.map((grupo) => (
                <Card key={grupo.numero} className="group hover:shadow-md transition-all duration-200 border-slate-200 hover:border-slate-300">
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                          <span className="text-white font-bold text-sm">{grupo.numero}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">Apto {grupo.numero}</h3>
                          <p className="text-xs text-slate-500">Piso {grupo.piso || "N/A"}</p>
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
                      <div
                        className="mb-3 p-3 bg-blue-50/70 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100/70 transition-colors"
                        onClick={() => handleSelectApartamento(grupo.propietario!)}
                      >
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Propietario</span>
                        <p className="font-medium text-slate-800 text-sm truncate mt-1">
                          {grupo.propietario.contactoNombre
                            ? `${grupo.propietario.contactoNombre} ${grupo.propietario.contactoApellido || ""}`.trim()
                            : <span className="text-slate-400 italic">Sin contacto</span>}
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
                          <span className={`text-xs font-bold ${(saldos[grupo.propietario.id] || 0) > 0 ? "text-red-600" : (saldos[grupo.propietario.id] || 0) < 0 ? "text-green-600" : "text-slate-500"}`}>
                            {(saldos[grupo.propietario.id] || 0) > 0 ? "-" : (saldos[grupo.propietario.id] || 0) < 0 ? "+" : ""}
                            {formatCurrency(Math.abs(saldos[grupo.propietario.id] || 0))}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Sección Inquilino */}
                    {grupo.inquilino && (
                      <div
                        className="mb-3 p-3 bg-purple-50/70 rounded-lg border border-purple-100 cursor-pointer hover:bg-purple-100/70 transition-colors"
                        onClick={() => handleSelectApartamento(grupo.inquilino!)}
                      >
                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wide">Inquilino</span>
                        <p className="font-medium text-slate-800 text-sm truncate mt-1">
                          {grupo.inquilino.contactoNombre
                            ? `${grupo.inquilino.contactoNombre} ${grupo.inquilino.contactoApellido || ""}`.trim()
                            : <span className="text-slate-400 italic">Sin contacto</span>}
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
                          <span className={`text-xs font-bold ${(saldos[grupo.inquilino.id] || 0) > 0 ? "text-red-600" : (saldos[grupo.inquilino.id] || 0) < 0 ? "text-green-600" : "text-slate-500"}`}>
                            {(saldos[grupo.inquilino.id] || 0) > 0 ? "-" : (saldos[grupo.inquilino.id] || 0) < 0 ? "+" : ""}
                            {formatCurrency(Math.abs(saldos[grupo.inquilino.id] || 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {/* Vista: Detalle del Apartamento */}
      {selectedApartamento && (
        <div className="space-y-6">
          {cargandoDetalle ? (
            <div className="text-center py-12 text-slate-500">Cargando datos del apartamento...</div>
          ) : (
            <>
              {/* Si hay más de un perfil para este número, mostrar selector */}
              {(() => {
                const grupo = apartamentosAgrupados.find((g) => g.numero === selectedApartamento.numero)
                if (!grupo || (!grupo.propietario || !grupo.inquilino)) return null
                const perfiles = [grupo.propietario, grupo.inquilino].filter(Boolean) as Apartamento[]
                return (
                  <div className="flex gap-2">
                    {perfiles.map((apt) => (
                      <Button
                        key={apt.id}
                        variant={apt.id === selectedApartamento.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSelectApartamento(apt)}
                      >
                        {apt.tipoOcupacion === "PROPIETARIO" ? "Propietario" : "Inquilino"}
                        {apt.contactoNombre && ` - ${apt.contactoNombre}`}
                      </Button>
                    ))}
                  </div>
                )
              })()}

              {/* Cards resumen */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Saldo */}
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-500 mb-1">Saldo Actual</p>
                    {(() => {
                      const saldo = saldos[selectedApartamento.id] || 0
                      return (
                        <p
                          className={`text-2xl font-bold ${
                            saldo > 0
                              ? "text-red-600"
                              : saldo < 0
                              ? "text-green-600"
                              : "text-slate-600"
                          }`}
                        >
                          {saldo > 0
                            ? formatCurrency(saldo)
                            : saldo < 0
                            ? `-${formatCurrency(Math.abs(saldo))}`
                            : formatCurrency(0)}
                        </p>
                      )
                    })()}
                    <p className="text-xs text-slate-400 mt-1">
                      {(saldos[selectedApartamento.id] || 0) > 0
                        ? "Saldo deudor"
                        : (saldos[selectedApartamento.id] || 0) < 0
                        ? "Saldo a favor"
                        : "Al dia"}
                    </p>
                  </CardContent>
                </Card>

                {/* Deuda GC */}
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-500 mb-1">Deuda Gastos Comunes</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(deudaApartamento?.gastosComunes || 0)}
                    </p>
                  </CardContent>
                </Card>

                {/* Deuda FR */}
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-500 mb-1">Deuda Fondo de Reserva</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(deudaApartamento?.fondoReserva || 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detalle de deuda (meses adeudados) */}
              {creditosPendientes.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Detalle de Deuda ({creditosPendientes.length} {creditosPendientes.length === 1 ? "concepto" : "conceptos"} pendientes)
                    </h3>
                    <div className="space-y-2">
                      {creditosPendientes.map((credito) => (
                        <div
                          key={credito.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={
                                credito.categoria === "GASTOS_COMUNES"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              }
                            >
                              {credito.categoria === "GASTOS_COMUNES" ? "GC" : "FR"}
                            </Badge>
                            <span className="text-slate-700">
                              {credito.descripcion || (credito.categoria === "GASTOS_COMUNES" ? "Gastos Comunes" : "Fondo de Reserva")}
                            </span>
                            <span className="text-slate-400 text-xs">
                              {formatDate(credito.fecha)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-red-600">
                              {formatCurrency(credito.pendiente)}
                            </span>
                            {credito.montoPagado > 0 && (
                              <span className="text-xs text-slate-400 ml-2">
                                (pagado: {formatCurrency(credito.montoPagado)})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Últimos pagos */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-green-500" />
                    Ultimos Pagos
                  </h3>
                  {ultimosPagos.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">
                      No hay pagos registrados
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ultimosPagos.map((pago) => (
                        <div
                          key={pago.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-600">
                              {formatDate(pago.fecha)}
                            </span>
                            {pago.clasificacionPago && (
                              <Badge
                                variant="outline"
                                className={
                                  pago.clasificacionPago === "GASTO_COMUN"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : pago.clasificacionPago === "FONDO_RESERVA"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : pago.clasificacionPago === "OTROS_GASTOS"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-green-50 text-green-700 border-green-200"
                                }
                              >
                                {pago.clasificacionPago === "GASTO_COMUN"
                                  ? "GC"
                                  : pago.clasificacionPago === "FONDO_RESERVA"
                                  ? "FR"
                                  : pago.clasificacionPago === "OTROS_GASTOS"
                                  ? "OG"
                                  : "Mixto"}
                              </Badge>
                            )}
                            {pago.referencia && (
                              <span className="text-xs text-slate-400">
                                Ref: {pago.referencia}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-green-600">
                            +{formatCurrency(pago.monto)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Dialog de Registro de Pago */}
      <Dialog
        open={isPagoDialogOpen}
        onOpenChange={(open) => {
          setIsPagoDialogOpen(open)
          if (!open) {
            setDistribucionPago(null)
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Registrar Pago - Apto {selectedApartamento?.numero}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePagoSubmit} className="space-y-4">
            {/* Deuda actual */}
            {deudaApartamento && deudaApartamento.total > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-3">
                  <p className="text-sm font-medium text-amber-800 mb-1">Deuda actual:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-amber-600">Gastos Comunes:</span>
                      <p className="font-semibold text-amber-900">
                        {formatCurrency(deudaApartamento.gastosComunes)}
                      </p>
                    </div>
                    <div>
                      <span className="text-amber-600">Fondo Reserva:</span>
                      <p className="font-semibold text-amber-900">
                        {formatCurrency(deudaApartamento.fondoReserva)}
                      </p>
                    </div>
                    <div>
                      <span className="text-amber-600">Otros Gastos:</span>
                      <p className="font-semibold text-amber-900">
                        {formatCurrency(deudaApartamento.otrosGastos)}
                      </p>
                    </div>
                    <div>
                      <span className="text-amber-600">Total:</span>
                      <p className="font-bold text-amber-900">
                        {formatCurrency(deudaApartamento.total)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!deudaApartamento || deudaApartamento.total === 0 ? (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="p-3">
                  <p className="text-sm text-green-700">Sin deuda pendiente</p>
                </CardContent>
              </Card>
            ) : null}

            {/* Monto */}
            <div className="space-y-2">
              <Label>Monto de la transferencia *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                required
                className="text-lg font-semibold"
              />
            </div>

            {/* Distribución automática */}
            {pagoForm.monto &&
              parseFloat(pagoForm.monto) > 0 &&
              distribucionPago && (
                <Card className={distribucionManual ? "border-amber-200 bg-amber-50/50" : "border-blue-200 bg-blue-50/50"}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-sm font-medium ${distribucionManual ? "text-amber-800" : "text-blue-800"}`}>
                        {distribucionManual ? "Distribución manual:" : "Distribución del pago (FIFO):"}
                      </p>
                      {!!deudaApartamento && deudaApartamento.total > 0 && (
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={distribucionManual}
                            onChange={(e) => handleToggleManual(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-slate-600">Editar manualmente</span>
                        </label>
                      )}
                    </div>

                    {!distribucionManual ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-600">A Gastos Comunes:</span>
                          <span className="font-semibold text-blue-900">
                            {formatCurrency(distribucionPago.aplicadoGastosComunes)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">A Fondo de Reserva:</span>
                          <span className="font-semibold text-blue-900">
                            {formatCurrency(distribucionPago.aplicadoFondoReserva)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">A Otros Gastos:</span>
                          <span className="font-semibold text-blue-900">
                            {formatCurrency(distribucionPago.aplicadoOtrosGastos)}
                          </span>
                        </div>
                        {distribucionPago.excedente > 0 && (
                          <div className="flex justify-between pt-1 border-t border-blue-200">
                            <span className="text-green-600 font-medium">Excedente:</span>
                            <span className="font-bold text-green-700">
                              {formatCurrency(distribucionPago.excedente)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                          <Label className="text-amber-800 text-xs">A Gastos Comunes</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={montoManualGC}
                            onChange={(e) => setMontoManualGC(e.target.value)}
                            className="h-8 w-32 text-right"
                          />
                          <Label className="text-amber-800 text-xs">A Fondo de Reserva</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={montoManualFR}
                            onChange={(e) => setMontoManualFR(e.target.value)}
                            className="h-8 w-32 text-right"
                          />
                          <Label className="text-amber-800 text-xs">A Otros Gastos</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={montoManualOG}
                            onChange={(e) => setMontoManualOG(e.target.value)}
                            className="h-8 w-32 text-right"
                          />
                        </div>
                        <div className={`flex justify-between text-xs pt-2 border-t ${sumaCuadra ? "border-amber-200 text-slate-600" : "border-red-300 text-red-700"}`}>
                          <span>Suma manual:</span>
                          <span className="font-semibold">{formatCurrency(sumManual)}</span>
                        </div>
                        {!sumaCuadra && (
                          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                            Diferencia con monto total: {diferenciaManual > 0 ? "+" : ""}{formatCurrency(diferenciaManual)} — la suma debe igualar {formatCurrency(montoTotal)} para registrar el pago.
                          </div>
                        )}
                        {excedeDeuda && excedeDeuda.length > 0 && (
                          <div className="text-xs text-amber-800 bg-amber-100 border border-amber-300 rounded px-2 py-1">
                            <strong>Atención:</strong> Estás asignando más que la deuda actual en {excedeDeuda.join(", ")}. El sobrante quedará como saldo a favor en esa categoría.
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            {/* Excedente (solo en modo automático) */}
            {!distribucionManual && distribucionPago && distribucionPago.excedente > 0 && (
              <div className="space-y-2">
                <Label>Asignar excedente a:</Label>
                <Select
                  value={pagoForm.excedentePara}
                  onValueChange={(value: "GASTO_COMUN" | "FONDO_RESERVA" | "OTROS_GASTOS") =>
                    setPagoForm({ ...pagoForm, excedentePara: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GASTO_COMUN">
                      Gastos Comunes (saldo a favor)
                    </SelectItem>
                    <SelectItem value="FONDO_RESERVA">
                      Fondo de Reserva (saldo a favor)
                    </SelectItem>
                    <SelectItem value="OTROS_GASTOS">
                      Otros Gastos (saldo a favor)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  El excedente de {formatCurrency(distribucionPago.excedente)} quedará como
                  saldo a favor
                </p>
              </div>
            )}

            {/* Cuando no hay deuda: distribución manual obligatoria con los 3 inputs */}
            {(!deudaApartamento || deudaApartamento.total === 0) && distribucionManual && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-3 space-y-2 text-sm">
                  <p className="text-sm font-medium text-amber-800">Distribución del pago (sin deuda previa):</p>
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <Label className="text-amber-800 text-xs">A Gastos Comunes</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={montoManualGC}
                      onChange={(e) => setMontoManualGC(e.target.value)}
                      className="h-8 w-32 text-right"
                    />
                    <Label className="text-amber-800 text-xs">A Fondo de Reserva</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={montoManualFR}
                      onChange={(e) => setMontoManualFR(e.target.value)}
                      className="h-8 w-32 text-right"
                    />
                    <Label className="text-amber-800 text-xs">A Otros Gastos</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={montoManualOG}
                      onChange={(e) => setMontoManualOG(e.target.value)}
                      className="h-8 w-32 text-right"
                    />
                  </div>
                  <div className={`flex justify-between text-xs pt-2 border-t ${sumaCuadra ? "border-amber-200 text-slate-600" : "border-red-300 text-red-700"}`}>
                    <span>Suma manual:</span>
                    <span className="font-semibold">{formatCurrency(sumManual)}</span>
                  </div>
                  {!sumaCuadra && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                      Diferencia con monto total: {diferenciaManual > 0 ? "+" : ""}{formatCurrency(diferenciaManual)} — la suma debe igualar {formatCurrency(montoTotal)} para registrar el pago.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Fecha y método de pago */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={pagoForm.fecha}
                  onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select
                  value={pagoForm.metodoPago}
                  onValueChange={(value) =>
                    setPagoForm({ ...pagoForm, metodoPago: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                    <SelectItem value="TARJETA">Tarjeta</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="OTRO">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cuenta bancaria */}
            <div className="space-y-2">
              <Label>Cuenta Bancaria</Label>
              <Select
                value={pagoForm.cuentaBancariaId || "none"}
                onValueChange={(value) =>
                  setPagoForm({
                    ...pagoForm,
                    cuentaBancariaId: value === "none" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {cuentasBancarias.filter((c) => c.activa).map((cuenta) => (
                    <SelectItem key={cuenta.id} value={cuenta.id}>
                      {cuenta.banco} - {cuenta.tipoCuenta} ({cuenta.numeroCuenta.slice(-4)})
                      {cuenta.porDefecto && (
                        <Star className="inline h-3 w-3 ml-1 fill-amber-400 text-amber-400" />
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Si seleccionas una cuenta, se registrará automáticamente el ingreso bancario
              </p>
            </div>

            {/* Referencia */}
            <div className="space-y-2">
              <Label>Número de referencia</Label>
              <Input
                placeholder="Ej: Transferencia #456"
                value={pagoForm.referencia}
                onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })}
              />
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={pagoForm.notas}
                onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })}
              />
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPagoDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || (distribucionManual && !sumaCuadra)}>
                {isLoading ? "Guardando..." : "Registrar Pago"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
