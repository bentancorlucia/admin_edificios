"use client"

import { useState, useMemo } from "react"
import { open } from "@tauri-apps/plugin-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Building2,
  Phone,
  Mail,
  Home,
  FileText,
  MessageCircle,
  X
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Apartamento {
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

interface ApartamentoAgrupado {
  numero: string
  piso: number | null
  propietario: Apartamento | null
  inquilino: Apartamento | null
}

interface BuildingViewProps {
  apartamentos: Apartamento[]
  saldos: Record<string, number>
}

const tipoOcupacionBadge = {
  PROPIETARIO: "P",
  INQUILINO: "I",
}

// Función para agrupar apartamentos por número
function agruparApartamentos(apartamentos: Apartamento[]): Map<string, ApartamentoAgrupado> {
  const grupos = new Map<string, ApartamentoAgrupado>()

  apartamentos.forEach((apt) => {
    const key = apt.numero.toUpperCase()
    const existing = grupos.get(key)
    if (existing) {
      if (apt.tipoOcupacion === "PROPIETARIO") {
        existing.propietario = apt
      } else {
        existing.inquilino = apt
      }
    } else {
      grupos.set(key, {
        numero: apt.numero,
        piso: apt.piso,
        propietario: apt.tipoOcupacion === "PROPIETARIO" ? apt : null,
        inquilino: apt.tipoOcupacion === "INQUILINO" ? apt : null,
      })
    }
  })

  return grupos
}

// Función para organizar apartamentos por piso
function organizarPorPiso(grupos: Map<string, ApartamentoAgrupado>) {
  const pisos = new Map<number, ApartamentoAgrupado[]>()

  grupos.forEach((grupo) => {
    const piso = grupo.piso || 1
    if (!pisos.has(piso)) {
      pisos.set(piso, [])
    }
    pisos.get(piso)!.push(grupo)
  })

  // Ordenar apartamentos dentro de cada piso por número
  pisos.forEach((apts) => {
    apts.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
  })

  // Ordenar pisos de mayor a menor
  const pisosOrdenados = Array.from(pisos.keys()).sort((a, b) => b - a)

  return { pisos, pisosOrdenados }
}

function getGrupoColor(grupo: ApartamentoAgrupado) {
  const tieneAmbos = grupo.propietario && grupo.inquilino
  if (tieneAmbos) {
    return "bg-green-500 hover:bg-green-600"
  } else if (grupo.propietario) {
    return "bg-blue-500 hover:bg-blue-600"
  } else if (grupo.inquilino) {
    return "bg-purple-500 hover:bg-purple-600"
  }
  return "bg-slate-400 hover:bg-slate-500"
}

function getGrupoBadge(grupo: ApartamentoAgrupado) {
  const tieneAmbos = grupo.propietario && grupo.inquilino
  if (tieneAmbos) {
    return <Badge variant="info">P / I</Badge>
  } else if (grupo.propietario) {
    return <Badge variant="default">Propietario</Badge>
  } else if (grupo.inquilino) {
    return <Badge variant="secondary">Inquilino</Badge>
  }
  return null
}

export function BuildingView({ apartamentos, saldos }: BuildingViewProps) {
  const [selectedGrupo, setSelectedGrupo] = useState<ApartamentoAgrupado | null>(null)

  // Crear un mapa de apartamentos agrupados por número
  const apartamentoGrupos = useMemo(() => agruparApartamentos(apartamentos), [apartamentos])

  // Organizar por pisos dinámicamente
  const { pisos, pisosOrdenados } = useMemo(
    () => organizarPorPiso(apartamentoGrupos),
    [apartamentoGrupos]
  )

  // Calcular el máximo de apartamentos por piso para el layout
  const maxAptsPorPiso = useMemo(() => {
    let max = 2
    pisos.forEach((apts) => {
      if (apts.length > max) max = apts.length
    })
    return max
  }, [pisos])

  const handleWhatsApp = async (apt: Apartamento) => {
    if (!apt.contactoCelular) return
    const contacto = apt.contactoNombre ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim() : ''
    const mensaje = encodeURIComponent(
      `Hola${contacto ? ` ${contacto}` : ''}, le escribo desde la administración del edificio respecto al apartamento ${apt.numero}.`
    )
    await open(`https://wa.me/${apt.contactoCelular.replace(/\D/g, "")}?text=${mensaje}`)
  }

  const handleSendGmail = async (apt: Apartamento) => {
    if (!apt.contactoEmail) return
    const contacto = apt.contactoNombre ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim() : ''
    const subject = `Administración del Edificio - Apartamento ${apt.numero}`
    const body = `Estimado/a ${contacto},\n\nLe escribo desde la administración del edificio respecto al apartamento ${apt.numero}.\n\nSaludos cordiales.`
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(apt.contactoEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    await open(url)
  }

  // Si no hay apartamentos, mostrar mensaje
  if (apartamentos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Vista del Edificio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Building2 className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-center">
              No hay apartamentos registrados
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Vista del Edificio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Vista del Edificio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            {/* Techo */}
            <div className="h-8 bg-slate-700 rounded-t-lg flex items-center justify-center">
              <span className="text-white text-xs font-medium">TERRAZA</span>
            </div>

            {/* Pisos - renderizados dinámicamente */}
            {pisosOrdenados.map((piso) => {
              const aptsDePiso = pisos.get(piso) || []

              return (
                <div key={piso} className="flex gap-1">
                  {/* Indicador de piso */}
                  <div className="w-10 bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600 rounded-l">
                    {piso}
                  </div>

                  {/* Apartamentos del piso */}
                  {aptsDePiso.map((grupo) => {
                    const isSelected = selectedGrupo?.numero === grupo.numero
                    const tieneAmbos = grupo.propietario && grupo.inquilino
                    const aptPrincipal = grupo.propietario || grupo.inquilino

                    return (
                      <button
                        key={grupo.numero}
                        onClick={() => setSelectedGrupo(grupo)}
                        className={`
                          flex-1 h-16 rounded-lg transition-all duration-300 ease-out
                          flex flex-col items-center justify-center gap-1
                          ${getGrupoColor(grupo)} text-white cursor-pointer
                          hover:shadow-md hover:-translate-y-0.5
                          ${isSelected
                            ? "ring-4 ring-white shadow-[0_0_15px_rgba(0,0,0,0.3)] scale-110 z-10"
                            : "opacity-75 hover:opacity-100"}
                        `}
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-lg">
                            {grupo.numero}
                          </span>
                          <span className="text-xs font-bold bg-white/20 px-1 rounded">
                            {tieneAmbos ? "P/I" : tipoOcupacionBadge[aptPrincipal!.tipoOcupacion]}
                          </span>
                        </div>
                        {aptPrincipal && aptPrincipal.contactoNombre && (
                          <span className="text-xs opacity-90 truncate max-w-[90%]">
                            {aptPrincipal.contactoNombre}
                          </span>
                        )}
                      </button>
                    )
                  })}

                  {/* Espacios vacíos para mantener el layout uniforme */}
                  {Array.from({ length: maxAptsPorPiso - aptsDePiso.length }).map((_, idx) => (
                    <div key={`empty-${piso}-${idx}`} className="flex-1 h-16" />
                  ))}

                  {/* Borde derecho */}
                  <div className="w-10 bg-slate-200 rounded-r" />
                </div>
              )
            })}

            {/* Base / Planta Baja */}
            <div className="h-12 bg-slate-800 rounded-b-lg flex items-center justify-center">
              <span className="text-white text-sm font-medium">LOBBY / ENTRADA</span>
            </div>
          </div>

          {/* Leyenda */}
          <div className="mt-4 flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500" />
              <span className="text-sm text-slate-600">Propietario (P)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-500" />
              <span className="text-sm text-slate-600">Inquilino (I)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span className="text-sm text-slate-600">Ambos (P/I)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel de Detalles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Detalles del Apartamento
            </span>
            {selectedGrupo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedGrupo(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedGrupo ? (
            <div className="space-y-6">
              {/* Encabezado */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-slate-900">
                      Apartamento {selectedGrupo.numero}
                    </h3>
                    <span className="text-sm font-bold px-2 py-1 rounded bg-slate-200 text-slate-700">
                      {selectedGrupo.propietario && selectedGrupo.inquilino
                        ? "P/I"
                        : tipoOcupacionBadge[(selectedGrupo.propietario || selectedGrupo.inquilino)!.tipoOcupacion]}
                    </span>
                  </div>
                  <p className="text-slate-500">
                    Piso {selectedGrupo.piso || "N/A"}
                  </p>
                </div>
                {getGrupoBadge(selectedGrupo)}
              </div>

              <Separator />

              {/* Sección Propietario con Gastos */}
              {selectedGrupo.propietario && (
                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-blue-700 text-xs uppercase tracking-wide">Propietario</h4>
                    <div className="flex gap-1">
                      {selectedGrupo.propietario.contactoCelular && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-green-600"
                          onClick={() => handleWhatsApp(selectedGrupo.propietario!)}
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                      )}
                      {selectedGrupo.propietario.contactoEmail && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-red-500"
                          onClick={() => handleSendGmail(selectedGrupo.propietario!)}
                          title="Gmail"
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Contacto */}
                  {selectedGrupo.propietario.contactoNombre ? (
                    <div className="mb-3">
                      <p className="font-medium text-slate-900">
                        {selectedGrupo.propietario.contactoNombre} {selectedGrupo.propietario.contactoApellido || ''}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        {selectedGrupo.propietario.contactoCelular && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {selectedGrupo.propietario.contactoCelular}
                          </span>
                        )}
                        {selectedGrupo.propietario.contactoEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {selectedGrupo.propietario.contactoEmail}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm mb-3">Sin contacto</p>
                  )}

                  {/* Gastos del Propietario */}
                  <div className="pt-3 border-t border-blue-200 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">G. Comunes</p>
                      <p className="font-semibold text-slate-800">{formatCurrency(selectedGrupo.propietario.gastosComunes)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">F. Reserva</p>
                      <p className="font-semibold text-slate-800">{formatCurrency(selectedGrupo.propietario.fondoReserva)}</p>
                    </div>
                    <div>
                      <p className="text-blue-600 font-medium">Total</p>
                      <p className="font-bold text-blue-700">{formatCurrency(selectedGrupo.propietario.gastosComunes + selectedGrupo.propietario.fondoReserva)}</p>
                    </div>
                  </div>

                  {/* Saldo de Cuenta Corriente */}
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-medium text-slate-600">Saldo Cuenta Corriente</p>
                      <p className={`text-sm font-bold ${
                        (saldos[selectedGrupo.propietario.id] || 0) > 0
                          ? 'text-red-600'
                          : (saldos[selectedGrupo.propietario.id] || 0) < 0
                            ? 'text-green-600'
                            : 'text-slate-500'
                      }`}>
                        {(saldos[selectedGrupo.propietario.id] || 0) > 0 ? '+ ' : ''}
                        {formatCurrency(Math.abs(saldos[selectedGrupo.propietario.id] || 0))}
                        {(saldos[selectedGrupo.propietario.id] || 0) > 0 && (
                          <span className="text-xs font-normal ml-1">(Debe)</span>
                        )}
                        {(saldos[selectedGrupo.propietario.id] || 0) < 0 && (
                          <span className="text-xs font-normal ml-1">(A favor)</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sección Inquilino con Gastos */}
              {selectedGrupo.inquilino && (
                <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-purple-700 text-xs uppercase tracking-wide">Inquilino</h4>
                    <div className="flex gap-1">
                      {selectedGrupo.inquilino.contactoCelular && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-green-600"
                          onClick={() => handleWhatsApp(selectedGrupo.inquilino!)}
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                      )}
                      {selectedGrupo.inquilino.contactoEmail && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-red-500"
                          onClick={() => handleSendGmail(selectedGrupo.inquilino!)}
                          title="Gmail"
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Contacto */}
                  {selectedGrupo.inquilino.contactoNombre ? (
                    <div className="mb-3">
                      <p className="font-medium text-slate-900">
                        {selectedGrupo.inquilino.contactoNombre} {selectedGrupo.inquilino.contactoApellido || ''}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        {selectedGrupo.inquilino.contactoCelular && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {selectedGrupo.inquilino.contactoCelular}
                          </span>
                        )}
                        {selectedGrupo.inquilino.contactoEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {selectedGrupo.inquilino.contactoEmail}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm mb-3">Sin contacto</p>
                  )}

                  {/* Gastos del Inquilino */}
                  <div className="pt-3 border-t border-purple-200 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">G. Comunes</p>
                      <p className="font-semibold text-slate-800">{formatCurrency(selectedGrupo.inquilino.gastosComunes)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">F. Reserva</p>
                      <p className="font-semibold text-slate-800">{formatCurrency(selectedGrupo.inquilino.fondoReserva)}</p>
                    </div>
                    <div>
                      <p className="text-purple-600 font-medium">Total</p>
                      <p className="font-bold text-purple-700">{formatCurrency(selectedGrupo.inquilino.gastosComunes + selectedGrupo.inquilino.fondoReserva)}</p>
                    </div>
                  </div>

                  {/* Saldo de Cuenta Corriente */}
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-medium text-slate-600">Saldo Cuenta Corriente</p>
                      <p className={`text-sm font-bold ${
                        (saldos[selectedGrupo.inquilino.id] || 0) > 0
                          ? 'text-red-600'
                          : (saldos[selectedGrupo.inquilino.id] || 0) < 0
                            ? 'text-green-600'
                            : 'text-slate-500'
                      }`}>
                        {(saldos[selectedGrupo.inquilino.id] || 0) > 0 ? '+ ' : ''}
                        {formatCurrency(Math.abs(saldos[selectedGrupo.inquilino.id] || 0))}
                        {(saldos[selectedGrupo.inquilino.id] || 0) > 0 && (
                          <span className="text-xs font-normal ml-1">(Debe)</span>
                        )}
                        {(saldos[selectedGrupo.inquilino.id] || 0) < 0 && (
                          <span className="text-xs font-normal ml-1">(A favor)</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notas */}
              {(selectedGrupo.propietario?.notas || selectedGrupo.inquilino?.notas) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Notas
                    </h4>
                    {selectedGrupo.propietario?.notas && (
                      <p className="text-slate-600 text-sm bg-slate-50 p-3 rounded-lg mb-2">
                        <span className="font-medium text-blue-600">Propietario:</span> {selectedGrupo.propietario.notas}
                      </p>
                    )}
                    {selectedGrupo.inquilino?.notas && (
                      <p className="text-slate-600 text-sm bg-slate-50 p-3 rounded-lg">
                        <span className="font-medium text-purple-600">Inquilino:</span> {selectedGrupo.inquilino.notas}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Acciones */}
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => window.location.href = `/apartamentos`}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Ver en Apartamentos
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Building2 className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-center">
                Selecciona un apartamento del edificio para ver sus detalles
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
