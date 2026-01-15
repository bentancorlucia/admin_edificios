import { prisma } from "@/lib/prisma"
import { ApartamentosClient } from "./apartamentos-client"

async function getApartamentos() {
  try {
    return await prisma.apartamento.findMany({
      orderBy: { numero: 'asc' },
    })
  } catch {
    return []
  }
}

async function getSaldosCuentaCorriente(): Promise<Record<string, number>> {
  try {
    const apartamentos = await prisma.apartamento.findMany({
      include: {
        transacciones: true,
      },
    })

    const saldos: Record<string, number> = {}

    for (const apt of apartamentos) {
      let saldo = 0
      for (const trans of apt.transacciones) {
        if (trans.tipo === "VENTA_CREDITO") {
          // Cargo (solo el monto pendiente = monto - montoPagado)
          // montoPagado se actualiza cuando se crea un RECIBO_PAGO
          saldo += trans.monto - (trans.montoPagado || 0)
        }
        // RECIBO_PAGO ya está reflejado en montoPagado de VENTA_CREDITO
        // No se resta aquí para evitar doble conteo
      }
      saldos[apt.id] = saldo
    }

    return saldos
  } catch {
    return {}
  }
}

export default async function ApartamentosPage() {
  const [apartamentos, saldos] = await Promise.all([
    getApartamentos(),
    getSaldosCuentaCorriente(),
  ])

  return <ApartamentosClient initialApartamentos={apartamentos} initialSaldos={saldos} />
}
