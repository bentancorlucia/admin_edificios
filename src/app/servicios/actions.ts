"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

type TipoServicio =
  | "ELECTRICISTA"
  | "PLOMERO"
  | "SANITARIO"
  | "CERRAJERO"
  | "PINTOR"
  | "CARPINTERO"
  | "ALBANIL"
  | "JARDINERO"
  | "LIMPIEZA"
  | "SEGURIDAD"
  | "FUMIGACION"
  | "ASCENSOR"
  | "VIDRIERIA"
  | "HERRERIA"
  | "AIRE_ACONDICIONADO"
  | "GAS"
  | "OTRO"

type ServicioInput = {
  tipo: TipoServicio
  nombre: string
  celular: string | null
  email: string | null
  observaciones: string | null
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

type ServicioResponse = {
  id: string
  tipo: TipoServicio
  nombre: string
  celular: string | null
  email: string | null
  observaciones: string | null
  activo: boolean
}

export async function createServicio(data: ServicioInput): Promise<ActionResult<ServicioResponse>> {
  try {
    const servicio = await prisma.servicio.create({
      data: {
        tipo: data.tipo,
        nombre: data.nombre,
        celular: data.celular,
        email: data.email,
        observaciones: data.observaciones,
      },
    })

    revalidatePath("/servicios")
    return { success: true, data: servicio }
  } catch (error) {
    console.error("Error creating servicio:", error)
    return { success: false, error: "Error al crear el servicio. Verifica la conexión a la base de datos." }
  }
}

export async function updateServicio(id: string, data: ServicioInput): Promise<ActionResult<ServicioResponse>> {
  try {
    const servicio = await prisma.servicio.update({
      where: { id },
      data: {
        tipo: data.tipo,
        nombre: data.nombre,
        celular: data.celular,
        email: data.email,
        observaciones: data.observaciones,
      },
    })

    revalidatePath("/servicios")
    return { success: true, data: servicio }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "El servicio no fue encontrado" }
      }
    }
    console.error("Error updating servicio:", error)
    return { success: false, error: "Error al actualizar el servicio" }
  }
}

export async function deleteServicio(id: string): Promise<ActionResult<null>> {
  try {
    await prisma.servicio.delete({
      where: { id },
    })

    revalidatePath("/servicios")
    return { success: true, data: null }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "El servicio no fue encontrado" }
      }
    }
    console.error("Error deleting servicio:", error)
    return { success: false, error: "Error al eliminar el servicio" }
  }
}
