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
  TrendingUp,
  TrendingDown,
  Plus,
  Download,
  CreditCard,
  Receipt,
  Filter,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  createTransaccion,
  createVentaCredito,
  createReciboPago,
} from "./actions"
import { generateTransaccionesPDF } from "@/lib/pdf"

type Apartamento = {
  id: string
  numero: string
}

type Transaccion = {
  id: string
  tipo: "INGRESO" | "EGRESO" | "VENTA_CREDITO" | "RECIBO_PAGO"
  monto: number
  fecha: Date | string
  categoria: string | null
  descripcion: string | null
  referencia: string | null
  metodoPago: string
  notas: string | null
  estadoCredito: "PENDIENTE" | "PARCIAL" | "PAGADO" | null
  montoPagado: number | null
  apartamentoId: string | null
  apartamento: Apartamento | null
}

type Props = {
  initialTransacciones: Transaccion[]
  apartamentos: Apartamento[]
}

const tipoLabels = {
  INGRESO: "Ingreso",
  EGRESO: "Egreso",
  VENTA_CREDITO: "Venta Crédito",
  RECIBO_PAGO: "Recibo de Pago",
}

const categoriaLabels: Record<string, string> = {
  GASTOS_COMUNES: "Gastos Comunes",
  MANTENIMIENTO: "Mantenimiento",
  SERVICIOS: "Servicios",
  ADMINISTRACION: "Administración",
  REPARACIONES: "Reparaciones",
  LIMPIEZA: "Limpieza",
  SEGURIDAD: "Seguridad",
  OTROS: "Otros",
}

const estadoCreditoColors = {
  PENDIENTE: "destructive" as const,
  PARCIAL: "warning" as const,
  PAGADO: "success" as const,
}

