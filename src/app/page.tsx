import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, TrendingUp, TrendingDown, Wallet, User, UserCheck } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { BuildingView } from "@/components/building-view"

async function getDashboardData() {
  try {
    const [apartamentos, todasTransacciones, transaccionesRecientes] = await Promise.all([
      prisma.apartamento.findMany({
        orderBy: [{ piso: 'asc' }, { numero: 'asc' }],
      }),
      // Todas las transacciones para calcular el balance real
      prisma.transaccion.findMany(),
      // Solo las 10 más recientes para mostrar en la lista
      prisma.transaccion.findMany({
        include: { apartamento: true },
        orderBy: { fecha: 'desc' },
        take: 10,
      }),
    ])

    // Contar unidades únicas y tipos
    const unidadesUnicas = new Set(apartamentos.map((a: typeof apartamentos[0]) => a.numero))
    const totalUnidades = unidadesUnicas.size
    const propietariosData = apartamentos.filter((a: typeof apartamentos[0]) => a.tipoOcupacion === 'PROPIETARIO')
    const inquilinosData = apartamentos.filter((a: typeof apartamentos[0]) => a.tipoOcupacion === 'INQUILINO')

    // Contar unidades que tienen ambos registros (P/I)
    const unidadesConAmbos = Array.from(unidadesUnicas).filter(numero => {
      const registros = apartamentos.filter((a: typeof apartamentos[0]) => a.numero === numero)
      return registros.some((r: typeof apartamentos[0]) => r.tipoOcupacion === 'PROPIETARIO') &&
             registros.some((r: typeof apartamentos[0]) => r.tipoOcupacion === 'INQUILINO')
    }).length

    // Calcular gastos totales por tipo
    const gastosPropietarios = propietariosData.reduce((acc: number, a: typeof apartamentos[0]) =>
      acc + a.gastosComunes + a.fondoReserva, 0)
    const gastosInquilinos = inquilinosData.reduce((acc: number, a: typeof apartamentos[0]) =>
      acc + a.gastosComunes + a.fondoReserva, 0)

    // Calcular ingresos usando TODAS las transacciones
    // RECIBO_PAGO = pagos de los propietarios/inquilinos = INGRESO para el edificio
    const ingresos = todasTransacciones
      .filter(t => t.tipo === 'INGRESO' || t.tipo === 'RECIBO_PAGO')
      .reduce((acc, t) => acc + t.monto, 0)

    const egresos = todasTransacciones
      .filter(t => t.tipo === 'EGRESO')
      .reduce((acc, t) => acc + t.monto, 0)

    const creditosPendientes = todasTransacciones
      .filter(t => t.tipo === 'VENTA_CREDITO' && t.estadoCredito !== 'PAGADO')
      .reduce((acc, t) => acc + (t.monto - (t.montoPagado || 0)), 0)

    const balance = ingresos - egresos

    return {
      totalUnidades,
      totalRegistros: apartamentos.length,
      propietarios: propietariosData.length,
      inquilinosRegistrados: inquilinosData.length,
      unidadesConAmbos,
      inquilinosActivos: inquilinosData.length,
      gastosPropietarios,
      gastosInquilinos,
      ingresos,
      egresos,
      balance,
      creditosPendientes,
      transaccionesRecientes: transaccionesRecientes,
      apartamentos,
    }
  } catch {
    return {
      totalUnidades: 0,
      totalRegistros: 0,
      propietarios: 0,
      inquilinosRegistrados: 0,
      unidadesConAmbos: 0,
      inquilinosActivos: 0,
      gastosPropietarios: 0,
      gastosInquilinos: 0,
      ingresos: 0,
      egresos: 0,
      balance: 0,
      creditosPendientes: 0,
      transaccionesRecientes: [],
      apartamentos: [],
    }
  }
}

function getTransactionTypeLabel(tipo: string) {
  switch (tipo) {
    case 'INGRESO': return 'Ingreso'
    case 'EGRESO': return 'Egreso'
    case 'VENTA_CREDITO': return 'Venta Crédito'
    case 'RECIBO_PAGO': return 'Recibo de Pago'
    default: return tipo
  }
}

function getEstadoCreditoBadge(estado: string | null) {
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

export default async function DashboardPage() {
  const data = await getDashboardData()

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
              <div className="text-xs text-slate-600">
                Promedio por unidad: {data.propietarios > 0 ? formatCurrency(data.gastosPropietarios / data.propietarios) : '$0'}
              </div>
            </div>

            {/* Inquilinos */}
            <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-semibold text-purple-700">INQUILINOS ({data.inquilinosRegistrados})</p>
                <span className="text-lg font-bold text-purple-700">{formatCurrency(data.gastosInquilinos)}</span>
              </div>
              <div className="text-xs text-slate-600">
                Promedio por unidad: {data.inquilinosRegistrados > 0 ? formatCurrency(data.gastosInquilinos / data.inquilinosRegistrados) : '$0'}
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
        <BuildingView apartamentos={data.apartamentos} />
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Transacciones Recientes</h2>
          <div className="space-y-4">
            {data.transaccionesRecientes.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay transacciones registradas</p>
            ) : (
              data.transaccionesRecientes.map((transaccion) => (
                <div
                  key={transaccion.id}
                  className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      transaccion.tipo === 'EGRESO' ? 'bg-red-50' : 'bg-green-50'
                    }`}>
                      {transaccion.tipo === 'EGRESO' ? (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      ) : (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">
                          {getTransactionTypeLabel(transaccion.tipo)}
                        </p>
                        {transaccion.tipo === 'VENTA_CREDITO' && getEstadoCreditoBadge(transaccion.estadoCredito)}
                      </div>
                      <p className="text-sm text-slate-500">
                        {formatDate(transaccion.fecha)} • {transaccion.apartamento?.numero ? `Apto ${transaccion.apartamento.numero}` : 'General'} • {transaccion.descripcion || `${getTransactionTypeLabel(transaccion.tipo)} - ${transaccion.categoria || 'Sin categoría'}`}
                      </p>
                    </div>
                  </div>
                  <p className={`font-semibold ${
                    transaccion.tipo === 'EGRESO' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {transaccion.tipo === 'EGRESO' ? '-' : '+'}{formatCurrency(transaccion.monto)}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
