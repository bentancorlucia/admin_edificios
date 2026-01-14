import { prisma } from "@/lib/prisma"
import { InquilinosClient } from "./inquilinos-client"

async function getData() {
  try {
    const [inquilinos, apartamentos] = await Promise.all([
      prisma.inquilino.findMany({
        include: { apartamento: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.apartamento.findMany({
        orderBy: { numero: 'asc' },
      }),
    ])
    return { inquilinos, apartamentos }
  } catch {
    return { inquilinos: [], apartamentos: [] }
  }
}

export default async function InquilinosPage() {
  const { inquilinos, apartamentos } = await getData()

  return <InquilinosClient initialInquilinos={inquilinos} apartamentos={apartamentos} />
}
