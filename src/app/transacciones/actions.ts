"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

type TransaccionInput = {
  tipo: "INGRESO" | "EGRESO"
  monto: number
  categoria: string | null
  apartamentoId: string | null
  fecha: Date
  metodoPago: string
  descripcion: string | null
  referencia: string | null
  notas: string | null
}

type VentaCreditoInput = {
  monto: number
  apartamentoId: string
  fecha: Date
  descripcion: string
  notas: string | null
}

type ReciboPagoInput = {
  monto: number
  apartamentoId: string
  fecha: Date
  metodoPago: string
  cuentaBancariaId: string | null
  referencia: string | null
  notas: string | null
  clasificacionPago: "GASTO_COMUN" | "FONDO_RESERVA"
}

export async function createTransaccion(data: TransaccionInput) {
  try {
    const transaccion = await prisma.transaccion.create({
      data: {
        tipo: data.tipo,
        monto: data.monto,
        categoria: data.categoria as any,
        apartamentoId: data.apartamentoId,
        fecha: data.fecha,
        metodoPago: data.metodoPago as any,
        descripcion: data.descripcion,
        referencia: data.referencia,
        notas: data.notas,
      },
      include: { apartamento: true },
    })

    revalidatePath("/transacciones")
    revalidatePath("/")
    return transaccion
  } catch (error) {
    console.error("Error creating transaccion:", error)
    throw new Error("Error al crear la transacción")
  }
}

export async function createVentaCredito(data: VentaCreditoInput) {
  try {
    const transaccion = await prisma.transaccion.create({
      data: {
        tipo: "VENTA_CREDITO",
        monto: data.monto,
        apartamentoId: data.apartamentoId,
        fecha: data.fecha,
        descripcion: data.descripcion,
        notas: data.notas,
        categoria: "GASTOS_COMUNES",
        estadoCredito: "PENDIENTE",
        montoPagado: 0,
      },
      include: { apartamento: true },
    })

    revalidatePath("/transacciones")
    revalidatePath("/")
    return transaccion
  } catch (error) {
    console.error("Error creating venta credito:", error)
    throw new Error("Error al crear la venta a crédito")
  }
}

export async function createReciboPago(data: ReciboPagoInput) {
  try {
    // Obtener información del apartamento para la descripción
    const apartamento = await prisma.apartamento.findUnique({
      where: { id: data.apartamentoId },
      select: { numero: true, tipoOcupacion: true },
    })

    if (!apartamento) {
      throw new Error("Apartamento no encontrado")
    }

    const tipoLabel = apartamento.tipoOcupacion === "PROPIETARIO" ? "Propietario" : "Inquilino"

    // Generar descripción según la clasificación del pago
    const clasificacionLabels = {
      GASTO_COMUN: "Gasto Común",
      FONDO_RESERVA: "Fondo de Reserva",
    }
    const clasificacionLabel = clasificacionLabels[data.clasificacionPago]
    const descripcionRecibo = `Recibo de Pago (${clasificacionLabel}) - Apto ${apartamento.numero} (${tipoLabel})${data.referencia ? ` - Ref: ${data.referencia}` : ''}`

    // Create the payment receipt
    const recibo = await prisma.transaccion.create({
      data: {
        tipo: "RECIBO_PAGO",
        monto: data.monto,
        apartamentoId: data.apartamentoId,
        fecha: data.fecha,
        metodoPago: data.metodoPago as any,
        referencia: data.referencia,
        notas: data.notas,
        descripcion: descripcionRecibo,
        clasificacionPago: data.clasificacionPago,
        montoGastoComun: data.clasificacionPago === "GASTO_COMUN" ? data.monto : null,
        montoFondoReserva: data.clasificacionPago === "FONDO_RESERVA" ? data.monto : null,
      },
      include: { apartamento: true },
    })

    // Si se seleccionó una cuenta bancaria, crear el movimiento bancario
    if (data.cuentaBancariaId) {
      await prisma.movimientoBancario.create({
        data: {
          tipo: "INGRESO",
          monto: data.monto,
          fecha: data.fecha,
          descripcion: descripcionRecibo,
          referencia: data.referencia,
          cuentaBancariaId: data.cuentaBancariaId,
          transaccionId: recibo.id,
        },
      })
    }

    // Update pending credits for this apartment
    const pendingCredits = await prisma.transaccion.findMany({
      where: {
        apartamentoId: data.apartamentoId,
        tipo: "VENTA_CREDITO",
        estadoCredito: { in: ["PENDIENTE", "PARCIAL"] },
      },
      orderBy: { fecha: "asc" },
    })

    let remainingPayment = data.monto

    for (const credit of pendingCredits) {
      if (remainingPayment <= 0) break

      const pendingAmount = credit.monto - (credit.montoPagado || 0)
      const paymentToApply = Math.min(remainingPayment, pendingAmount)

      const newMontoPagado = (credit.montoPagado || 0) + paymentToApply
      const newEstado = newMontoPagado >= credit.monto ? "PAGADO" : "PARCIAL"

      await prisma.transaccion.update({
        where: { id: credit.id },
        data: {
          montoPagado: newMontoPagado,
          estadoCredito: newEstado,
        },
      })

      remainingPayment -= paymentToApply
    }

    revalidatePath("/transacciones")
    revalidatePath("/bancos")
    revalidatePath("/")
    return recibo
  } catch (error) {
    console.error("Error creating recibo pago:", error)
    throw new Error("Error al crear el recibo de pago")
  }
}

type UpdateTransaccionInput = {
  id: string
  tipo: "INGRESO" | "EGRESO" | "VENTA_CREDITO" | "RECIBO_PAGO"
  monto: number
  categoria: string | null
  apartamentoId: string | null
  fecha: Date
  metodoPago: string
  descripcion: string | null
  referencia: string | null
  notas: string | null
}

export async function updateTransaccion(data: UpdateTransaccionInput) {
  try {
    const transaccion = await prisma.transaccion.update({
      where: { id: data.id },
      data: {
        tipo: data.tipo,
        monto: data.monto,
        categoria: data.categoria as any,
        apartamentoId: data.apartamentoId,
        fecha: data.fecha,
        metodoPago: data.metodoPago as any,
        descripcion: data.descripcion,
        referencia: data.referencia,
        notas: data.notas,
      },
      include: { apartamento: true },
    })

    revalidatePath("/transacciones")
    revalidatePath("/bancos")
    revalidatePath("/")
    return transaccion
  } catch (error) {
    console.error("Error updating transaccion:", error)
    throw new Error("Error al actualizar la transacción")
  }
}

export async function deleteTransaccion(id: string) {
  try {
    // Primero eliminar movimiento bancario relacionado si existe
    await prisma.movimientoBancario.deleteMany({
      where: { transaccionId: id },
    })

    await prisma.transaccion.delete({
      where: { id },
    })

    revalidatePath("/transacciones")
    revalidatePath("/bancos")
    revalidatePath("/")
  } catch (error) {
    console.error("Error deleting transaccion:", error)
    throw new Error("Error al eliminar la transacción")
  }
}
