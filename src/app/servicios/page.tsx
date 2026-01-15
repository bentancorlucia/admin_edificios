import { prisma } from "@/lib/prisma"
import { ServiciosClient } from "./servicios-client"

async function getServicios() {
  try {
    return await prisma.servicio.findMany({
      orderBy: { nombre: 'asc' },
    })
  } catch {
    return []
  }
}

export default async function ServiciosPage() {
  const servicios = await getServicios()

  return <ServiciosClient initialServicios={servicios} />
}
