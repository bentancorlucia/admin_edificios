import jsPDF from "jspdf"

export type Apartamento = {
  id: string
  numero: string
  piso: number | null
  alicuota: number
  gastosComunes: number
  fondoReserva: number
  tipoOcupacion: "PROPIETARIO" | "INQUILINO" | "AMBOS"
  contactoNombre: string | null
  contactoApellido: string | null
  contactoCelular: string | null
  contactoEmail: string | null
  notas: string | null
}

type Transaccion = {
  id: string
  tipo: string
  monto: number
  fecha: Date | string
  descripcion: string | null
  referencia: string | null
  estadoCredito: string | null
  categoria?: string | null
  montoPagado?: number | null
  apartamento?: {
    numero: string
  } | null
}

// Tipo para transacciones de apartamento en PDFs
type TransaccionApartamento = {
  id: string
  tipo: string
  monto: number
  fecha: string
  descripcion: string | null
  categoria: string | null
  estadoCredito: string | null
  montoPagado: number | null
}

const tipoOcupacionLabels: Record<string, string> = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
  AMBOS: "Propietario / Inquilino",
}

export function generateApartamentoPDF(apt: Apartamento) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageWidth, 40, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.text("Edificio Constituyente II", 20, 22)

  doc.setFontSize(12)
  doc.text("Constituyente 2015 - Montevideo", 20, 32)

  // Title
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(18)
  doc.text(`Reporte Apartamento ${apt.numero}`, 20, 55)

  // Content
  let y = 65

  doc.setFontSize(12)
  doc.setTextColor(30, 41, 59)

  const addLine = (label: string, value: string) => {
    doc.setFont("helvetica", "bold")
    doc.text(`${label}:`, 20, y)
    doc.setFont("helvetica", "normal")
    doc.text(value, 80, y)
    y += 10
  }

  addLine("Número", apt.numero)
  addLine("Piso", apt.piso?.toString() || "N/A")
  addLine("Tipo", tipoOcupacionLabels[apt.tipoOcupacion] || apt.tipoOcupacion)
  addLine("Gastos Comunes", `$ ${apt.gastosComunes.toLocaleString()}`)
  addLine("Fondo Reserva", `$ ${apt.fondoReserva.toLocaleString()}`)
  addLine("Total Mensual", `$ ${(apt.gastosComunes + apt.fondoReserva).toLocaleString()}`)

  y += 5
  doc.setFont("helvetica", "bold")
  doc.text("Contacto:", 20, y)
  y += 10
  doc.setFont("helvetica", "normal")

  if (apt.contactoNombre) {
    addLine("Nombre", `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim())
  }
  if (apt.contactoCelular) {
    addLine("Celular", apt.contactoCelular)
  }
  if (apt.contactoEmail) {
    addLine("Email", apt.contactoEmail)
  }
  if (apt.notas) {
    y += 10
    doc.setFont("helvetica", "bold")
    doc.text("Notas:", 20, y)
    y += 8
    doc.setFont("helvetica", "normal")
    const splitNotas = doc.splitTextToSize(apt.notas, pageWidth - 40)
    doc.text(splitNotas, 20, y)
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text("EdificioApp - Sistema de Gestión de Edificios", pageWidth / 2, pageHeight - 10, {
    align: "center",
  })

  doc.save(`apartamento-${apt.numero}.pdf`)
}

// Tipo para generar PDFs con información agrupada
type ApartamentoAgrupado = {
  numero: string
  piso: number | null
  propietario: Apartamento | null
  inquilino: Apartamento | null
}

// Tipo para saldos de cuenta corriente
type SaldosCuentaCorriente = Record<string, number>

// PDF para Propietario - Compacto
export function generatePropietarioPDF(grupo: ApartamentoAgrupado, saldos?: SaldosCuentaCorriente, transacciones?: TransaccionApartamento[]) {
  if (!grupo.propietario) return

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const apt = grupo.propietario
  const saldo = saldos?.[apt.id] || 0
  const nombreCompleto = apt.contactoNombre
    ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim()
    : "Sin registrar"

  // Header con título del edificio
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pageWidth, 22, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Edificio Constituyente II", 15, 10)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("Constituyente 2015 - Montevideo", 15, 17)

  // Título del apartamento
  doc.setTextColor(37, 99, 235)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(`Apto ${grupo.numero}`, 15, 32)

  // Segunda línea: tipo, piso, contacto
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text(`Propietario · Piso ${grupo.piso || 'N/A'} · ${nombreCompleto}`, 15, 39)

  // Contacto en la misma línea si hay espacio
  const contactoInfo = [apt.contactoCelular, apt.contactoEmail].filter(Boolean).join(" · ")
  if (contactoInfo) {
    doc.text(contactoInfo, pageWidth - 15, 39, { align: "right" })
  }

  let y = 49

  // Sección combinada: Gastos y Estado de Cuenta lado a lado
  doc.setDrawColor(226, 232, 240)
  doc.line(15, y, pageWidth - 15, y)
  y += 8

  const halfWidth = (pageWidth - 40) / 2

  // Columna izquierda: Gastos
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text("GASTOS MENSUALES", 15, y)

  // Columna derecha: Estado de cuenta
  doc.text("ESTADO DE CUENTA", 15 + halfWidth + 10, y)
  y += 6

  // Gastos en formato compacto
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "normal")
  doc.text(`Comunes: $${apt.gastosComunes.toLocaleString()}`, 15, y)
  doc.text(`Reserva: $${apt.fondoReserva.toLocaleString()}`, 15, y + 5)

  doc.setFont("helvetica", "bold")
  doc.setTextColor(37, 99, 235)
  doc.text(`Total: $${(apt.gastosComunes + apt.fondoReserva).toLocaleString()}`, 15, y + 12)

  // Estado de cuenta compacto (cuadro más pequeño)
  const estadoColor = saldo > 0 ? [220, 38, 38] : saldo < 0 ? [22, 163, 74] : [100, 116, 139]
  const estadoTexto = saldo > 0 ? "DEUDOR" : saldo < 0 ? "A FAVOR" : "AL DÍA"

  doc.setFillColor(estadoColor[0], estadoColor[1], estadoColor[2])
  doc.roundedRect(15 + halfWidth + 10, y - 2, halfWidth, 18, 2, 2, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text(estadoTexto, 15 + halfWidth + 10 + halfWidth / 2, y + 4, { align: "center" })

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(`$${Math.abs(saldo).toLocaleString()}`, 15 + halfWidth + 10 + halfWidth / 2, y + 12, { align: "center" })

  y += 22

  // Sección de Transacciones
  if (transacciones && transacciones.length > 0) {
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(15, y, pageWidth - 15, y)
    y += 6

    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "normal")
    doc.text("TRANSACCIONES", 15, y)
    y += 5

    // Header de tabla compacto
    doc.setFillColor(248, 250, 252)
    doc.rect(15, y, pageWidth - 30, 6, "F")

    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    y += 4
    doc.text("Fecha", 17, y)
    doc.text("Descripción", 40, y)
    doc.text("Tipo", 130, y)
    doc.text("Monto", pageWidth - 17, y, { align: "right" })
    y += 4

    // Filas de transacciones más compactas
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)

    const tipoLabels: Record<string, string> = {
      VENTA_CREDITO: "Cargo",
      RECIBO_PAGO: "Pago",
      INGRESO: "Ingreso",
      EGRESO: "Egreso",
    }

    for (const trans of transacciones) {
      if (y > pageHeight - 12) {
        doc.addPage()
        y = 12

        // Repetir header compacto
        doc.setFillColor(248, 250, 252)
        doc.rect(15, y, pageWidth - 30, 6, "F")
        doc.setFontSize(7)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(71, 85, 105)
        y += 4
        doc.text("Fecha", 17, y)
        doc.text("Descripción", 40, y)
        doc.text("Tipo", 130, y)
        doc.text("Monto", pageWidth - 17, y, { align: "right" })
        y += 4
        doc.setFont("helvetica", "normal")
      }

      const fechaTrans = new Date(trans.fecha).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })

      doc.setTextColor(71, 85, 105)
      doc.text(fechaTrans, 17, y)

      // Descripción (truncar si es muy larga)
      let desc = trans.descripcion || "Sin descripción"
      if (desc.length > 50) {
        desc = desc.substring(0, 47) + "..."
      }
      doc.setTextColor(30, 41, 59)
      doc.text(desc, 40, y)

      // Tipo
      doc.setTextColor(100, 116, 139)
      doc.text(tipoLabels[trans.tipo] || trans.tipo, 130, y)

      // Monto con color según tipo
      if (trans.tipo === "RECIBO_PAGO" || trans.tipo === "INGRESO") {
        doc.setTextColor(22, 163, 74)
        doc.text(`+$${trans.monto.toLocaleString()}`, pageWidth - 17, y, { align: "right" })
      } else {
        doc.setTextColor(220, 38, 38)
        doc.text(`$${trans.monto.toLocaleString()}`, pageWidth - 17, y, { align: "right" })
      }

      y += 5
    }
  }

  // Footer mínimo
  doc.setFontSize(7)
  doc.setTextColor(180, 180, 180)
  doc.setFont("helvetica", "normal")
  doc.text("EdificioApp", pageWidth / 2, pageHeight - 5, { align: "center" })

  doc.save(`apto-${grupo.numero}-propietario.pdf`)
}

// PDF para Inquilino - Compacto
export function generateInquilinoPDF(grupo: ApartamentoAgrupado, saldos?: SaldosCuentaCorriente, transacciones?: TransaccionApartamento[]) {
  if (!grupo.inquilino) return

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const apt = grupo.inquilino
  const saldo = saldos?.[apt.id] || 0
  const nombreCompleto = apt.contactoNombre
    ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim()
    : "Sin registrar"

  // Header con título del edificio
  doc.setFillColor(147, 51, 234)
  doc.rect(0, 0, pageWidth, 22, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Edificio Constituyente II", 15, 10)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("Constituyente 2015 - Montevideo", 15, 17)

  // Título del apartamento
  doc.setTextColor(147, 51, 234)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(`Apto ${grupo.numero}`, 15, 32)

  // Segunda línea: tipo, piso, contacto
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text(`Inquilino · Piso ${grupo.piso || 'N/A'} · ${nombreCompleto}`, 15, 39)

  // Contacto en la misma línea si hay espacio
  const contactoInfo = [apt.contactoCelular, apt.contactoEmail].filter(Boolean).join(" · ")
  if (contactoInfo) {
    doc.text(contactoInfo, pageWidth - 15, 39, { align: "right" })
  }

  let y = 49

  // Sección combinada: Gastos y Estado de Cuenta lado a lado
  doc.setDrawColor(226, 232, 240)
  doc.line(15, y, pageWidth - 15, y)
  y += 8

  const halfWidth = (pageWidth - 40) / 2

  // Columna izquierda: Gastos
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text("GASTOS MENSUALES", 15, y)

  // Columna derecha: Estado de cuenta
  doc.text("ESTADO DE CUENTA", 15 + halfWidth + 10, y)
  y += 6

  // Gastos en formato compacto
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "normal")
  doc.text(`Comunes: $${apt.gastosComunes.toLocaleString()}`, 15, y)
  doc.text(`Reserva: $${apt.fondoReserva.toLocaleString()}`, 15, y + 5)

  doc.setFont("helvetica", "bold")
  doc.setTextColor(147, 51, 234)
  doc.text(`Total: $${(apt.gastosComunes + apt.fondoReserva).toLocaleString()}`, 15, y + 12)

  // Estado de cuenta compacto (cuadro más pequeño)
  const estadoColor = saldo > 0 ? [220, 38, 38] : saldo < 0 ? [22, 163, 74] : [100, 116, 139]
  const estadoTexto = saldo > 0 ? "DEUDOR" : saldo < 0 ? "A FAVOR" : "AL DÍA"

  doc.setFillColor(estadoColor[0], estadoColor[1], estadoColor[2])
  doc.roundedRect(15 + halfWidth + 10, y - 2, halfWidth, 18, 2, 2, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text(estadoTexto, 15 + halfWidth + 10 + halfWidth / 2, y + 4, { align: "center" })

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(`$${Math.abs(saldo).toLocaleString()}`, 15 + halfWidth + 10 + halfWidth / 2, y + 12, { align: "center" })

  y += 22

  // Sección de Transacciones
  if (transacciones && transacciones.length > 0) {
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(15, y, pageWidth - 15, y)
    y += 6

    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "normal")
    doc.text("TRANSACCIONES", 15, y)
    y += 5

    // Header de tabla compacto
    doc.setFillColor(248, 250, 252)
    doc.rect(15, y, pageWidth - 30, 6, "F")

    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    y += 4
    doc.text("Fecha", 17, y)
    doc.text("Descripción", 40, y)
    doc.text("Tipo", 130, y)
    doc.text("Monto", pageWidth - 17, y, { align: "right" })
    y += 4

    // Filas de transacciones más compactas
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)

    const tipoLabels: Record<string, string> = {
      VENTA_CREDITO: "Cargo",
      RECIBO_PAGO: "Pago",
      INGRESO: "Ingreso",
      EGRESO: "Egreso",
    }

    for (const trans of transacciones) {
      if (y > pageHeight - 12) {
        doc.addPage()
        y = 12

        // Repetir header compacto
        doc.setFillColor(248, 250, 252)
        doc.rect(15, y, pageWidth - 30, 6, "F")
        doc.setFontSize(7)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(71, 85, 105)
        y += 4
        doc.text("Fecha", 17, y)
        doc.text("Descripción", 40, y)
        doc.text("Tipo", 130, y)
        doc.text("Monto", pageWidth - 17, y, { align: "right" })
        y += 4
        doc.setFont("helvetica", "normal")
      }

      const fechaTrans = new Date(trans.fecha).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })

      doc.setTextColor(71, 85, 105)
      doc.text(fechaTrans, 17, y)

      // Descripción (truncar si es muy larga)
      let desc = trans.descripcion || "Sin descripción"
      if (desc.length > 50) {
        desc = desc.substring(0, 47) + "..."
      }
      doc.setTextColor(30, 41, 59)
      doc.text(desc, 40, y)

      // Tipo
      doc.setTextColor(100, 116, 139)
      doc.text(tipoLabels[trans.tipo] || trans.tipo, 130, y)

      // Monto con color según tipo
      if (trans.tipo === "RECIBO_PAGO" || trans.tipo === "INGRESO") {
        doc.setTextColor(22, 163, 74)
        doc.text(`+$${trans.monto.toLocaleString()}`, pageWidth - 17, y, { align: "right" })
      } else {
        doc.setTextColor(220, 38, 38)
        doc.text(`$${trans.monto.toLocaleString()}`, pageWidth - 17, y, { align: "right" })
      }

      y += 5
    }
  }

  // Footer mínimo
  doc.setFontSize(7)
  doc.setTextColor(180, 180, 180)
  doc.setFont("helvetica", "normal")
  doc.text("EdificioApp", pageWidth / 2, pageHeight - 5, { align: "center" })

  doc.save(`apto-${grupo.numero}-inquilino.pdf`)
}

// Tipo para Estado de Cuenta Bancario
type EstadoCuentaData = {
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
    tipo: "INGRESO" | "EGRESO"
    monto: number
    fecha: string
    descripcion: string
    referencia: string | null
    clasificacion: string | null
    saldoAcumulado: number
  }[]
  resumen: {
    saldoInicial: number
    totalIngresos: number
    totalEgresos: number
    saldoFinal: number
  }
}

export function generateEstadoCuentaPDF(data: EstadoCuentaData) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(30, 64, 175) // blue-800
  doc.rect(0, 0, pageWidth, 45, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("Edificio Constituyente II", 20, 12)

  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text("Constituyente 2015 - Montevideo", 20, 20)

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Estado de Cuenta Bancario", 20, 32)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`${data.cuenta.banco} - ${data.cuenta.tipoCuenta} · Cuenta: ${data.cuenta.numeroCuenta}`, 20, 40)

  let y = 60

  // Información del titular
  if (data.cuenta.titular) {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.text("TITULAR", 20, y)
    y += 6
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(11)
    doc.text(data.cuenta.titular, 20, y)
    y += 15
  }

  // Resumen de cuenta
  doc.setDrawColor(226, 232, 240)
  doc.line(20, y, pageWidth - 20, y)
  y += 10

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text("RESUMEN", 20, y)
  y += 12

  // Cuadros de resumen
  const boxWidth = (pageWidth - 50) / 4
  const boxHeight = 35
  const startX = 20

  // Saldo Inicial
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(startX, y, boxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text("Saldo Inicial", startX + boxWidth / 2, y + 10, { align: "center" })
  doc.setFontSize(12)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  doc.text(
    `$${data.resumen.saldoInicial.toLocaleString()}`,
    startX + boxWidth / 2,
    y + 24,
    { align: "center" }
  )

  // Ingresos
  doc.setFillColor(220, 252, 231) // green-100
  doc.roundedRect(startX + boxWidth + 3, y, boxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(8)
  doc.setTextColor(22, 163, 74)
  doc.setFont("helvetica", "normal")
  doc.text("Ingresos", startX + boxWidth + 3 + boxWidth / 2, y + 10, {
    align: "center",
  })
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(
    `+$${data.resumen.totalIngresos.toLocaleString()}`,
    startX + boxWidth + 3 + boxWidth / 2,
    y + 24,
    { align: "center" }
  )

  // Egresos
  doc.setFillColor(254, 226, 226) // red-100
  doc.roundedRect(startX + (boxWidth + 3) * 2, y, boxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(8)
  doc.setTextColor(220, 38, 38)
  doc.setFont("helvetica", "normal")
  doc.text("Egresos", startX + (boxWidth + 3) * 2 + boxWidth / 2, y + 10, {
    align: "center",
  })
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(
    `-$${data.resumen.totalEgresos.toLocaleString()}`,
    startX + (boxWidth + 3) * 2 + boxWidth / 2,
    y + 24,
    { align: "center" }
  )

  // Saldo Final
  const saldoColor =
    data.resumen.saldoFinal >= 0 ? [30, 64, 175] : [220, 38, 38]
  doc.setFillColor(saldoColor[0], saldoColor[1], saldoColor[2])
  doc.roundedRect(startX + (boxWidth + 3) * 3, y, boxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "normal")
  doc.text("Saldo Final", startX + (boxWidth + 3) * 3 + boxWidth / 2, y + 10, {
    align: "center",
  })
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(
    `$${data.resumen.saldoFinal.toLocaleString()}`,
    startX + (boxWidth + 3) * 3 + boxWidth / 2,
    y + 24,
    { align: "center" }
  )

  y += boxHeight + 20

  // Tabla de movimientos
  doc.setDrawColor(226, 232, 240)
  doc.line(20, y, pageWidth - 20, y)
  y += 10

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text("DETALLE DE MOVIMIENTOS", 20, y)
  y += 12

  // Definir columnas escaladas
  const margin = 15
  const tableWidth = pageWidth - margin * 2
  const colWidthsBase = [25, 70, 30, 30, 30] // Fecha, Descripción, Ingreso, Egreso, Saldo
  const totalBase = colWidthsBase.reduce((a, b) => a + b, 0)
  const scaleFactor = tableWidth / totalBase
  const colWidths = colWidthsBase.map(w => w * scaleFactor)

  // Posiciones X de columnas
  const colX = [
    margin + 5,
    margin + 5 + colWidths[0],
    margin + colWidths[0] + colWidths[1] + colWidths[2] - 5, // Ingreso alineado a la derecha
    margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 5, // Egreso alineado a la derecha
    margin + tableWidth - 5, // Saldo alineado a la derecha
  ]

  // Calcular ancho máximo de descripción
  const maxDescWidth = colWidths[1] - 10

  // Función para dibujar header de tabla
  const drawMovHeader = () => {
    doc.setFillColor(241, 245, 249)
    doc.rect(margin, y, tableWidth, 10, "F")

    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    y += 7
    doc.text("Fecha", colX[0], y)
    doc.text("Descripción", colX[1], y)
    doc.text("Ingreso", colX[2], y, { align: "right" })
    doc.text("Egreso", colX[3], y, { align: "right" })
    doc.text("Saldo", colX[4], y, { align: "right" })
    y += 8
    doc.setFont("helvetica", "normal")
  }

  drawMovHeader()

  // Línea de saldo inicial
  doc.setTextColor(100, 116, 139)
  doc.text("-", colX[0], y)
  doc.text("Saldo Inicial", colX[1], y)
  doc.text("-", colX[2], y, { align: "right" })
  doc.text("-", colX[3], y, { align: "right" })
  doc.setTextColor(30, 41, 59)
  doc.text(`$${data.resumen.saldoInicial.toLocaleString()}`, colX[4], y, {
    align: "right",
  })
  y += 8

  // Movimientos
  data.movimientos.forEach((mov) => {
    if (y > 270) {
      doc.addPage()
      y = 20
      drawMovHeader()
    }

    const fechaMov = new Date(mov.fecha).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    })

    doc.setFont("helvetica", "normal")
    doc.setTextColor(71, 85, 105)
    doc.text(fechaMov, colX[0], y)

    // Descripción (truncar si es muy larga)
    let desc = mov.descripcion
    while (doc.getTextWidth(desc) > maxDescWidth && desc.length > 3) {
      desc = desc.slice(0, -4) + "..."
    }
    doc.setTextColor(30, 41, 59)
    doc.text(desc, colX[1], y)

    // Ingreso
    if (mov.tipo === "INGRESO") {
      doc.setTextColor(22, 163, 74)
      doc.text(`+$${mov.monto.toLocaleString()}`, colX[2], y, { align: "right" })
      doc.setTextColor(71, 85, 105)
      doc.text("-", colX[3], y, { align: "right" })
    } else {
      doc.setTextColor(71, 85, 105)
      doc.text("-", colX[2], y, { align: "right" })
      doc.setTextColor(220, 38, 38)
      doc.text(`-$${mov.monto.toLocaleString()}`, colX[3], y, { align: "right" })
    }

    // Saldo
    doc.setTextColor(30, 41, 59)
    doc.setFont("helvetica", "bold")
    doc.text(`$${mov.saldoAcumulado.toLocaleString()}`, colX[4], y, {
      align: "right",
    })

    y += 8
  })

  // Si no hay movimientos
  if (data.movimientos.length === 0) {
    doc.setTextColor(148, 163, 184)
    doc.setFont("helvetica", "normal")
    doc.text("No hay movimientos en el período seleccionado", pageWidth / 2, y, {
      align: "center",
    })
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.setFont("helvetica", "normal")
  doc.text("EdificioApp - Estado de Cuenta Bancario", pageWidth / 2, pageHeight - 10, {
    align: "center",
  })

  doc.save(`estado-cuenta-${data.cuenta.banco.toLowerCase().replace(/\s/g, "-")}.pdf`)
}

// Tipo para recibo de pago
export type ReciboPagoData = {
  apartamentoNumero: string
  fecha: string
  monto: number
  metodoPago: string
  referencia?: string | null
  conceptos: {
    gastosComunes: number
    fondoReserva: number
  }
  saldoFinal: number
}

export function generateReciboPagoPDF(data: ReciboPagoData): Blob {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header con gradiente verde
  doc.setFillColor(22, 163, 74) // green-600
  doc.rect(0, 0, pageWidth, 45, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Edificio Constituyente II", 20, 14)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("Constituyente 2015 - Montevideo", 20, 22)

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("COMPROBANTE DE PAGO", 20, 38)

  let y = 60

  // Información del apartamento y fecha
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(15, y - 5, pageWidth - 30, 25, 3, 3, "F")

  doc.setFontSize(11)
  doc.setTextColor(71, 85, 105)
  doc.setFont("helvetica", "normal")
  doc.text("Apartamento:", 20, y + 4)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  doc.text(data.apartamentoNumero, 60, y + 4)

  doc.setTextColor(71, 85, 105)
  doc.setFont("helvetica", "normal")
  doc.text("Fecha:", 110, y + 4)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  const fechaFormateada = new Date(data.fecha).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  })
  doc.text(fechaFormateada, 130, y + 4)

  doc.setTextColor(71, 85, 105)
  doc.setFont("helvetica", "normal")
  doc.text("Forma de pago:", 20, y + 14)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  const metodoPagoLabel: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TRANSFERENCIA: "Transferencia",
    TARJETA: "Tarjeta",
    CHEQUE: "Cheque",
    OTRO: "Otro"
  }
  doc.text(metodoPagoLabel[data.metodoPago] || data.metodoPago, 60, y + 14)

  if (data.referencia) {
    doc.setTextColor(71, 85, 105)
    doc.setFont("helvetica", "normal")
    doc.text("Ref:", 110, y + 14)
    doc.setTextColor(30, 41, 59)
    doc.setFont("helvetica", "bold")
    doc.text(data.referencia, 125, y + 14)
  }

  y += 35

  // Línea divisoria
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(15, y, pageWidth - 15, y)

  y += 15

  // Conceptos abonados
  doc.setFontSize(12)
  doc.setTextColor(71, 85, 105)
  doc.setFont("helvetica", "bold")
  doc.text("CONCEPTOS ABONADOS", 20, y)

  y += 12

  // Tabla de conceptos
  doc.setFillColor(248, 250, 252)
  doc.rect(15, y, pageWidth - 30, 10, "F")

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(71, 85, 105)
  doc.text("Concepto", 20, y + 7)
  doc.text("Importe", pageWidth - 20, y + 7, { align: "right" })

  y += 14

  doc.setFont("helvetica", "normal")
  doc.setTextColor(30, 41, 59)

  // Gastos Comunes
  if (data.conceptos.gastosComunes > 0) {
    doc.text("Gastos Comunes", 20, y)
    doc.text(`$${data.conceptos.gastosComunes.toLocaleString()}`, pageWidth - 20, y, { align: "right" })
    y += 10
  }

  // Fondo de Reserva
  if (data.conceptos.fondoReserva > 0) {
    doc.text("Fondo de Reserva", 20, y)
    doc.text(`$${data.conceptos.fondoReserva.toLocaleString()}`, pageWidth - 20, y, { align: "right" })
    y += 10
  }

  // Si el pago no tiene desglose, mostrar solo el total
  if (data.conceptos.gastosComunes === 0 && data.conceptos.fondoReserva === 0) {
    doc.text("Pago a cuenta", 20, y)
    doc.text(`$${data.monto.toLocaleString()}`, pageWidth - 20, y, { align: "right" })
    y += 10
  }

  // Línea divisoria
  doc.setDrawColor(226, 232, 240)
  doc.line(15, y, pageWidth - 15, y)

  y += 8

  // Total pagado
  doc.setFillColor(22, 163, 74)
  doc.roundedRect(15, y, pageWidth - 30, 20, 3, 3, "F")

  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.text("TOTAL ABONADO", 20, y + 13)
  doc.setFontSize(16)
  doc.text(`$${data.monto.toLocaleString()}`, pageWidth - 20, y + 13, { align: "right" })

  y += 35

  // Saldo de cuenta
  const saldoColor = data.saldoFinal > 0 ? [220, 38, 38] : data.saldoFinal < 0 ? [22, 163, 74] : [71, 85, 105]
  const saldoTexto = data.saldoFinal > 0 ? "SALDO DEUDOR" : data.saldoFinal < 0 ? "SALDO A FAVOR" : "CUENTA AL DÍA"

  doc.setFillColor(saldoColor[0], saldoColor[1], saldoColor[2])
  doc.roundedRect(15, y, pageWidth - 30, 25, 3, 3, "F")

  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "normal")
  doc.text(saldoTexto, 20, y + 10)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text(`$${Math.abs(data.saldoFinal).toLocaleString()}`, pageWidth - 20, y + 17, { align: "right" })

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.setFont("helvetica", "normal")
  doc.text("Este comprobante es válido como constancia de pago", pageWidth / 2, pageHeight - 15, { align: "center" })
  doc.text("EdificioApp - Sistema de Gestión de Edificios", pageWidth / 2, pageHeight - 10, { align: "center" })

  return doc.output("blob")
}

export function downloadReciboPagoPDF(data: ReciboPagoData) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header con gradiente verde
  doc.setFillColor(22, 163, 74) // green-600
  doc.rect(0, 0, pageWidth, 45, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Edificio Constituyente II", 20, 14)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("Constituyente 2015 - Montevideo", 20, 22)

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("COMPROBANTE DE PAGO", 20, 38)

  let y = 60

  // Información del apartamento y fecha
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(15, y - 5, pageWidth - 30, 25, 3, 3, "F")

  doc.setFontSize(11)
  doc.setTextColor(71, 85, 105)
  doc.setFont("helvetica", "normal")
  doc.text("Apartamento:", 20, y + 4)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  doc.text(data.apartamentoNumero, 60, y + 4)

  doc.setTextColor(71, 85, 105)
  doc.setFont("helvetica", "normal")
  doc.text("Fecha:", 110, y + 4)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  const fechaFormateada = new Date(data.fecha).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  })
  doc.text(fechaFormateada, 130, y + 4)

  doc.setTextColor(71, 85, 105)
  doc.setFont("helvetica", "normal")
  doc.text("Forma de pago:", 20, y + 14)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  const metodoPagoLabel: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TRANSFERENCIA: "Transferencia",
    TARJETA: "Tarjeta",
    CHEQUE: "Cheque",
    OTRO: "Otro"
  }
  doc.text(metodoPagoLabel[data.metodoPago] || data.metodoPago, 60, y + 14)

  if (data.referencia) {
    doc.setTextColor(71, 85, 105)
    doc.setFont("helvetica", "normal")
    doc.text("Ref:", 110, y + 14)
    doc.setTextColor(30, 41, 59)
    doc.setFont("helvetica", "bold")
    doc.text(data.referencia, 125, y + 14)
  }

  y += 35

  // Línea divisoria
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(15, y, pageWidth - 15, y)

  y += 15

  // Conceptos abonados
  doc.setFontSize(12)
  doc.setTextColor(71, 85, 105)
  doc.setFont("helvetica", "bold")
  doc.text("CONCEPTOS ABONADOS", 20, y)

  y += 12

  // Tabla de conceptos
  doc.setFillColor(248, 250, 252)
  doc.rect(15, y, pageWidth - 30, 10, "F")

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(71, 85, 105)
  doc.text("Concepto", 20, y + 7)
  doc.text("Importe", pageWidth - 20, y + 7, { align: "right" })

  y += 14

  doc.setFont("helvetica", "normal")
  doc.setTextColor(30, 41, 59)

  // Gastos Comunes
  if (data.conceptos.gastosComunes > 0) {
    doc.text("Gastos Comunes", 20, y)
    doc.text(`$${data.conceptos.gastosComunes.toLocaleString()}`, pageWidth - 20, y, { align: "right" })
    y += 10
  }

  // Fondo de Reserva
  if (data.conceptos.fondoReserva > 0) {
    doc.text("Fondo de Reserva", 20, y)
    doc.text(`$${data.conceptos.fondoReserva.toLocaleString()}`, pageWidth - 20, y, { align: "right" })
    y += 10
  }

  // Si el pago no tiene desglose, mostrar solo el total
  if (data.conceptos.gastosComunes === 0 && data.conceptos.fondoReserva === 0) {
    doc.text("Pago a cuenta", 20, y)
    doc.text(`$${data.monto.toLocaleString()}`, pageWidth - 20, y, { align: "right" })
    y += 10
  }

  // Línea divisoria
  doc.setDrawColor(226, 232, 240)
  doc.line(15, y, pageWidth - 15, y)

  y += 8

  // Total pagado
  doc.setFillColor(22, 163, 74)
  doc.roundedRect(15, y, pageWidth - 30, 20, 3, 3, "F")

  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.text("TOTAL ABONADO", 20, y + 13)
  doc.setFontSize(16)
  doc.text(`$${data.monto.toLocaleString()}`, pageWidth - 20, y + 13, { align: "right" })

  y += 35

  // Saldo de cuenta
  const saldoColor = data.saldoFinal > 0 ? [220, 38, 38] : data.saldoFinal < 0 ? [22, 163, 74] : [71, 85, 105]
  const saldoTexto = data.saldoFinal > 0 ? "SALDO DEUDOR" : data.saldoFinal < 0 ? "SALDO A FAVOR" : "CUENTA AL DÍA"

  doc.setFillColor(saldoColor[0], saldoColor[1], saldoColor[2])
  doc.roundedRect(15, y, pageWidth - 30, 25, 3, 3, "F")

  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "normal")
  doc.text(saldoTexto, 20, y + 10)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text(`$${Math.abs(data.saldoFinal).toLocaleString()}`, pageWidth - 20, y + 17, { align: "right" })

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.setFont("helvetica", "normal")
  doc.text("Este comprobante es válido como constancia de pago", pageWidth / 2, pageHeight - 15, { align: "center" })
  doc.text("EdificioApp - Sistema de Gestión de Edificios", pageWidth / 2, pageHeight - 10, { align: "center" })

  const fechaFile = new Date(data.fecha).toISOString().split("T")[0]
  doc.save(`recibo-apto-${data.apartamentoNumero}-${fechaFile}.pdf`)
}

export function generateTransaccionesPDF(transacciones: Transaccion[], titulo: string = "Reporte de Transacciones") {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageWidth, 40, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.text("Edificio Constituyente II", 20, 22)

  doc.setFontSize(12)
  doc.text("Constituyente 2015 - Montevideo", 20, 32)

  // Title
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(18)
  doc.text(titulo, 20, 52)

  // Summary
  const ingresos = transacciones
    .filter((t) => t.tipo === "INGRESO" || t.tipo === "RECIBO_PAGO")
    .reduce((acc, t) => acc + t.monto, 0)
  const egresos = transacciones
    .filter((t) => t.tipo === "EGRESO")
    .reduce((acc, t) => acc + t.monto, 0)

  let y = 65

  doc.setFontSize(12)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  doc.text("Resumen:", 20, y)
  y += 10

  doc.setFont("helvetica", "normal")
  doc.setTextColor(34, 197, 94)
  doc.text(`Ingresos: $ ${ingresos.toLocaleString()}`, 20, y)
  y += 8
  doc.setTextColor(239, 68, 68)
  doc.text(`Egresos: $ ${egresos.toLocaleString()}`, 20, y)
  y += 8
  doc.setTextColor(30, 41, 59)
  doc.text(`Balance: $ ${(ingresos - egresos).toLocaleString()}`, 20, y)
  y += 15

  // Definir columnas escaladas al ancho de página
  const margin = 15
  const tableWidth = pageWidth - margin * 2
  const colWidthsBase = [30, 35, 45, 40] // Fecha, Tipo, Apartamento, Monto
  const totalBase = colWidthsBase.reduce((a, b) => a + b, 0)
  const scaleFactor = tableWidth / totalBase
  const colWidths = colWidthsBase.map(w => w * scaleFactor)

  // Posiciones X de columnas
  const colX = [
    margin + 5,
    margin + 5 + colWidths[0],
    margin + 5 + colWidths[0] + colWidths[1],
    margin + tableWidth - 5, // Monto alineado a la derecha
  ]

  // Función para dibujar header de tabla
  const drawTableHeader = () => {
    doc.setFillColor(241, 245, 249)
    doc.rect(margin, y, tableWidth, 10, "F")

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 41, 59)
    y += 7
    doc.text("Fecha", colX[0], y)
    doc.text("Tipo", colX[1], y)
    doc.text("Apartamento", colX[2], y)
    doc.text("Monto", colX[3], y, { align: "right" })
    y += 10
    doc.setFont("helvetica", "normal")
  }

  drawTableHeader()

  // Table rows
  transacciones.forEach((t) => {
    if (y > 270) {
      doc.addPage()
      y = 20
      drawTableHeader()
    }

    const fecha = new Date(t.fecha).toLocaleDateString("es-ES")
    const tipoLabel = t.tipo === "INGRESO" ? "Ingreso" : t.tipo === "EGRESO" ? "Egreso" : t.tipo === "VENTA_CREDITO" ? "Venta Crédito" : "Recibo Pago"
    const apto = t.apartamento?.numero ? `Apto ${t.apartamento.numero}` : "General"

    doc.setTextColor(30, 41, 59)
    doc.text(fecha, colX[0], y)
    doc.text(tipoLabel, colX[1], y)
    doc.text(apto, colX[2], y)

    if (t.tipo === "EGRESO") {
      doc.setTextColor(239, 68, 68)
    } else {
      doc.setTextColor(34, 197, 94)
    }
    doc.text(`$ ${t.monto.toLocaleString()}`, colX[3], y, { align: "right" })
    doc.setTextColor(30, 41, 59)

    y += 8
  })

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text("EdificioApp - Sistema de Gestión de Edificios", pageWidth / 2, pageHeight - 10, {
    align: "center",
  })

  doc.save("transacciones.pdf")
}
