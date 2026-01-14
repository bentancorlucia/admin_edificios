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

export default async function ApartamentosPage() {
  const apartamentos = await getApartamentos()

  return <ApartamentosClient initialApartamentos={apartamentos} />
}
