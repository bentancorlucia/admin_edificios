import { prisma } from "@/lib/prisma"
import { BitacoraClient } from "./bitacora-client"

async function getRegistros() {
  try {
    return await prisma.registro.findMany({
      orderBy: { fecha: 'desc' },
    })
  } catch {
    return []
  }
}

export default async function BitacoraPage() {
  const registros = await getRegistros()

  return <BitacoraClient initialRegistros={registros} />
}