export function TransaccionesClient({ initialTransacciones, apartamentos }: Props) {
  const [transacciones, setTransacciones] = useState(initialTransacciones)
  const [filter, setFilter] = useState("todos")
  const [isTransaccionDialogOpen, setIsTransaccionDialogOpen] = useState(false)
  const [isVentaCreditoDialogOpen, setIsVentaCreditoDialogOpen] = useState(false)
  const [isReciboPagoDialogOpen, setIsReciboPagoDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [transaccionForm, setTransaccionForm] = useState({
    tipo: "INGRESO",
    monto: "",
    categoria: "",
    apartamentoId: "",
    fecha: new Date().toISOString().split("T")[0],
    metodoPago: "EFECTIVO",
    descripcion: "",
    referencia: "",
    notas: "",
  })

  const [ventaCreditoForm, setVentaCreditoForm] = useState({
    monto: "",
    apartamentoId: "",
    fecha: new Date().toISOString().split("T")[0],
    descripcion: "Gastos Comunes",
    notas: "",
  })

  const [reciboPagoForm, setReciboPagoForm] = useState({
    monto: "",
    apartamentoId: "",
    fecha: new Date().toISOString().split("T")[0],
    metodoPago: "EFECTIVO",
    referencia: "",
    notas: "",
  })

  const filteredTransacciones = transacciones.filter((t) => {
    if (filter === "todos") return true
    if (filter === "ingresos") return t.tipo === "INGRESO" || t.tipo === "RECIBO_PAGO"
    if (filter === "egresos") return t.tipo === "EGRESO"
    if (filter === "creditos") return t.tipo === "VENTA_CREDITO"
    return true
  })

  const ingresos = transacciones
    .filter((t) => t.tipo === "INGRESO" || t.tipo === "RECIBO_PAGO")
    .reduce((acc, t) => acc + t.monto, 0)

  const egresos = transacciones
    .filter((t) => t.tipo === "EGRESO")
    .reduce((acc, t) => acc + t.monto, 0)

  const creditosPendientes = transacciones
    .filter((t) => t.tipo === "VENTA_CREDITO" && t.estadoCredito !== "PAGADO")
    .reduce((acc, t) => acc + (t.monto - (t.montoPagado || 0)), 0)

  const balance = ingresos - egresos

  const resetTransaccionForm = () => {
    setTransaccionForm({
      tipo: "INGRESO",
      monto: "",
      categoria: "",
      apartamentoId: "",
      fecha: new Date().toISOString().split("T")[0],
      metodoPago: "EFECTIVO",
      descripcion: "",
      referencia: "",
      notas: "",
    })
  }

  const handleTransaccionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const data = {
        tipo: transaccionForm.tipo as "INGRESO" | "EGRESO",
        monto: parseFloat(transaccionForm.monto),
        categoria: transaccionForm.categoria || null,
        apartamentoId: transaccionForm.apartamentoId || null,
        fecha: new Date(transaccionForm.fecha),
        metodoPago: transaccionForm.metodoPago,
        descripcion: transaccionForm.descripcion || null,
        referencia: transaccionForm.referencia || null,
        notas: transaccionForm.notas || null,
      }

      const created = await createTransaccion(data)
      setTransacciones((prev) => [created, ...prev])
      setIsTransaccionDialogOpen(false)
      resetTransaccionForm()
    } catch (error) {
      console.error("Error creating transaccion:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVentaCreditoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const data = {
        monto: parseFloat(ventaCreditoForm.monto),
        apartamentoId: ventaCreditoForm.apartamentoId,
        fecha: new Date(ventaCreditoForm.fecha),
        descripcion: ventaCreditoForm.descripcion || "Gastos Comunes",
        notas: ventaCreditoForm.notas || null,
      }

      const created = await createVentaCredito(data)
      setTransacciones((prev) => [created, ...prev])
      setIsVentaCreditoDialogOpen(false)
      setVentaCreditoForm({
        monto: "",
        apartamentoId: "",
        fecha: new Date().toISOString().split("T")[0],
        descripcion: "Gastos Comunes",
        notas: "",
      })
    } catch (error) {
      console.error("Error creating venta credito:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReciboPagoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const data = {
        monto: parseFloat(reciboPagoForm.monto),
        apartamentoId: reciboPagoForm.apartamentoId,
        fecha: new Date(reciboPagoForm.fecha),
        metodoPago: reciboPagoForm.metodoPago,
        referencia: reciboPagoForm.referencia || null,
        notas: reciboPagoForm.notas || null,
      }

      const created = await createReciboPago(data)
      setTransacciones((prev) => [created, ...prev])
      setIsReciboPagoDialogOpen(false)
      setReciboPagoForm({
        monto: "",
        apartamentoId: "",
        fecha: new Date().toISOString().split("T")[0],
        metodoPago: "EFECTIVO",
        referencia: "",
        notas: "",
      })
    } catch (error) {
      console.error("Error creating recibo pago:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = () => {
    generateTransaccionesPDF(filteredTransacciones)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Transacciones</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Ingresos</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(ingresos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Egresos</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(egresos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Créditos Pendientes</p>
            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(creditosPendientes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Balance</p>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ingresos">Ingresos</SelectItem>
              <SelectItem value="egresos">Egresos</SelectItem>
              <SelectItem value="creditos">Créditos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1" />

        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
        <Button variant="outline" onClick={() => setIsVentaCreditoDialogOpen(true)}>
          <CreditCard className="h-4 w-4 mr-2" />
          Venta Crédito
        </Button>
        <Button variant="outline" onClick={() => setIsReciboPagoDialogOpen(true)}>
          <Receipt className="h-4 w-4 mr-2" />
          Recibo de Pago
        </Button>
        <Button onClick={() => setIsTransaccionDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Transacción
        </Button>
      </div>

      {/* Transactions List */}
      <Card>
        <CardContent className="p-0">
          {filteredTransacciones.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay transacciones registradas</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTransacciones.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      t.tipo === "EGRESO" ? "bg-red-50" : "bg-green-50"
                    }`}>
                      {t.tipo === "EGRESO" ? (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      ) : (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">
                          {tipoLabels[t.tipo]}
                        </p>
                        {t.tipo === "VENTA_CREDITO" && t.estadoCredito && (
                          <Badge variant={estadoCreditoColors[t.estadoCredito]}>
                            {t.estadoCredito === "PAGADO" ? "Pagado" : t.estadoCredito === "PARCIAL" ? "Parcial" : "Pendiente"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {formatDate(t.fecha)} • {t.apartamento ? `Apto ${t.apartamento.numero}` : "General"} • {t.descripcion || `${tipoLabels[t.tipo]} - ${t.categoria ? categoriaLabels[t.categoria] : "Sin categoría"}`}
                      </p>
                    </div>
                  </div>
                  <p className={`font-semibold ${
                    t.tipo === "EGRESO" ? "text-red-600" : "text-green-600"
                  }`}>
                    {t.tipo === "EGRESO" ? "-" : "+"}{formatCurrency(t.monto)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nueva Transacción Dialog */}
      <Dialog open={isTransaccionDialogOpen} onOpenChange={setIsTransaccionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Transacción</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransaccionSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={transaccionForm.tipo}
                  onValueChange={(value) => setTransaccionForm({ ...transaccionForm, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INGRESO">Ingreso</SelectItem>
                    <SelectItem value="EGRESO">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={transaccionForm.monto}
                  onChange={(e) => setTransaccionForm({ ...transaccionForm, monto: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={transaccionForm.categoria}
                  onValueChange={(value) => setTransaccionForm({ ...transaccionForm, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GASTOS_COMUNES">Gastos Comunes</SelectItem>
                    <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
                    <SelectItem value="SERVICIOS">Servicios</SelectItem>
                    <SelectItem value="ADMINISTRACION">Administración</SelectItem>
                    <SelectItem value="REPARACIONES">Reparaciones</SelectItem>
                    <SelectItem value="LIMPIEZA">Limpieza</SelectItem>
                    <SelectItem value="SEGURIDAD">Seguridad</SelectItem>
                    <SelectItem value="OTROS">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Apartamento</Label>
                <Select
                  value={transaccionForm.apartamentoId}
                  onValueChange={(value) => setTransaccionForm({ ...transaccionForm, apartamentoId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="General" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">General</SelectItem>
                    {apartamentos.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        Apto {apt.numero}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={transaccionForm.fecha}
                  onChange={(e) => setTransaccionForm({ ...transaccionForm, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select
                  value={transaccionForm.metodoPago}
                  onValueChange={(value) => setTransaccionForm({ ...transaccionForm, metodoPago: value })}
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

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Descripción breve"
                value={transaccionForm.descripcion}
                onChange={(e) => setTransaccionForm({ ...transaccionForm, descripcion: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Número de referencia</Label>
              <Input
                placeholder="Ej: Factura #123"
                value={transaccionForm.referencia}
                onChange={(e) => setTransaccionForm({ ...transaccionForm, referencia: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={transaccionForm.notas}
                onChange={(e) => setTransaccionForm({ ...transaccionForm, notas: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTransaccionDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Registrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Venta Crédito Dialog */}
      <Dialog open={isVentaCreditoDialogOpen} onOpenChange={setIsVentaCreditoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Venta a Crédito</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVentaCreditoSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={ventaCreditoForm.monto}
                  onChange={(e) => setVentaCreditoForm({ ...ventaCreditoForm, monto: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Apartamento *</Label>
                <Select
                  value={ventaCreditoForm.apartamentoId}
                  onValueChange={(value) => setVentaCreditoForm({ ...ventaCreditoForm, apartamentoId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {apartamentos.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        Apto {apt.numero}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={ventaCreditoForm.fecha}
                onChange={(e) => setVentaCreditoForm({ ...ventaCreditoForm, fecha: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Ej: Gastos Comunes Enero 2026"
                value={ventaCreditoForm.descripcion}
                onChange={(e) => setVentaCreditoForm({ ...ventaCreditoForm, descripcion: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={ventaCreditoForm.notas}
                onChange={(e) => setVentaCreditoForm({ ...ventaCreditoForm, notas: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVentaCreditoDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Registrar Crédito"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recibo de Pago Dialog */}
      <Dialog open={isReciboPagoDialogOpen} onOpenChange={setIsReciboPagoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Recibo de Pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReciboPagoSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={reciboPagoForm.monto}
                  onChange={(e) => setReciboPagoForm({ ...reciboPagoForm, monto: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Apartamento *</Label>
                <Select
                  value={reciboPagoForm.apartamentoId}
                  onValueChange={(value) => setReciboPagoForm({ ...reciboPagoForm, apartamentoId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {apartamentos.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        Apto {apt.numero}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={reciboPagoForm.fecha}
                  onChange={(e) => setReciboPagoForm({ ...reciboPagoForm, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select
                  value={reciboPagoForm.metodoPago}
                  onValueChange={(value) => setReciboPagoForm({ ...reciboPagoForm, metodoPago: value })}
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

            <div className="space-y-2">
              <Label>Número de referencia</Label>
              <Input
                placeholder="Ej: Transferencia #456"
                value={reciboPagoForm.referencia}
                onChange={(e) => setReciboPagoForm({ ...reciboPagoForm, referencia: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={reciboPagoForm.notas}
                onChange={(e) => setReciboPagoForm({ ...reciboPagoForm, notas: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReciboPagoDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Registrar Pago"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
