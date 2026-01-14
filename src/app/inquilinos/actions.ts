"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

type InquilinoInput = {
  nombre: string
  apellido: string
  cedula: string | null
  email: string | null
  telefono: string | null
  tipo: "PROPIETARIO" | "INQUILINO"
  activo: boolean
  apartamentoId: string | null
  notas: string | null
}

export async function createInquilino(data: InquilinoInput) {
  const inquilino = await prisma.inquilino.create({
    data: {
      nombre: data.nombre,
      apellido: data.apellido,
      cedula: data.cedula,
      email: data.email,
      telefono: data.telefono,
      tipo: data.tipo,
      activo: data.activo,
      apartamentoId: data.apartamentoId,
      notas: data.notas,
    },
    include: { apartamento: true },
  })

  revalidatePath("/inquilinos")
  revalidatePath("/")
  return inquilino
}

export async function updateInquilino(id: string, data: InquilinoInput) {
  const inquilino = await prisma.inquilino.update({
    where: { id },
    data: {
      nombre: data.nombre,
      apellido: data.apellido,
      cedula: data.cedula,
      email: data.email,
      telefono: data.telefono,
      tipo: data.tipo,
      activo: data.activo,
      apartamentoId: data.apartamentoId,
      notas: data.notas,
    },
    include: { apartamento: true },
  })

  revalidatePath("/inquilinos")
  revalidatePath("/")
  return inquilino
}

export async function deleteInquilino(id: string) {
  await prisma.inquilino.delete({
    where: { id },
  })

  revalidatePath("/inquilinos")
  revalidatePath("/")
}
