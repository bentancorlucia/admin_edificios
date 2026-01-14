import { prisma } from "@/lib/prisma"
import { TransaccionesClient } from "./transacciones-client"

async function getData() {
  try {
    const [transacciones, apartamentos] = await Promise.all([
      prisma.transaccion.findMany({
        include: { apartamento: true },
        orderBy: { fecha: 'desc' },
      }),
      prisma.apartamento.findMany({
        orderBy: { numero: 'asc' },
      }),
    ])
    return { transacciones, apartamentos }
  } catch {
    return { transacciones: [], apartamentos: [] }
  }
}

export default async function TransaccionesPage() {
  const { transacciones, apartamentos } = await getData()

  return <TransaccionesClient initialTransacciones={transacciones} apartamentos={apartamentos} />
}
