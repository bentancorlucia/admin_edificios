import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, Users, TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

async function getDashboardData() {
  try {
    const [apartamentos, inquilinos, transacciones] = await Promise.all([
      prisma.apartamento.findMany(),
      prisma.inquilino.findMany({ where: { activo: true } }),
      prisma.transaccion.findMany({
        include: { apartamento: true },
        orderBy: { fecha: 'desc' },
        take: 10,
      }),
    ])

    const ingresos = transacciones
      .filter(t => t.tipo === 'INGRESO' || t.tipo === 'RECIBO_PAGO')
      .reduce((acc, t) => acc + t.monto, 0)

    const egresos = transacciones
      .filter(t => t.tipo === 'EGRESO')
      .reduce((acc, t) => acc + t.monto, 0)

    const creditosPendientes = transacciones
      .filter(t => t.tipo === 'VENTA_CREDITO' && t.estadoCredito !== 'PAGADO')
      .reduce((acc, t) => acc + (t.monto - (t.montoPagado || 0)), 0)

    const balance = ingresos - egresos

    return {
      totalApartamentos: apartamentos.length,
      inquilinosActivos: inquilinos.length,
      ingresos,
      egresos,
      balance,
      creditosPendientes,
      transaccionesRecientes: transacciones,
    }
  } catch {
    return {
      totalApartamentos: 0,
      inquilinosActivos: 0,
      ingresos: 0,
      egresos: 0,
      balance: 0,
      creditosPendientes: 0,
      transaccionesRecientes: [],
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Apartamentos</p>
                <p className="text-3xl font-bold text-slate-900">{data.totalApartamentos}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Inquilinos Activos</p>
                <p className="text-3xl font-bold text-slate-900">{data.inquilinosActivos}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ingresos Totales</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(data.ingresos)}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Egresos Totales</p>
                <p className="text-3xl font-bold text-red-600">{formatCurrency(data.egresos)}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Balance Actual</p>
              <p className={`text-3xl font-bold ${data.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.balance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
