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
  referencia: string | null
  notas: string | null
}

export async function createTransaccion(data: TransaccionInput) {
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
}

export async function createVentaCredito(data: VentaCreditoInput) {
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
}

export async function createReciboPago(data: ReciboPagoInput) {
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
      descripcion: `Recibo de Pago - Ref: ${data.referencia || 'N/A'}`,
    },
    include: { apartamento: true },
  })

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
  revalidatePath("/")
  return recibo
}
