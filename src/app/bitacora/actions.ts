"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

type TipoRegistro =
  | "NOVEDAD"
  | "VENCIMIENTO"
  | "MANTENIMIENTO"
  | "REUNION"
  | "INCIDENTE"
  | "RECORDATORIO"
  | "OTRO"

type SituacionRegistro =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "REALIZADO"
  | "CANCELADO"
  | "VENCIDO"

type RegistroInput = {
  fecha: Date
  tipo: TipoRegistro
  detalle: string
  observaciones: string | null
  situacion: SituacionRegistro
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

type RegistroResponse = {
  id: string
  fecha: Date
  tipo: TipoRegistro
  detalle: string
  observaciones: string | null
  situacion: SituacionRegistro
}

export async function createRegistro(data: RegistroInput): Promise<ActionResult<RegistroResponse>> {
  try {
    const registro = await prisma.registro.create({
      data: {
        fecha: data.fecha,
        tipo: data.tipo,
        detalle: data.detalle,
        observaciones: data.observaciones,
        situacion: data.situacion,
      },
    })

    revalidatePath("/bitacora")
    return { success: true, data: registro }
  } catch (error) {
    console.error("Error creating registro:", error)
    return { success: false, error: "Error al crear el registro. Verifica la conexión a la base de datos." }
  }
}

export async function updateRegistro(id: string, data: RegistroInput): Promise<ActionResult<RegistroResponse>> {
  try {
    const registro = await prisma.registro.update({
      where: { id },
      data: {
        fecha: data.fecha,
        tipo: data.tipo,
        detalle: data.detalle,
        observaciones: data.observaciones,
        situacion: data.situacion,
      },
    })

    revalidatePath("/bitacora")
    return { success: true, data: registro }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "El registro no fue encontrado" }
      }
    }
    console.error("Error updating registro:", error)
    return { success: false, error: "Error al actualizar el registro" }
  }
}

export async function deleteRegistro(id: string): Promise<ActionResult<null>> {
  try {
    await prisma.registro.delete({
      where: { id },
    })

    revalidatePath("/bitacora")
    return { success: true, data: null }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "El registro no fue encontrado" }
      }
    }
    console.error("Error deleting registro:", error)
    return { success: false, error: "Error al eliminar el registro" }
  }
}
