import { prisma } from "@/lib/prisma"
import { TransaccionesClient } from "./transacciones-client"

async function getData() {
  try {
    const [transacciones, apartamentos, cuentasBancarias] = await Promise.all([
      prisma.transaccion.findMany({
        include: { apartamento: true },
        orderBy: { fecha: 'desc' },
      }),
      prisma.apartamento.findMany({
        orderBy: { numero: 'asc' },
      }),
      prisma.cuentaBancaria.findMany({
        where: { activa: true },
        orderBy: { banco: 'asc' },
      }),
    ])
    return { transacciones, apartamentos, cuentasBancarias }
  } catch {
    return { transacciones: [], apartamentos: [], cuentasBancarias: [] }
  }
}

export default async function TransaccionesPage() {
  const { transacciones, apartamentos, cuentasBancarias } = await getData()

  return (
    <TransaccionesClient
      initialTransacciones={transacciones}
      apartamentos={apartamentos}
      cuentasBancarias={cuentasBancarias}
    />
  )
}
