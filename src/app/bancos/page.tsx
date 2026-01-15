import { prisma } from "@/lib/prisma"
import { BancosClient } from "./bancos-client"

async function getCuentasBancarias() {
  try {
    const cuentas = await prisma.cuentaBancaria.findMany({
      orderBy: { banco: "asc" },
      include: {
        movimientos: {
          orderBy: { fecha: "desc" },
          include: {
            servicio: {
              select: {
                id: true,
                nombre: true,
                tipo: true,
              },
            },
          },
        },
      },
    })
    return cuentas
  } catch {
    return []
  }
}

async function getRecibosNoVinculados() {
  try {
    const recibos = await prisma.transaccion.findMany({
      where: {
        tipo: "RECIBO_PAGO",
        movimientoBancario: null,
      },
      include: {
        apartamento: {
          select: {
            numero: true,
            tipoOcupacion: true,
          },
        },
      },
      orderBy: { fecha: "desc" },
    })
    return recibos
  } catch {
    return []
  }
}

async function getServicios() {
  try {
    const servicios = await prisma.servicio.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    })
    return servicios
  } catch {
    return []
  }
}

export default async function BancosPage() {
  const [cuentas, recibosNoVinculados, servicios] = await Promise.all([
    getCuentasBancarias(),
    getRecibosNoVinculados(),
    getServicios(),
  ])

  return (
    <BancosClient
      initialCuentas={cuentas}
      recibosNoVinculados={recibosNoVinculados}
      servicios={servicios}
    />
  )
}
