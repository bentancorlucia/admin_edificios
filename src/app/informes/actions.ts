"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// Tipos para Avisos de Informe
export type AvisoInforme = {
  id: string
  texto: string
  orden: number
  mes: number
  anio: number
  activo: boolean
}

export type InformeApartamentoData = {
  apartamentoId: string
  numero: string
  piso: number | null
  tipoOcupacion: "PROPIETARIO" | "INQUILINO"
  contactoNombre: string | null
  contactoApellido: string | null
  contactoCelular: string | null
  saldoAnterior: number
  pagosMes: number
  gastosComunesMes: number
  fondoReservaMes: number
  saldoActual: number
}

export type ResumenBancario = {
  ingresoGastosComunes: number
  ingresoFondoReserva: number
  egresoGastosComunes: number
  egresoFondoReserva: number
  saldoBancarioTotal: number
}

export type InformeData = {
  fecha: Date
  apartamentos: InformeApartamentoData[]
  resumenBancario: ResumenBancario
  totales: {
    totalSaldoAnterior: number
    totalPagosMes: number
    totalGastosComunesMes: number
    totalFondoReservaMes: number
    totalSaldoActual: number
  }
  avisos: AvisoInforme[]
}

export async function getInformeData(
  mes: number,
  anio: number
): Promise<InformeData> {
  // Calcular fechas del mes seleccionado
  const fechaInicio = new Date(anio, mes - 1, 1)
  const fechaFin = new Date(anio, mes, 0, 23, 59, 59, 999)
  const fechaInicioMesAnterior = new Date(anio, mes - 2, 1)
  const fechaFinMesAnterior = new Date(anio, mes - 1, 0, 23, 59, 59, 999)

  // Obtener todos los apartamentos
  const apartamentos = await prisma.apartamento.findMany({
    orderBy: [{ numero: "asc" }, { tipoOcupacion: "asc" }],
    include: {
      transacciones: true,
    },
  })

  const informeApartamentos: InformeApartamentoData[] = []

  for (const apt of apartamentos) {
    // Calcular saldo anterior (cuenta corriente hasta antes del mes seleccionado)
    // Saldo = VENTA_CREDITO (cargos) - RECIBO_PAGO (pagos) de todas las transacciones anteriores
    const transaccionesAnteriores = apt.transacciones.filter(
      (t) => new Date(t.fecha) < fechaInicio
    )

    let saldoAnterior = 0
    for (const t of transaccionesAnteriores) {
      if (t.tipo === "VENTA_CREDITO") {
        // Sumar cargos (aumenta deuda)
        saldoAnterior += t.monto
      } else if (t.tipo === "RECIBO_PAGO") {
        // Restar pagos (disminuye deuda)
        saldoAnterior -= t.monto
      }
    }

    // Calcular pagos del mes
    const pagosMes = apt.transacciones
      .filter(
        (t) =>
          t.tipo === "RECIBO_PAGO" &&
          new Date(t.fecha) >= fechaInicio &&
          new Date(t.fecha) <= fechaFin
      )
      .reduce((sum, t) => sum + t.monto, 0)

    // Calcular gastos comunes generados en el mes
    const gastosComunesMes = apt.transacciones
      .filter(
        (t) =>
          t.tipo === "VENTA_CREDITO" &&
          t.categoria === "GASTOS_COMUNES" &&
          new Date(t.fecha) >= fechaInicio &&
          new Date(t.fecha) <= fechaFin
      )
      .reduce((sum, t) => sum + t.monto, 0)

    // Calcular fondo de reserva generado en el mes
    const fondoReservaMes = apt.transacciones
      .filter(
        (t) =>
          t.tipo === "VENTA_CREDITO" &&
          t.categoria === "FONDO_RESERVA" &&
          new Date(t.fecha) >= fechaInicio &&
          new Date(t.fecha) <= fechaFin
      )
      .reduce((sum, t) => sum + t.monto, 0)

    // Calcular saldo actual
    // Saldo anterior + cargos del mes - pagos del mes
    const saldoActual = saldoAnterior + gastosComunesMes + fondoReservaMes - pagosMes

    informeApartamentos.push({
      apartamentoId: apt.id,
      numero: apt.numero,
      piso: apt.piso,
      tipoOcupacion: apt.tipoOcupacion as "PROPIETARIO" | "INQUILINO",
      contactoNombre: apt.contactoNombre,
      contactoApellido: apt.contactoApellido,
      contactoCelular: apt.contactoCelular,
      saldoAnterior,
      pagosMes,
      gastosComunesMes,
      fondoReservaMes,
      saldoActual,
    })
  }

  // Obtener resumen bancario del mes
  const movimientosBancarios = await prisma.movimientoBancario.findMany({
    where: {
      fecha: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    },
    include: {
      transaccion: true,
    },
  })

  // Calcular ingresos por categoría desde movimientos bancarios vinculados a transacciones
  let ingresoGastosComunes = 0
  let ingresoFondoReserva = 0
  let egresoGastosComunes = 0
  let egresoFondoReserva = 0

  // Para ingresos bancarios vinculados a recibos de pago
  // Necesitamos obtener las transacciones VENTA_CREDITO que se pagaron
  const recibosPagoDelMes = await prisma.transaccion.findMany({
    where: {
      tipo: "RECIBO_PAGO",
      fecha: {
        gte: fechaInicio,
        lte: fechaFin,
      },
      movimientoBancario: {
        isNot: null,
      },
    },
    include: {
      movimientoBancario: true,
    },
  })

  // Para cada recibo de pago vinculado, distribuir según las VENTA_CREDITO
  for (const recibo of recibosPagoDelMes) {
    // Obtener los VENTA_CREDITO del mismo apartamento que fueron pagados
    const ventasCredito = await prisma.transaccion.findMany({
      where: {
        apartamentoId: recibo.apartamentoId,
        tipo: "VENTA_CREDITO",
        estadoCredito: { in: ["PARCIAL", "PAGADO"] },
      },
    })

    const totalGC = ventasCredito
      .filter((v) => v.categoria === "GASTOS_COMUNES")
      .reduce((s, v) => s + (v.montoPagado || 0), 0)
    const totalFR = ventasCredito
      .filter((v) => v.categoria === "FONDO_RESERVA")
      .reduce((s, v) => s + (v.montoPagado || 0), 0)
    const total = totalGC + totalFR

    if (total > 0) {
      const propGC = totalGC / total
      const propFR = totalFR / total
      ingresoGastosComunes += recibo.monto * propGC
      ingresoFondoReserva += recibo.monto * propFR
    }
  }

  // Egresos bancarios por categoría
  for (const mov of movimientosBancarios) {
    if (mov.tipo === "EGRESO" && mov.transaccion) {
      if (mov.transaccion.categoria === "GASTOS_COMUNES") {
        egresoGastosComunes += mov.monto
      } else if (mov.transaccion.categoria === "FONDO_RESERVA") {
        egresoFondoReserva += mov.monto
      }
    }
  }

  // Calcular saldo bancario total actual
  const cuentasBancarias = await prisma.cuentaBancaria.findMany({
    where: { activa: true },
    include: {
      movimientos: true,
    },
  })

  let saldoBancarioTotal = 0
  for (const cuenta of cuentasBancarias) {
    let saldo = cuenta.saldoInicial
    for (const mov of cuenta.movimientos) {
      if (new Date(mov.fecha) <= fechaFin) {
        if (mov.tipo === "INGRESO") {
          saldo += mov.monto
        } else {
          saldo -= mov.monto
        }
      }
    }
    saldoBancarioTotal += saldo
  }

  // Calcular totales
  const totales = {
    totalSaldoAnterior: informeApartamentos.reduce(
      (s, a) => s + a.saldoAnterior,
      0
    ),
    totalPagosMes: informeApartamentos.reduce((s, a) => s + a.pagosMes, 0),
    totalGastosComunesMes: informeApartamentos.reduce(
      (s, a) => s + a.gastosComunesMes,
      0
    ),
    totalFondoReservaMes: informeApartamentos.reduce(
      (s, a) => s + a.fondoReservaMes,
      0
    ),
    totalSaldoActual: informeApartamentos.reduce((s, a) => s + a.saldoActual, 0),
  }

  // Obtener avisos del mes (todos, activos e inactivos)
  const avisos = await prisma.avisoInforme.findMany({
    where: {
      mes,
      anio,
    },
    orderBy: { orden: "asc" },
  })

  return {
    fecha: fechaFin,
    apartamentos: informeApartamentos,
    resumenBancario: {
      ingresoGastosComunes,
      ingresoFondoReserva,
      egresoGastosComunes,
      egresoFondoReserva,
      saldoBancarioTotal,
    },
    totales,
    avisos,
  }
}

