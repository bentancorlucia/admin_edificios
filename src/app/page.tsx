"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, TrendingUp, TrendingDown, Wallet, User, UserCheck, CreditCard, Receipt, Calendar } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { BuildingView } from "@/components/building-view"
import {
  getDashboardData,
  type DashboardData,
  type TransaccionConApartamento,
} from "@/lib/database"

// Memoizar funciones de utilidad fuera del componente
const getTransactionTypeLabel = (tipo: string) => {
  switch (tipo) {
    case 'INGRESO': return 'Ingreso'
    case 'EGRESO': return 'Egreso'
    case 'VENTA_CREDITO': return 'Venta Crédito'
    case 'RECIBO_PAGO': return 'Recibo de Pago'
    default: return tipo
  }
}

const getEstadoCreditoBadge = (estado: string | null) => {
  switch (estado) {
    case 'PAGADO':
      return <Badge variant="success">Pagado</Badge>
    case 'PARCIAL':
      return <Badge variant="warning">Parcial</Badge>
    case 'PENDIENTE':
      return <Badge variant="destructive">Pendiente</Badge>
    default:
      return null
  }
}

// Componente de skeleton para carga
function DashboardSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="h-8 w-32 bg-slate-200 rounded mb-6"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-200 rounded-lg"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-lg"></div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const dashboardData = await getDashboardData()
        if (isMounted) {
          setData(dashboardData)
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }
    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading || !data) {
    return <DashboardSkeleton />
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      {/* Stats Cards - Fila 1: Unidades */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Unidades</p>
                <p className="text-2xl font-bold text-slate-900">{data.totalUnidades}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Propietarios */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 uppercase tracking-wide">Propietarios</p>
                <p className="text-2xl font-bold text-slate-900">{data.propietarios}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Gastos: {formatCurrency(data.gastosPropietarios)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inquilinos */}
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 uppercase tracking-wide">Inquilinos</p>
                <p className="text-2xl font-bold text-slate-900">{data.inquilinosRegistrados}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Gastos: {formatCurrency(data.gastosInquilinos)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards - Fila 2: Finanzas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Ingresos</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(data.ingresos)}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Egresos</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(data.egresos)}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Balance</p>
                <p className={`text-xl font-bold ${data.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(data.balance)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de Gastos por Tipo */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Gastos Mensuales por Tipo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Propietarios */}
            <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-semibold text-blue-700">PROPIETARIOS ({data.propietarios})</p>
                <span className="text-lg font-bold text-blue-700">{formatCurrency(data.gastosPropietarios)}</span>
              </div>
            </div>

            {/* Inquilinos */}
            <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-semibold text-purple-700">INQUILINOS ({data.inquilinosRegistrados})</p>
                <span className="text-lg font-bold text-purple-700">{formatCurrency(data.gastosInquilinos)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <p className="text-sm text-slate-600">Total Gastos Mensuales</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(data.gastosPropietarios + data.gastosInquilinos)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Building View */}
      <div className="mb-6">
        <BuildingView apartamentos={data.apartamentos} saldos={data.saldos} />
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardContent className="p-0">
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold text-slate-900">Transacciones Recientes</h2>
          </div>
          {data.transaccionesRecientes.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay transacciones registradas</p>
            </div>
          ) : (
            <div className="divide-y">
              {data.transaccionesRecientes.map((transaccion: TransaccionConApartamento) => (
                <div
                  key={transaccion.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      transaccion.tipo === 'EGRESO' ? 'bg-red-50' :
                      transaccion.tipo === 'VENTA_CREDITO' ? 'bg-amber-50' : 'bg-green-50'
                    }`}>
                      {transaccion.tipo === 'EGRESO' ? (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      ) : transaccion.tipo === 'VENTA_CREDITO' ? (
                        <CreditCard className="h-5 w-5 text-amber-600" />
                      ) : transaccion.tipo === 'RECIBO_PAGO' ? (
                        <Receipt className="h-5 w-5 text-green-600" />
                      ) : (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900">
                          {getTransactionTypeLabel(transaccion.tipo)}
                        </p>
                        {transaccion.tipo === 'VENTA_CREDITO' && getEstadoCreditoBadge(transaccion.estadoCredito)}
                        {transaccion.tipo === 'RECIBO_PAGO' && transaccion.clasificacionPago && (
                          <Badge variant="outline" className={
                            transaccion.clasificacionPago === 'GASTO_COMUN'
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-purple-200 bg-purple-50 text-purple-700'
                          }>
                            {transaccion.clasificacionPago === 'GASTO_COMUN' ? 'Gasto Común' : 'Fondo Reserva'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(transaccion.fecha)}
                        </span>
                        <span>•</span>
                        <span>{transaccion.apartamento?.numero ? `Apto ${transaccion.apartamento.numero}` : 'General'}</span>
                        {transaccion.descripcion && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{transaccion.descripcion}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className={`font-semibold ${
                    transaccion.tipo === 'EGRESO' ? 'text-red-600' :
                    transaccion.tipo === 'VENTA_CREDITO' ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {transaccion.tipo === 'EGRESO' ? '-' : '+'}{formatCurrency(transaccion.monto)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
