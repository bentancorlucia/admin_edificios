"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ==================== CUENTAS BANCARIAS ====================

type CuentaBancariaInput = {
  banco: string
  tipoCuenta: string
  numeroCuenta: string
  titular: string | null
  saldoInicial: number
}

type CuentaBancariaResponse = {
  id: string
  banco: string
  tipoCuenta: string
  numeroCuenta: string
  titular: string | null
  saldoInicial: number
  activa: boolean
  createdAt: Date
}

export async function getCuentasBancarias() {
  try {
    const cuentas = await prisma.cuentaBancaria.findMany({
      orderBy: { banco: "asc" },
      include: {
        movimientos: {
          orderBy: { fecha: "desc" },
        },
      },
    })
    return cuentas
  } catch {
    return []
  }
}

export async function createCuentaBancaria(
  data: CuentaBancariaInput
): Promise<ActionResult<CuentaBancariaResponse>> {
  try {
    const cuenta = await prisma.cuentaBancaria.create({
      data: {
        banco: data.banco,
        tipoCuenta: data.tipoCuenta,
        numeroCuenta: data.numeroCuenta,
        titular: data.titular,
        saldoInicial: data.saldoInicial,
      },
    })

    revalidatePath("/bancos")
    return { success: true, data: cuenta }
  } catch (error) {
    console.error("Error creating cuenta bancaria:", error)
    return {
      success: false,
      error: "Error al crear la cuenta bancaria. Verifica la conexión.",
    }
  }
}

export async function updateCuentaBancaria(
  id: string,
  data: CuentaBancariaInput
): Promise<ActionResult<CuentaBancariaResponse>> {
  try {
    const cuenta = await prisma.cuentaBancaria.update({
      where: { id },
      data: {
        banco: data.banco,
        tipoCuenta: data.tipoCuenta,
        numeroCuenta: data.numeroCuenta,
        titular: data.titular,
        saldoInicial: data.saldoInicial,
      },
    })

    revalidatePath("/bancos")
    return { success: true, data: cuenta }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "La cuenta bancaria no fue encontrada" }
      }
    }
    console.error("Error updating cuenta bancaria:", error)
    return { success: false, error: "Error al actualizar la cuenta bancaria" }
  }
}

export async function deleteCuentaBancaria(
  id: string
): Promise<ActionResult<null>> {
  try {
    await prisma.cuentaBancaria.delete({
      where: { id },
    })

    revalidatePath("/bancos")
    return { success: true, data: null }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "La cuenta bancaria no fue encontrada" }
      }
    }
    console.error("Error deleting cuenta bancaria:", error)
    return { success: false, error: "Error al eliminar la cuenta bancaria" }
  }
}

// ==================== MOVIMIENTOS BANCARIOS ====================

type TipoMovimiento = "INGRESO" | "EGRESO"

type ClasificacionEgreso = "GASTO_COMUN" | "FONDO_RESERVA"

type MovimientoInput = {
  tipo: TipoMovimiento
  monto: number
  fecha: Date
  descripcion: string
  referencia: string | null
  numeroDocumento: string | null
  archivoUrl: string | null
  clasificacion: ClasificacionEgreso | null
  servicioId: string | null
  cuentaBancariaId: string
  transaccionId?: string | null
}

type MovimientoResponse = {
  id: string
  tipo: TipoMovimiento
  monto: number
  fecha: Date
  descripcion: string
  referencia: string | null
  numeroDocumento: string | null
  archivoUrl: string | null
  clasificacion: ClasificacionEgreso | null
  servicioId: string | null
  conciliado: boolean
  cuentaBancariaId: string
  transaccionId: string | null
  cuentaBancaria: {
    id: string
    banco: string
    numeroCuenta: string
  }
  transaccion?: {
    id: string
    tipo: string
    apartamento?: {
      numero: string
    } | null
  } | null
  servicio?: {
    id: string
    nombre: string
    tipo: string
  } | null
}

export async function getMovimientosBancarios(cuentaId?: string) {
  try {
    const where = cuentaId ? { cuentaBancariaId: cuentaId } : {}
    const movimientos = await prisma.movimientoBancario.findMany({
      where,
      orderBy: { fecha: "desc" },
      include: {
        cuentaBancaria: {
          select: {
            id: true,
            banco: true,
            numeroCuenta: true,
          },
        },
        transaccion: {
          select: {
            id: true,
            tipo: true,
            apartamento: {
              select: {
                numero: true,
              },
            },
          },
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
          },
        },
      },
    })
    return movimientos
  } catch {
    return []
  }
}