// ========== CRUD de Avisos de Informe ==========

export async function getAvisosInforme(mes: number, anio: number): Promise<AvisoInforme[]> {
  return prisma.avisoInforme.findMany({
    where: { mes, anio },
    orderBy: { orden: "asc" },
  })
}

export async function createAvisoInforme(data: {
  texto: string
  mes: number
  anio: number
}): Promise<AvisoInforme> {
  // Obtener el máximo orden actual para el mes/año
  const maxOrden = await prisma.avisoInforme.aggregate({
    where: { mes: data.mes, anio: data.anio },
    _max: { orden: true },
  })

  const nuevoOrden = (maxOrden._max.orden ?? -1) + 1

  const aviso = await prisma.avisoInforme.create({
    data: {
      texto: data.texto,
      mes: data.mes,
      anio: data.anio,
      orden: nuevoOrden,
    },
  })

  revalidatePath("/informes")
  return aviso
}

export async function updateAvisoInforme(
  id: string,
  data: { texto?: string; activo?: boolean }
): Promise<AvisoInforme> {
  const aviso = await prisma.avisoInforme.update({
    where: { id },
    data,
  })

  revalidatePath("/informes")
  return aviso
}

export async function deleteAvisoInforme(id: string): Promise<void> {
  await prisma.avisoInforme.delete({
    where: { id },
  })

  revalidatePath("/informes")
}

export async function reorderAvisosInforme(
  avisos: { id: string; orden: number }[]
): Promise<void> {
  await prisma.$transaction(
    avisos.map((aviso) =>
      prisma.avisoInforme.update({
        where: { id: aviso.id },
        data: { orden: aviso.orden },
      })
    )
  )

  revalidatePath("/informes")
}
