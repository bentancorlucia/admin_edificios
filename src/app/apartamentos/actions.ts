"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

type ApartamentoInput = {
  numero: string
  piso: number | null
  metrosCuadrados: number | null
  habitaciones: number
  banos: number
  estado: "DISPONIBLE" | "OCUPADO" | "MANTENIMIENTO"
  cuotaMensual: number
  celular: string | null
  email: string | null
  notas: string | null
}

export async function createApartamento(data: ApartamentoInput) {
  const apartamento = await prisma.apartamento.create({
    data: {
      numero: data.numero,
      piso: data.piso,
      metrosCuadrados: data.metrosCuadrados,
      habitaciones: data.habitaciones,
      banos: data.banos,
      estado: data.estado,
      cuotaMensual: data.cuotaMensual,
      celular: data.celular,
      email: data.email,
      notas: data.notas,
    },
  })

  revalidatePath("/apartamentos")
  revalidatePath("/")
  return apartamento
}

export async function updateApartamento(id: string, data: ApartamentoInput) {
  const apartamento = await prisma.apartamento.update({
    where: { id },
    data: {
      numero: data.numero,
      piso: data.piso,
      metrosCuadrados: data.metrosCuadrados,
      habitaciones: data.habitaciones,
      banos: data.banos,
      estado: data.estado,
      cuotaMensual: data.cuotaMensual,
      celular: data.celular,
      email: data.email,
      notas: data.notas,
    },
  })

  revalidatePath("/apartamentos")
  revalidatePath("/")
  return apartamento
}

export async function deleteApartamento(id: string) {
  await prisma.apartamento.delete({
    where: { id },
  })

  revalidatePath("/apartamentos")
  revalidatePath("/")
}