export async function getServicios() {
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

export async function createMovimientoBancario(
  data: MovimientoInput
): Promise<ActionResult<MovimientoResponse>> {
  try {
    const movimiento = await prisma.movimientoBancario.create({
      data: {
        tipo: data.tipo,
        monto: data.monto,
        fecha: data.fecha,
        descripcion: data.descripcion,
        referencia: data.referencia,
        numeroDocumento: data.numeroDocumento,
        archivoUrl: data.archivoUrl,
        clasificacion: data.clasificacion,
        servicioId: data.servicioId,
        cuentaBancariaId: data.cuentaBancariaId,
        transaccionId: data.transaccionId || null,
      },
      include: {
        cuentaBancaria: {
          select: {
            id: true,
            banco: true,
            numeroCuenta: true,
          },
        },
        transaccion: {
          select: {
            id: true,
            tipo: true,
            apartamento: {
              select: {
                numero: true,
              },
            },
          },
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
          },
        },
      },
    })

    revalidatePath("/bancos")
    return { success: true, data: movimiento as MovimientoResponse }
  } catch (error) {
    console.error("Error creating movimiento bancario:", error)
    return {
      success: false,
      error: "Error al crear el movimiento bancario.",
    }
  }
}

export async function updateMovimientoBancario(
  id: string,
  data: Partial<MovimientoInput>
): Promise<ActionResult<MovimientoResponse>> {
  try {
    const movimiento = await prisma.movimientoBancario.update({
      where: { id },
      data: {
        tipo: data.tipo,
        monto: data.monto,
        fecha: data.fecha,
        descripcion: data.descripcion,
        referencia: data.referencia,
        numeroDocumento: data.numeroDocumento,
        archivoUrl: data.archivoUrl,
        clasificacion: data.clasificacion,
        servicioId: data.servicioId,
      },
      include: {
        cuentaBancaria: {
          select: {
            id: true,
            banco: true,
            numeroCuenta: true,
          },
        },
        transaccion: {
          select: {
            id: true,
            tipo: true,
            apartamento: {
              select: {
                numero: true,
              },
            },
          },
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
          },
        },
      },
    })

    revalidatePath("/bancos")
    return { success: true, data: movimiento as MovimientoResponse }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "El movimiento no fue encontrado" }
      }
    }
    console.error("Error updating movimiento bancario:", error)
    return { success: false, error: "Error al actualizar el movimiento" }
  }
}

export async function deleteMovimientoBancario(
  id: string
): Promise<ActionResult<null>> {
  try {
    await prisma.movimientoBancario.delete({
      where: { id },
    })

    revalidatePath("/bancos")
    return { success: true, data: null }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "El movimiento no fue encontrado" }
      }
    }
    console.error("Error deleting movimiento bancario:", error)
    return { success: false, error: "Error al eliminar el movimiento" }
  }
}

export async function conciliarMovimiento(
  id: string,
  conciliado: boolean
): Promise<ActionResult<MovimientoResponse>> {
  try {
    const movimiento = await prisma.movimientoBancario.update({
      where: { id },
      data: { conciliado },
      include: {
        cuentaBancaria: {
          select: {
            id: true,
            banco: true,
            numeroCuenta: true,
          },
        },
        transaccion: {
          select: {
            id: true,
            tipo: true,
            apartamento: {
              select: {
                numero: true,
              },
            },
          },
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
          },
        },
      },
    })

    revalidatePath("/bancos")
    return { success: true, data: movimiento as MovimientoResponse }
  } catch (error) {
    console.error("Error conciliando movimiento:", error)
    return { success: false, error: "Error al conciliar el movimiento" }
  }
}

// ==================== ESTADO DE CUENTA ====================

export type EstadoCuentaData = {
  cuenta: {
    id: string
    banco: string
    tipoCuenta: string
    numeroCuenta: string
    titular: string | null
    saldoInicial: number
  }
  movimientos: {
    id: string
    tipo: TipoMovimiento
    monto: number
    fecha: Date
    descripcion: string
    referencia: string | null
    clasificacion: ClasificacionEgreso | null
    saldoAcumulado: number
  }[]
  resumen: {
    saldoInicial: number
    totalIngresos: number
    totalEgresos: number
    saldoFinal: number
  }
}

