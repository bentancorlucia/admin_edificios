"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

type ApartamentoInput = {
  numero: string
  piso: number | null
  tipoOcupacion: "PROPIETARIO" | "INQUILINO"
  gastosComunes: number
  fondoReserva: number
  contactoNombre: string | null
  contactoApellido: string | null
  contactoCelular: string | null
  contactoEmail: string | null
  notas: string | null
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

type ApartamentoResponse = {
  id: string
  numero: string
  piso: number | null
  alicuota: number
  gastosComunes: number
  fondoReserva: number
  tipoOcupacion: "PROPIETARIO" | "INQUILINO"
  contactoNombre: string | null
  contactoApellido: string | null
  contactoCelular: string | null
  contactoEmail: string | null
  notas: string | null
}

export async function createApartamento(data: ApartamentoInput): Promise<ActionResult<ApartamentoResponse>> {
  try {
    const apartamento = await prisma.apartamento.create({
      data: {
        numero: data.numero,
        piso: data.piso,
        tipoOcupacion: data.tipoOcupacion,
        gastosComunes: data.gastosComunes,
        fondoReserva: data.fondoReserva,
        contactoNombre: data.contactoNombre,
        contactoApellido: data.contactoApellido,
        contactoCelular: data.contactoCelular,
        contactoEmail: data.contactoEmail,
        notas: data.notas,
      },
    })

    revalidatePath("/apartamentos")
    revalidatePath("/")
    return { success: true, data: apartamento }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { success: false, error: "Ya existe un registro de este tipo para ese apartamento" }
      }
    }
    console.error("Error creating apartamento:", error)
    return { success: false, error: "Error al crear el apartamento. Verifica la conexión a la base de datos." }
  }
}

export async function updateApartamento(id: string, data: ApartamentoInput): Promise<ActionResult<ApartamentoResponse>> {
  try {
    const apartamento = await prisma.apartamento.update({
      where: { id },
      data: {
        numero: data.numero,
        piso: data.piso,
        tipoOcupacion: data.tipoOcupacion,
        gastosComunes: data.gastosComunes,
        fondoReserva: data.fondoReserva,
        contactoNombre: data.contactoNombre,
        contactoApellido: data.contactoApellido,
        contactoCelular: data.contactoCelular,
        contactoEmail: data.contactoEmail,
        notas: data.notas,
      },
    })

    revalidatePath("/apartamentos")
    revalidatePath("/")
    return { success: true, data: apartamento }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { success: false, error: "Ya existe un registro de este tipo para ese apartamento" }
      }
      if (error.code === "P2025") {
        return { success: false, error: "El apartamento no fue encontrado" }
      }
    }
    console.error("Error updating apartamento:", error)
    return { success: false, error: "Error al actualizar el apartamento" }
  }
}

export async function deleteApartamento(id: string): Promise<ActionResult<null>> {
  try {
    await prisma.apartamento.delete({
      where: { id },
    })

    revalidatePath("/apartamentos")
    revalidatePath("/")
    return { success: true, data: null }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "El apartamento no fue encontrado" }
      }
    }
    console.error("Error deleting apartamento:", error)
    return { success: false, error: "Error al eliminar el apartamento" }
  }
}

export async function generarTransaccionesMensuales(): Promise<ActionResult<{ creadas: number; mes: string }>> {
  try {
    const ahora = new Date()
    const mesActual = ahora.toLocaleString('es', { month: 'long', year: 'numeric' })
    const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    const ultimoDiaMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59)

    // Obtener todos los apartamentos
    const apartamentos = await prisma.apartamento.findMany()

    if (apartamentos.length === 0) {
      return { success: false, error: "No hay apartamentos registrados" }
    }

    let transaccionesCreadas = 0

    for (const apt of apartamentos) {
      // Verificar si ya existen transacciones para este mes
      const transaccionesExistentes = await prisma.transaccion.findMany({
        where: {
          apartamentoId: apt.id,
          tipo: "VENTA_CREDITO",
          fecha: {
            gte: primerDiaMes,
            lte: ultimoDiaMes,
          },
          categoria: {
            in: ["GASTOS_COMUNES", "FONDO_RESERVA"],
          },
        },
      })

      const tieneGastosComunes = transaccionesExistentes.some((t: { categoria: string | null }) => t.categoria === "GASTOS_COMUNES")
      const tieneFondoReserva = transaccionesExistentes.some((t: { categoria: string | null }) => t.categoria === "FONDO_RESERVA")

      // Crear transacción de Gastos Comunes si aplica
      if (!tieneGastosComunes && apt.gastosComunes > 0) {
        await prisma.transaccion.create({
          data: {
            tipo: "VENTA_CREDITO",
            monto: apt.gastosComunes,
            fecha: ahora,
            categoria: "GASTOS_COMUNES",
            descripcion: `Gastos Comunes - ${mesActual}`,
            estadoCredito: "PENDIENTE",
            montoPagado: 0,
            apartamentoId: apt.id,
          },
        })
        transaccionesCreadas++
      }

      // Crear transacción de Fondo de Reserva si aplica
      if (!tieneFondoReserva && apt.fondoReserva > 0) {
        await prisma.transaccion.create({
          data: {
            tipo: "VENTA_CREDITO",
            monto: apt.fondoReserva,
            fecha: ahora,
            categoria: "FONDO_RESERVA",
            descripcion: `Fondo de Reserva - ${mesActual}`,
            estadoCredito: "PENDIENTE",
            montoPagado: 0,
            apartamentoId: apt.id,
          },
        })
        transaccionesCreadas++
      }
    }

    if (transaccionesCreadas === 0) {
      return { success: false, error: `Ya se generaron las transacciones para ${mesActual}` }
    }

    revalidatePath("/apartamentos")
    revalidatePath("/")
    return { success: true, data: { creadas: transaccionesCreadas, mes: mesActual } }
  } catch (error) {
    console.error("Error generando transacciones:", error)
    return { success: false, error: "Error al generar las transacciones" }
  }
}

export async function obtenerSaldosCuentaCorriente(): Promise<ActionResult<Record<string, number>>> {
  try {
    const apartamentos = await prisma.apartamento.findMany({
      include: {
        transacciones: true,
      },
    })

    const saldos: Record<string, number> = {}

    for (const apt of apartamentos) {
      let saldo = 0
      for (const trans of apt.transacciones) {
        if (trans.tipo === "VENTA_CREDITO") {
          // Cargo (solo el monto pendiente = monto - montoPagado)
          // montoPagado se actualiza cuando se crea un RECIBO_PAGO
          saldo += trans.monto - (trans.montoPagado || 0)
        }
        // RECIBO_PAGO ya está reflejado en montoPagado de VENTA_CREDITO
        // No se resta aquí para evitar doble conteo
      }
      saldos[apt.id] = saldo
    }

    return { success: true, data: saldos }
  } catch (error) {
    console.error("Error obteniendo saldos:", error)
    return { success: false, error: "Error al obtener los saldos" }
  }
}
