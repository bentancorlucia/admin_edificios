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

export type DetalleEgreso = {
  fecha: Date
  descripcion: string
  clasificacion: string
  monto: number
  banco: string
}

export type InformeData = {
  fecha: Date
  apartamentos: InformeApartamentoData[]
  resumenBancario: ResumenBancario
  detalleEgresos: DetalleEgreso[]
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
      cuentaBancaria: true,
    },
  })

  // Calcular ingresos por categoría desde movimientos bancarios vinculados a transacciones
  let ingresoGastosComunes = 0
  let ingresoFondoReserva = 0
  let egresoGastosComunes = 0
  let egresoFondoReserva = 0

  // Para ingresos bancarios vinculados a recibos de pago
  // Usar la clasificación directa del recibo de pago
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

  // Distribuir ingresos según la clasificación del recibo de pago
  for (const recibo of recibosPagoDelMes) {
    if (recibo.clasificacionPago === "GASTO_COMUN") {
      ingresoGastosComunes += recibo.monto
    } else if (recibo.clasificacionPago === "FONDO_RESERVA") {
      ingresoFondoReserva += recibo.monto
    } else {
      // Si no tiene clasificación, distribuir proporcionalmente según montos específicos
      if (recibo.montoGastoComun) {
        ingresoGastosComunes += recibo.montoGastoComun
      }
      if (recibo.montoFondoReserva) {
        ingresoFondoReserva += recibo.montoFondoReserva
      }
      // Si no tiene ninguna clasificación, asignar a gastos comunes por defecto
      if (!recibo.montoGastoComun && !recibo.montoFondoReserva && !recibo.clasificacionPago) {
        ingresoGastosComunes += recibo.monto
      }
    }
  }

  // Egresos bancarios por clasificación y detalle
  const detalleEgresos: DetalleEgreso[] = []

  for (const mov of movimientosBancarios) {
    if (mov.tipo === "EGRESO") {
      // Sumar a totales por clasificación
      if (mov.clasificacion === "GASTO_COMUN") {
        egresoGastosComunes += mov.monto
      } else if (mov.clasificacion === "FONDO_RESERVA") {
        egresoFondoReserva += mov.monto
      }

      // Agregar al detalle de egresos
      detalleEgresos.push({
        fecha: mov.fecha,
        descripcion: mov.descripcion || "Sin descripción",
        clasificacion: mov.clasificacion || "SIN_CLASIFICAR",
        monto: mov.monto,
        banco: mov.cuentaBancaria?.banco || "N/A",
      })
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

  // Ordenar egresos por fecha
  detalleEgresos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

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
    detalleEgresos,
    totales,
    avisos,
  }
}

// ========== Informe Acumulado por Rango de Fechas ==========

export type InformeAcumuladoData = {
  fechaInicio: Date
  fechaFin: Date
  recibos: {
    gastosComunes: number
    fondoReserva: number
    total: number
  }
  egresos: {
    gastosComunes: number
    fondoReserva: number
    total: number
  }
  balance: {
    gastosComunes: number
    fondoReserva: number
    total: number
  }
}

export async function getInformeAcumulado(
  fechaInicioStr: string,
  fechaFinStr: string
): Promise<InformeAcumuladoData> {
  // Convertir strings a Date
  const fechaInicio = new Date(fechaInicioStr)
  fechaInicio.setHours(0, 0, 0, 0)

  // Ajustar fechaFin para incluir todo el día
  const fechaFin = new Date(fechaFinStr)
  fechaFin.setHours(23, 59, 59, 999)

  // Obtener todos los recibos de pago en el rango
  const recibos = await prisma.transaccion.findMany({
    where: {
      tipo: "RECIBO_PAGO",
      fecha: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    },
  })

  // Calcular recibos por clasificación
  let recibosGastosComunes = 0
  let recibosFondoReserva = 0

  for (const recibo of recibos) {
    if (recibo.clasificacionPago === "GASTO_COMUN") {
      recibosGastosComunes += recibo.monto
    } else if (recibo.clasificacionPago === "FONDO_RESERVA") {
      recibosFondoReserva += recibo.monto
    } else {
      // Si tiene montos específicos, usarlos
      if (recibo.montoGastoComun) {
        recibosGastosComunes += recibo.montoGastoComun
      }
      if (recibo.montoFondoReserva) {
        recibosFondoReserva += recibo.montoFondoReserva
      }
      // Si no tiene clasificación, asignar a gastos comunes por defecto
      if (!recibo.montoGastoComun && !recibo.montoFondoReserva && !recibo.clasificacionPago) {
        recibosGastosComunes += recibo.monto
      }
    }
  }

  // Obtener egresos bancarios en el rango
  const egresos = await prisma.movimientoBancario.findMany({
    where: {
      tipo: "EGRESO",
      fecha: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    },
  })

  // Calcular egresos por clasificación
  let egresosGastosComunes = 0
  let egresosFondoReserva = 0

  for (const egreso of egresos) {
    if (egreso.clasificacion === "GASTO_COMUN") {
      egresosGastosComunes += egreso.monto
    } else if (egreso.clasificacion === "FONDO_RESERVA") {
      egresosFondoReserva += egreso.monto
    }
  }

  const totalRecibos = recibosGastosComunes + recibosFondoReserva
  const totalEgresos = egresosGastosComunes + egresosFondoReserva

  return {
    fechaInicio,
    fechaFin,
    recibos: {
      gastosComunes: recibosGastosComunes,
      fondoReserva: recibosFondoReserva,
      total: totalRecibos,
    },
    egresos: {
      gastosComunes: egresosGastosComunes,
      fondoReserva: egresosFondoReserva,
      total: totalEgresos,
    },
    balance: {
      gastosComunes: recibosGastosComunes - egresosGastosComunes,
      fondoReserva: recibosFondoReserva - egresosFondoReserva,
      total: totalRecibos - totalEgresos,
    },
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

// ========== Configuración del Informe ==========

const PIE_PAGINA_KEY = "pie_pagina_informe"
const PIE_PAGINA_DEFAULT = "Sistema de Administración de Edificios"

export async function getPiePaginaInforme(): Promise<string> {
  const config = await prisma.configuracionInforme.findUnique({
    where: { clave: PIE_PAGINA_KEY },
  })
  return config?.valor ?? PIE_PAGINA_DEFAULT
}

export async function updatePiePaginaInforme(valor: string): Promise<string> {
  const config = await prisma.configuracionInforme.upsert({
    where: { clave: PIE_PAGINA_KEY },
    update: { valor },
    create: { clave: PIE_PAGINA_KEY, valor },
  })

  revalidatePath("/informes")
  return config.valor
}