export async function getEstadoCuenta(
  cuentaId: string,
  fechaInicio?: Date,
  fechaFin?: Date
): Promise<EstadoCuentaData | null> {
  try {
    const cuenta = await prisma.cuentaBancaria.findUnique({
      where: { id: cuentaId },
    })

    if (!cuenta) return null

    const whereClause: Prisma.MovimientoBancarioWhereInput = {
      cuentaBancariaId: cuentaId,
    }

    if (fechaInicio || fechaFin) {
      whereClause.fecha = {}
      if (fechaInicio) whereClause.fecha.gte = fechaInicio
      if (fechaFin) whereClause.fecha.lte = fechaFin
    }

    const movimientos = await prisma.movimientoBancario.findMany({
      where: whereClause,
      orderBy: { fecha: "asc" },
    })

    let saldoAcumulado = cuenta.saldoInicial
    const movimientosConSaldo = movimientos.map((mov) => {
      if (mov.tipo === "INGRESO") {
        saldoAcumulado += mov.monto
      } else {
        saldoAcumulado -= mov.monto
      }
      return {
        id: mov.id,
        tipo: mov.tipo as TipoMovimiento,
        monto: mov.monto,
        fecha: mov.fecha,
        descripcion: mov.descripcion,
        referencia: mov.referencia,
        clasificacion: mov.clasificacion as ClasificacionEgreso | null,
        saldoAcumulado,
      }
    })

    const totalIngresos = movimientos
      .filter((m) => m.tipo === "INGRESO")
      .reduce((sum, m) => sum + m.monto, 0)

    const totalEgresos = movimientos
      .filter((m) => m.tipo === "EGRESO")
      .reduce((sum, m) => sum + m.monto, 0)

    return {
      cuenta: {
        id: cuenta.id,
        banco: cuenta.banco,
        tipoCuenta: cuenta.tipoCuenta,
        numeroCuenta: cuenta.numeroCuenta,
        titular: cuenta.titular,
        saldoInicial: cuenta.saldoInicial,
      },
      movimientos: movimientosConSaldo,
      resumen: {
        saldoInicial: cuenta.saldoInicial,
        totalIngresos,
        totalEgresos,
        saldoFinal: cuenta.saldoInicial + totalIngresos - totalEgresos,
      },
    }
  } catch (error) {
    console.error("Error obteniendo estado de cuenta:", error)
    return null
  }
}

// ==================== VINCULAR RECIBO DE PAGO ====================

export async function vincularReciboConIngreso(
  transaccionId: string,
  cuentaBancariaId: string
): Promise<ActionResult<MovimientoResponse>> {
  try {
    // Obtener la transacción (recibo de pago)
    const transaccion = await prisma.transaccion.findUnique({
      where: { id: transaccionId },
      include: {
        apartamento: {
          select: { numero: true },
        },
      },
    })

    if (!transaccion) {
      return { success: false, error: "Transacción no encontrada" }
    }

    if (transaccion.tipo !== "RECIBO_PAGO") {
      return {
        success: false,
        error: "Solo se pueden vincular recibos de pago",
      }
    }

    // Verificar si ya existe un movimiento vinculado
    const existente = await prisma.movimientoBancario.findUnique({
      where: { transaccionId },
    })

    if (existente) {
      return {
        success: false,
        error: "Este recibo ya está vinculado a un movimiento bancario",
      }
    }

    // Crear el movimiento bancario como ingreso
    const movimiento = await prisma.movimientoBancario.create({
      data: {
        tipo: "INGRESO",
        monto: transaccion.monto,
        fecha: transaccion.fecha,
        descripcion: `Pago Apto ${transaccion.apartamento?.numero || "N/A"} - ${transaccion.descripcion || "Recibo de pago"}`,
        referencia: transaccion.referencia,
        cuentaBancariaId,
        transaccionId,
      },
      include: {
        cuentaBancaria: {
          select: {
            id: true,
            banco: true,
            numeroCuenta: true,
          },
        },
        transaccion: {
          select: {
            id: true,
            tipo: true,
            apartamento: {
              select: {
                numero: true,
              },
            },
          },
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
          },
        },
      },
    })

    revalidatePath("/bancos")
    revalidatePath("/transacciones")
    return { success: true, data: movimiento as MovimientoResponse }
  } catch (error) {
    console.error("Error vinculando recibo con ingreso:", error)
    return { success: false, error: "Error al vincular el recibo" }
  }
}
