import jsPDF from "jspdf"
import { type InformeData, type InformeCombinado, type SaldoCuentaBancaria } from "@/lib/database"

const tipoOcupacionLabels: Record<string, string> = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
}

// Paleta de colores
const colors = {
  primary: [45, 55, 72] as [number, number, number],      // slate-700
  secondary: [100, 116, 139] as [number, number, number], // slate-500
  muted: [148, 163, 184] as [number, number, number],     // slate-400
  light: [226, 232, 240] as [number, number, number],     // slate-200
  background: [248, 250, 252] as [number, number, number],// slate-50
  white: [255, 255, 255] as [number, number, number],
  positive: [22, 163, 74] as [number, number, number],    // green-600
  negative: [220, 38, 38] as [number, number, number],    // red-600
  blue: [37, 99, 235] as [number, number, number],        // blue-600
}

export function generateInformePDF(data: InformeData, periodoLabel: string, piePagina?: string, avisoFinal?: string) {
  const avisosActivos = (data.avisos || []).filter((a) => a.activo)
  const doc = new jsPDF("landscape")
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  const formatCurrency = (val: number) =>
    `$ ${val.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Helper para agregar el header en cada página
  const drawPageHeader = () => {
    doc.setFillColor(...colors.blue)
    doc.rect(0, 0, pageWidth, 28, "F")

    doc.setTextColor(...colors.white)
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("Edificio Constituyente II", margin, 12)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text("Constituyente 2015 - Montevideo", margin, 20)

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Detalle Gastos Comunes", pageWidth - margin, 12, { align: "right" })
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(periodoLabel, pageWidth - margin, 20, { align: "right" })
  }

  // Header de la primera página
  drawPageHeader()

  let y = 40

  const cardWidth = (pageWidth - margin * 2 - 16) / 5
  const cardHeight = 22
  const cardGap = 4
  const availableWidth = pageWidth - margin * 2
  const tableX = margin

  // =====================================================
  // 1. DESGLOSE POR APARTAMENTO (PRIMERO)
  // =====================================================
  y = drawSectionTitle(doc, "Desglose por Apartamento", margin, y)

  const tableHeaders = ["Apto", "Tipo", "Saldo Ant.", "Pagos Mes", "G. Comunes", "F. Reserva", "Saldo Actual"]
  const colWidths = [1, 1, 1, 1, 1, 1, 1]
  const totalColWidth = colWidths.reduce((a, b) => a + b, 0)
  const scaleFactor = availableWidth / totalColWidth
  const scaledColWidths = colWidths.map(w => w * scaleFactor)
  const tableWidth = availableWidth

  // Header de tabla - AZUL
  doc.setFillColor(...colors.blue)
  doc.rect(tableX, y, tableWidth, 9, "F")

  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.white)

  let colX = tableX + 4
  tableHeaders.forEach((header, i) => {
    const align = i > 1 ? "right" : "left"
    const textX = i === 6 ? tableX + tableWidth - 8 : (i > 1 ? colX + scaledColWidths[i] - 8 : colX)
    doc.text(header, textX, y + 6, { align })
    colX += scaledColWidths[i]
  })

  y += 9

  // Filas de datos
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)

  for (let i = 0; i < data.apartamentos.length; i++) {
    const apt = data.apartamentos[i]

    if (y > pageHeight - 35) {
      doc.addPage("landscape")
      drawPageHeader()
      y = 40

      // Repetir header de tabla - AZUL
      doc.setFillColor(...colors.blue)
      doc.rect(tableX, y, tableWidth, 9, "F")
      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...colors.white)

      colX = tableX + 4
      tableHeaders.forEach((header, idx) => {
        const align = idx > 1 ? "right" : "left"
        const textX = idx === 6 ? tableX + tableWidth - 8 : (idx > 1 ? colX + scaledColWidths[idx] - 8 : colX)
        doc.text(header, textX, y + 6, { align })
        colX += scaledColWidths[idx]
      })
      y += 9
      doc.setFont("helvetica", "normal")
    }

    // Fondo alternado sutil
    if (i % 2 === 0) {
      doc.setFillColor(...colors.background)
      doc.rect(tableX, y, tableWidth, 7, "F")
    }

    colX = tableX + 4
    const rowY = y + 5

    // Apto
    doc.setTextColor(...colors.primary)
    doc.setFont("helvetica", "bold")
    doc.text(apt.numero, colX, rowY)
    colX += scaledColWidths[0]

    // Tipo
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...colors.secondary)
    doc.text(tipoOcupacionLabels[apt.tipoOcupacion], colX, rowY)
    colX += scaledColWidths[1]

    // Saldo Anterior
    doc.setTextColor(apt.saldoAnterior > 0 ? colors.negative[0] : colors.primary[0],
                     apt.saldoAnterior > 0 ? colors.negative[1] : colors.primary[1],
                     apt.saldoAnterior > 0 ? colors.negative[2] : colors.primary[2])
    doc.text(formatCurrency(apt.saldoAnterior), colX + scaledColWidths[2] - 8, rowY, { align: "right" })
    colX += scaledColWidths[2]

    // Pagos Mes
    doc.setTextColor(...colors.positive)
    doc.text(formatCurrency(apt.pagosMes), colX + scaledColWidths[3] - 8, rowY, { align: "right" })
    colX += scaledColWidths[3]

    // Gastos Comunes
    doc.setTextColor(...colors.primary)
    doc.text(formatCurrency(apt.gastosComunesMes), colX + scaledColWidths[4] - 8, rowY, { align: "right" })
    colX += scaledColWidths[4]

    // Fondo Reserva
    doc.text(formatCurrency(apt.fondoReservaMes), colX + scaledColWidths[5] - 8, rowY, { align: "right" })
    colX += scaledColWidths[5]

    // Saldo Actual
    doc.setFont("helvetica", "bold")
    doc.setTextColor(apt.saldoActual > 0 ? colors.negative[0] : colors.positive[0],
                     apt.saldoActual > 0 ? colors.negative[1] : colors.positive[1],
                     apt.saldoActual > 0 ? colors.negative[2] : colors.positive[2])
    doc.text(formatCurrency(apt.saldoActual), tableX + tableWidth - 8, rowY, { align: "right" })

    y += 7
  }

  // Fila de totales
  doc.setDrawColor(...colors.primary)
  doc.line(tableX, y, tableX + tableWidth, y)
  y += 1

  doc.setFillColor(...colors.light)
  doc.rect(tableX, y, tableWidth, 8, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...colors.primary)

  colX = tableX + 4
  doc.text("TOTALES", colX, y + 5.5)
  colX += scaledColWidths[0] + scaledColWidths[1]

  doc.text(formatCurrency(data.totales.totalSaldoAnterior), colX + scaledColWidths[2] - 8, y + 5.5, { align: "right" })
  colX += scaledColWidths[2]

  doc.setTextColor(...colors.positive)
  doc.text(formatCurrency(data.totales.totalPagosMes), colX + scaledColWidths[3] - 8, y + 5.5, { align: "right" })
  colX += scaledColWidths[3]

  doc.setTextColor(...colors.primary)
  doc.text(formatCurrency(data.totales.totalGastosComunesMes), colX + scaledColWidths[4] - 8, y + 5.5, { align: "right" })
  colX += scaledColWidths[4]

  doc.text(formatCurrency(data.totales.totalFondoReservaMes), colX + scaledColWidths[5] - 8, y + 5.5, { align: "right" })
  colX += scaledColWidths[5]

  doc.setTextColor(data.totales.totalSaldoActual > 0 ? colors.negative[0] : colors.positive[0],
                   data.totales.totalSaldoActual > 0 ? colors.negative[1] : colors.positive[1],
                   data.totales.totalSaldoActual > 0 ? colors.negative[2] : colors.positive[2])
  doc.text(formatCurrency(data.totales.totalSaldoActual), tableX + tableWidth - 8, y + 5.5, { align: "right" })

  y += 16

  // =====================================================
  // 2. CUENTA BANCARIA PARA PAGO
  // =====================================================
  if (y > pageHeight - 40) {
    doc.addPage("landscape")
    drawPageHeader()
    y = 40
  }

  // Recuadro con datos de cuenta bancaria
  doc.setFillColor(239, 246, 255) // blue-50
  doc.setDrawColor(...colors.blue)
  doc.setLineWidth(0.5)
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, "FD")
  doc.setLineWidth(0.2)

  y += 6
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.blue)
  doc.text("Cuenta bancaria de pago:", pageWidth / 2, y, { align: "center" })

  y += 6
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.primary)
  doc.text("B.R.O.U. - Caja de Ahorro $ - N°. 000990109-00004 - Mario Bentancor", pageWidth / 2, y, { align: "center" })

  y += 5
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...colors.secondary)
  doc.text("Para transferencia desde otros bancos: 00099010900004  |  Concepto: OTROS", pageWidth / 2, y, { align: "center" })

  y += 24

  // =====================================================
  // 3. RESUMEN GENERAL
  // =====================================================
  if (y > pageHeight - 45) {
    doc.addPage("landscape")
    drawPageHeader()
    y = 40
  }

  y = drawSectionTitle(doc, "Resumen General", margin, y)

  const summaryItems = [
    { label: "Saldo Anterior", value: data.totales.totalSaldoAnterior, type: "neutral" },
    { label: "Pagos del Mes", value: data.totales.totalPagosMes, type: "positive" },
    { label: "Gastos Comunes", value: data.totales.totalGastosComunesMes, type: "neutral" },
    { label: "Fondo Reserva", value: data.totales.totalFondoReservaMes, type: "neutral" },
    { label: "Saldo Actual", value: data.totales.totalSaldoActual, type: data.totales.totalSaldoActual > 0 ? "negative" : "positive" },
  ]

  summaryItems.forEach((item, index) => {
    const x = margin + index * (cardWidth + cardGap)

    // Fondo de tarjeta
    doc.setFillColor(...colors.background)
    doc.setDrawColor(...colors.light)
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD")

    // Etiqueta
    doc.setFontSize(7)
    doc.setTextColor(...colors.secondary)
    doc.setFont("helvetica", "normal")
    doc.text(item.label.toUpperCase(), x + cardWidth / 2, y + 8, { align: "center" })

    // Valor
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    if (item.type === "positive") {
      doc.setTextColor(...colors.positive)
    } else if (item.type === "negative") {
      doc.setTextColor(...colors.negative)
    } else {
      doc.setTextColor(...colors.primary)
    }
    doc.text(formatCurrency(item.value), x + cardWidth / 2, y + 17, { align: "center" })
  })

  y += cardHeight + 16

  // =====================================================
  // 5. RESUMEN BANCARIO
  // =====================================================
  if (y > pageHeight - 45) {
    doc.addPage("landscape")
    drawPageHeader()
    y = 40
  }

  y = drawSectionTitle(doc, "Resumen Bancario", margin, y)

  const bankItems = [
    { label: "Ingreso G. Comunes", value: data.resumenBancario.ingresoGastosComunes, type: "positive" },
    { label: "Ingreso F. Reserva", value: data.resumenBancario.ingresoFondoReserva, type: "positive" },
    { label: "Egreso G. Comunes", value: data.resumenBancario.egresoGastosComunes, type: "negative" },
    { label: "Egreso F. Reserva", value: data.resumenBancario.egresoFondoReserva, type: "negative" },
    { label: "Saldo Bancario", value: data.resumenBancario.saldoBancarioTotal, type: "highlight" },
  ]

  bankItems.forEach((item, index) => {
    const x = margin + index * (cardWidth + cardGap)

    if (item.type === "highlight") {
      // Saldo bancario en azul
      doc.setFillColor(...colors.blue)
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "F")

      doc.setFontSize(7)
      doc.setTextColor(...colors.light)
      doc.setFont("helvetica", "normal")
      doc.text(item.label.toUpperCase(), x + cardWidth / 2, y + 8, { align: "center" })

      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...colors.white)
      doc.text(formatCurrency(item.value), x + cardWidth / 2, y + 17, { align: "center" })
    } else {
      doc.setFillColor(...colors.background)
      doc.setDrawColor(...colors.light)
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD")

      doc.setFontSize(7)
      doc.setTextColor(...colors.secondary)
      doc.setFont("helvetica", "normal")
      doc.text(item.label.toUpperCase(), x + cardWidth / 2, y + 8, { align: "center" })

      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(item.type === "positive" ? colors.positive[0] : colors.negative[0],
                       item.type === "positive" ? colors.positive[1] : colors.negative[1],
                       item.type === "positive" ? colors.positive[2] : colors.negative[2])
      doc.text(formatCurrency(item.value), x + cardWidth / 2, y + 17, { align: "center" })
    }
  })

  y += cardHeight + 8

  // =====================================================
  // 5b. SALDO POR CUENTA BANCARIA
  // =====================================================
  if (data.saldosPorCuenta && data.saldosPorCuenta.length > 0) {
    y = drawSaldosPorCuenta(doc, data.saldosPorCuenta, y, margin, availableWidth, formatCurrency, pageHeight)
  }

  y += 8

  // =====================================================
  // 6. AVISOS IMPORTANTES
  // =====================================================
  if (avisosActivos.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage("landscape")
      drawPageHeader()
      y = 40
    }

    y = drawSectionTitle(doc, "Información", margin, y)

    // Calcular altura total de los avisos
    doc.setFontSize(8)
    const lineHeight = 4.5
    const avisoSpacing = 3
    let avisosHeight = 10
    for (const aviso of avisosActivos) {
      const lines = doc.splitTextToSize(aviso.texto, pageWidth - margin * 2 - 20)
      avisosHeight += lines.length * lineHeight + avisoSpacing
    }

    // Recuadro con fondo sutil
    doc.setFillColor(...colors.background)
    doc.setDrawColor(...colors.light)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, pageWidth - margin * 2, avisosHeight, 2, 2, "FD")
    doc.setLineWidth(0.2)

    y += 6

    // Dibujar cada aviso con bullet simple
    doc.setFontSize(8)
    for (let i = 0; i < avisosActivos.length; i++) {
      const aviso = avisosActivos[i]
      const lines = doc.splitTextToSize(aviso.texto, pageWidth - margin * 2 - 20)

      doc.setFillColor(...colors.secondary)
      doc.circle(margin + 6, y - 1, 1.2, "F")

      doc.setFont("helvetica", "normal")
      doc.setTextColor(...colors.primary)
      doc.text(lines, margin + 12, y)

      y += lines.length * lineHeight + avisoSpacing
    }

    y += 16
  }

  // =====================================================
  // 7. DETALLE DE EGRESOS (Gastos Comunes primero, Fondo Reserva después)
  // =====================================================
  if (data.detalleEgresos && data.detalleEgresos.length > 0) {
    const egresosGastosComunes = data.detalleEgresos.filter(e => e.clasificacion === 'GASTO_COMUN')
    const egresosFondoReserva = data.detalleEgresos.filter(e => e.clasificacion === 'FONDO_RESERVA')

    // Tabla de Egresos por Gastos Comunes
    if (egresosGastosComunes.length > 0) {
      if (y > pageHeight - 50) {
        doc.addPage("landscape")
        drawPageHeader()
        y = 40
      }

      y = drawSectionTitle(doc, "Detalle de Egresos - Gastos Comunes", margin, y)
      y = drawEgresosTable(doc, egresosGastosComunes, y, margin, availableWidth, pageHeight, drawPageHeader)
      y += 16
    }

    // Tabla de Egresos por Fondo de Reserva
    if (egresosFondoReserva.length > 0) {
      if (y > pageHeight - 50) {
        doc.addPage("landscape")
        drawPageHeader()
        y = 40
      }

      y = drawSectionTitle(doc, "Detalle de Egresos - Fondo de Reserva", margin, y)
      y = drawEgresosTable(doc, egresosFondoReserva, y, margin, availableWidth, pageHeight, drawPageHeader)
    }
  }

  // =====================================================
  // 8. NOTA FINAL (Aviso Final)
  // =====================================================
  if (avisoFinal && avisoFinal.trim()) {
    if (y > pageHeight - 50) {
      doc.addPage("landscape")
      drawPageHeader()
      y = 40
    }

    y += 8
    y = drawSectionTitle(doc, "Nota", margin, y)

    // Calcular altura del aviso final
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(avisoFinal.trim(), pageWidth - margin * 2 - 16)
    const avisoHeight = lines.length * 4.5 + 12

    // Recuadro con fondo azul claro
    doc.setFillColor(239, 246, 255) // blue-50
    doc.setDrawColor(...colors.blue)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, pageWidth - margin * 2, avisoHeight, 2, 2, "FD")
    doc.setLineWidth(0.2)

    y += 6

    // Texto del aviso final
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...colors.primary)
    doc.text(lines, margin + 8, y)
  }

  // Footer
  const totalPages = doc.internal.pages.length - 1
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    // Línea separadora
    doc.setDrawColor(...colors.light)
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)

    // Texto del footer
    doc.setFontSize(7)
    doc.setTextColor(...colors.muted)
    doc.setFont("helvetica", "normal")
    const footerText = piePagina || "Detalle Gastos Comunes"
    doc.text(footerText, margin, pageHeight - 8)
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" })
  }

  const fileName = `Edificio Constituyente II – Gastos Comunes ${periodoLabel}.pdf`
  doc.save(fileName)
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number): number {
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.primary)
  doc.text(title.toUpperCase(), x, y)

  // Línea decorativa
  const textWidth = doc.getTextWidth(title.toUpperCase())
  doc.setDrawColor(...colors.primary)
  doc.setLineWidth(0.5)
  doc.line(x, y + 2, x + textWidth, y + 2)
  doc.setLineWidth(0.2)

  return y + 10
}

function drawSaldosPorCuenta(
  doc: jsPDF,
  cuentas: SaldoCuentaBancaria[],
  y: number,
  margin: number,
  availableWidth: number,
  formatCurrency: (val: number) => string,
  pageHeight?: number
): number {
  if (cuentas.length === 0) return y

  // Calcular altura necesaria para las tarjetas
  const cardGap = 4
  const maxCardsPerRow = Math.min(cuentas.length, 3)
  const cardWidth = (availableWidth - (maxCardsPerRow - 1) * cardGap) / maxCardsPerRow
  const cardHeight = 20
  const totalRows = Math.ceil(cuentas.length / maxCardsPerRow)
  const totalHeight = 6 + totalRows * (cardHeight + 3) // subtítulo + tarjetas

  // Verificar si hay espacio suficiente, si no, agregar nueva página
  if (pageHeight && y + totalHeight > pageHeight - 20) {
    doc.addPage("landscape")
    y = 25
  }

  // Subtítulo
  doc.setFontSize(7)
  doc.setTextColor(...colors.secondary)
  doc.setFont("helvetica", "normal")
  doc.text("SALDO POR CUENTA BANCARIA", margin, y)
  y += 6

  cuentas.forEach((cuenta, index) => {
    const col = index % maxCardsPerRow
    const row = Math.floor(index / maxCardsPerRow)
    const x = margin + col * (cardWidth + cardGap)
    const cardY = y + row * (cardHeight + 3)

    // Fondo de tarjeta
    doc.setFillColor(...colors.background)
    doc.setDrawColor(...colors.light)
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "FD")

    // Banco y tipo
    doc.setFontSize(7)
    doc.setTextColor(...colors.primary)
    doc.setFont("helvetica", "bold")
    doc.text(cuenta.banco, x + 4, cardY + 6)

    // Número de cuenta
    doc.setFontSize(6)
    doc.setTextColor(...colors.secondary)
    doc.setFont("helvetica", "normal")
    const cuentaInfo = `${cuenta.tipoCuenta} · ${cuenta.numeroCuenta}`
    doc.text(cuentaInfo, x + 4, cardY + 11)

    // Titular si existe
    if (cuenta.titular) {
      doc.setFontSize(5)
      doc.setTextColor(...colors.muted)
      const titularTruncado = cuenta.titular.length > 30 ? cuenta.titular.substring(0, 27) + "..." : cuenta.titular
      doc.text(titularTruncado, x + 4, cardY + 15)
    }

    // Saldo alineado a la derecha
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(cuenta.saldo >= 0 ? colors.primary[0] : colors.negative[0],
                     cuenta.saldo >= 0 ? colors.primary[1] : colors.negative[1],
                     cuenta.saldo >= 0 ? colors.primary[2] : colors.negative[2])
    doc.text(formatCurrency(cuenta.saldo), x + cardWidth - 4, cardY + 12, { align: "right" })
  })

  // Retornar posición Y después de las tarjetas
  return y + totalRows * (cardHeight + 3)
}

interface DetalleEgresoItem {
  fecha: string
  servicio: string
  descripcion: string
  clasificacion: string
  monto: number
  banco: string
}

function drawEgresosTable(
  doc: jsPDF,
  egresos: DetalleEgresoItem[],
  startY: number,
  margin: number,
  availableWidth: number,
  pageHeight: number,
  drawPageHeader?: () => void
): number {
  let y = startY
  const tableX = margin

  // Headers con columna de servicio
  const egresoHeaders = ["Fecha", "Servicio", "Descripción", "Banco", "Monto"]
  const egresoColBase = [22, 35, 100, 35, 30]
  const egresoTotalBase = egresoColBase.reduce((a, b) => a + b, 0)
  const egresoScaleFactor = availableWidth / egresoTotalBase
  const egresoColWidths = egresoColBase.map(w => w * egresoScaleFactor)
  const egresoTableWidth = availableWidth

  // Header - AZUL
  doc.setFillColor(...colors.blue)
  doc.rect(tableX, y, egresoTableWidth, 9, "F")

  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.white)

  let colX = tableX + 4
  egresoHeaders.forEach((header, i) => {
    const align = i === 4 ? "right" : "left"
    const textX = i === 4 ? tableX + egresoTableWidth - 8 : colX
    doc.text(header, textX, y + 6, { align })
    colX += egresoColWidths[i]
  })

  y += 9

  let totalEgresos = 0

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)

  for (let i = 0; i < egresos.length; i++) {
    const egreso = egresos[i]

    if (y > pageHeight - 25) {
      doc.addPage("landscape")
      if (drawPageHeader) {
        drawPageHeader()
        y = 40
      } else {
        y = 20
      }

      // Repetir header - AZUL
      doc.setFillColor(...colors.blue)
      doc.rect(tableX, y, egresoTableWidth, 9, "F")
      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...colors.white)

      colX = tableX + 4
      egresoHeaders.forEach((header, idx) => {
        const align = idx === 4 ? "right" : "left"
        const textX = idx === 4 ? tableX + egresoTableWidth - 8 : colX
        doc.text(header, textX, y + 6, { align })
        colX += egresoColWidths[idx]
      })
      y += 9
      doc.setFont("helvetica", "normal")
    }

    if (i % 2 === 0) {
      doc.setFillColor(...colors.background)
      doc.rect(tableX, y, egresoTableWidth, 7, "F")
    }

    colX = tableX + 4
    const rowY = y + 5

    // Fecha
    doc.setTextColor(...colors.primary)
    const fecha = new Date(egreso.fecha).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      timeZone: "UTC",
    })
    doc.text(fecha, colX, rowY)
    colX += egresoColWidths[0]

    // Servicio
    let servicio = egreso.servicio || "-"
    const maxServWidth = egresoColWidths[1] - 4
    while (doc.getTextWidth(servicio) > maxServWidth && servicio.length > 3) {
      servicio = servicio.slice(0, -4) + "..."
    }
    doc.setTextColor(...colors.secondary)
    doc.text(servicio, colX, rowY)
    colX += egresoColWidths[1]

    // Descripción (truncar si es necesario)
    let descripcion = egreso.descripcion
    const maxDescWidth = egresoColWidths[2] - 4
    while (doc.getTextWidth(descripcion) > maxDescWidth && descripcion.length > 3) {
      descripcion = descripcion.slice(0, -4) + "..."
    }
    doc.setTextColor(...colors.primary)
    doc.text(descripcion, colX, rowY)
    colX += egresoColWidths[2]

    // Banco
    doc.setTextColor(...colors.secondary)
    doc.text(egreso.banco || "N/A", colX, rowY)
    colX += egresoColWidths[3]

    // Monto - con margen
    doc.setTextColor(...colors.negative)
    doc.text(formatCurrency(egreso.monto), tableX + egresoTableWidth - 8, rowY, { align: "right" })

    totalEgresos += egreso.monto
    y += 7
  }

  // Total de egresos
  doc.setDrawColor(...colors.primary)
  doc.line(tableX, y, tableX + egresoTableWidth, y)
  y += 1

  doc.setFillColor(...colors.light)
  doc.rect(tableX, y, egresoTableWidth, 8, "F")

  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.primary)
  doc.text("TOTAL", tableX + 4, y + 5.5)

  doc.setTextColor(...colors.negative)
  doc.text(formatCurrency(totalEgresos), tableX + egresoTableWidth - 8, y + 5.5, { align: "right" })

  return y + 8
}

function formatCurrency(val: number): string {
  return `$ ${val.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function generateInformeCombinado(data: InformeCombinado, piePagina?: string, avisoFinal?: string) {
  const avisosActivos = (data.avisos || []).filter((a) => a.activo)
  const doc = new jsPDF("landscape")
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  const formatCurrencyLocal = (val: number) =>
    `$ ${val.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Helper para agregar el header en cada página
  const drawPageHeader = () => {
    doc.setFillColor(...colors.blue)
    doc.rect(0, 0, pageWidth, 28, "F")

    doc.setTextColor(...colors.white)
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("Edificio Constituyente II", margin, 12)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text("Constituyente 2015 - Montevideo", margin, 20)

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Informe Gastos Comunes", pageWidth - margin, 12, { align: "right" })
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`${data.mesCorriente.label}`, pageWidth - margin, 20, { align: "right" })
  }

  // Header de la primera página
  drawPageHeader()

  let y = 40

  const cardWidth = (pageWidth - margin * 2 - 16) / 5
  const cardHeight = 22
  const cardGap = 4
  const availableWidth = pageWidth - margin * 2
  const tableX = margin

  // =====================================================
  // 1. DESGLOSE POR APARTAMENTO (PRIMERO)
  // =====================================================
  y = drawSectionTitle(doc, "Desglose por Apartamento", margin, y)

  // Headers con mes anterior y mes corriente dinámicos
  const mesAnteriorCorto = data.mesAnterior.label.split(' ')[0].substring(0, 3) + ' ' + data.mesAnterior.anio
  const mesCorrienteCorto = data.mesCorriente.label.split(' ')[0].substring(0, 3) + ' ' + data.mesCorriente.anio
  const tableHeaders = ["Apto", "Tipo", `Pago ${mesAnteriorCorto}`, `Saldo ${mesAnteriorCorto}`, "G. Comunes", "F. Reserva", `Saldo ${mesCorrienteCorto}`]
  const colWidths = [1, 1, 1, 1, 1, 1, 1]
  const totalColWidth = colWidths.reduce((a, b) => a + b, 0)
  const scaleFactor = availableWidth / totalColWidth
  const scaledColWidths = colWidths.map(w => w * scaleFactor)
  const tableWidth = availableWidth

  // Header de tabla - AZUL
  doc.setFillColor(...colors.blue)
  doc.rect(tableX, y, tableWidth, 9, "F")

  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.white)

  let colX = tableX + 4
  tableHeaders.forEach((header, i) => {
    const align = i > 1 ? "right" : "left"
    const textX = i === 6 ? tableX + tableWidth - 8 : (i > 1 ? colX + scaledColWidths[i] - 8 : colX)
    doc.text(header, textX, y + 6, { align })
    colX += scaledColWidths[i]
  })

  y += 9

  // Filas de datos
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)

  for (let i = 0; i < data.apartamentos.length; i++) {
    const apt = data.apartamentos[i]

    if (y > pageHeight - 35) {
      doc.addPage("landscape")
      drawPageHeader()
      y = 40

      // Repetir header de tabla - AZUL
      doc.setFillColor(...colors.blue)
      doc.rect(tableX, y, tableWidth, 9, "F")
      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...colors.white)

      colX = tableX + 4
      tableHeaders.forEach((header, idx) => {
        const align = idx > 1 ? "right" : "left"
        const textX = idx === 6 ? tableX + tableWidth - 8 : (idx > 1 ? colX + scaledColWidths[idx] - 8 : colX)
        doc.text(header, textX, y + 6, { align })
        colX += scaledColWidths[idx]
      })
      y += 9
      doc.setFont("helvetica", "normal")
    }

    // Fondo alternado sutil
    if (i % 2 === 0) {
      doc.setFillColor(...colors.background)
      doc.rect(tableX, y, tableWidth, 7, "F")
    }

    colX = tableX + 4
    const rowY = y + 5

    // Apto
    doc.setTextColor(...colors.primary)
    doc.setFont("helvetica", "bold")
    doc.text(apt.numero, colX, rowY)
    colX += scaledColWidths[0]

    // Tipo
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...colors.secondary)
    doc.text(tipoOcupacionLabels[apt.tipoOcupacion], colX, rowY)
    colX += scaledColWidths[1]

    // Pagos Mes Anterior
    doc.setTextColor(...colors.positive)
    doc.text(formatCurrencyLocal(apt.pagosMesAnterior), colX + scaledColWidths[2] - 8, rowY, { align: "right" })
    colX += scaledColWidths[2]

    // Saldo Anterior (al final del mes anterior)
    doc.setTextColor(apt.saldoMesAnterior > 0 ? colors.negative[0] : colors.primary[0],
                     apt.saldoMesAnterior > 0 ? colors.negative[1] : colors.primary[1],
                     apt.saldoMesAnterior > 0 ? colors.negative[2] : colors.primary[2])
    doc.text(formatCurrencyLocal(apt.saldoMesAnterior), colX + scaledColWidths[3] - 8, rowY, { align: "right" })
    colX += scaledColWidths[3]

    // Gastos Comunes (mes corriente)
    doc.setTextColor(...colors.primary)
    doc.text(formatCurrencyLocal(apt.gastosComunesMesCorriente), colX + scaledColWidths[4] - 8, rowY, { align: "right" })
    colX += scaledColWidths[4]

    // Fondo Reserva (mes corriente)
    doc.text(formatCurrencyLocal(apt.fondoReservaMesCorriente), colX + scaledColWidths[5] - 8, rowY, { align: "right" })
    colX += scaledColWidths[5]

    // Saldo Actual
    doc.setFont("helvetica", "bold")
    doc.setTextColor(apt.saldoActual > 0 ? colors.negative[0] : colors.positive[0],
                     apt.saldoActual > 0 ? colors.negative[1] : colors.positive[1],
                     apt.saldoActual > 0 ? colors.negative[2] : colors.positive[2])
    doc.text(formatCurrencyLocal(apt.saldoActual), tableX + tableWidth - 8, rowY, { align: "right" })

    y += 7
  }

  // Fila de totales
  doc.setDrawColor(...colors.primary)
  doc.line(tableX, y, tableX + tableWidth, y)
  y += 1

  doc.setFillColor(...colors.light)
  doc.rect(tableX, y, tableWidth, 8, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...colors.primary)

  colX = tableX + 4
  doc.text("TOTALES", colX, y + 5.5)
  colX += scaledColWidths[0] + scaledColWidths[1]

  doc.setTextColor(...colors.positive)
  doc.text(formatCurrencyLocal(data.totalesCombinados.totalPagosMesAnterior), colX + scaledColWidths[2] - 8, y + 5.5, { align: "right" })
  colX += scaledColWidths[2]

  doc.setTextColor(...colors.primary)
  doc.text(formatCurrencyLocal(data.totalesCombinados.totalSaldoMesAnterior), colX + scaledColWidths[3] - 8, y + 5.5, { align: "right" })
  colX += scaledColWidths[3]

  doc.text(formatCurrencyLocal(data.totalesCombinados.totalGastosComunesMesCorriente), colX + scaledColWidths[4] - 8, y + 5.5, { align: "right" })
  colX += scaledColWidths[4]

  doc.text(formatCurrencyLocal(data.totalesCombinados.totalFondoReservaMesCorriente), colX + scaledColWidths[5] - 8, y + 5.5, { align: "right" })
  colX += scaledColWidths[5]

  doc.setTextColor(data.totalesCombinados.totalSaldoActual > 0 ? colors.negative[0] : colors.positive[0],
                   data.totalesCombinados.totalSaldoActual > 0 ? colors.negative[1] : colors.positive[1],
                   data.totalesCombinados.totalSaldoActual > 0 ? colors.negative[2] : colors.positive[2])
  doc.text(formatCurrencyLocal(data.totalesCombinados.totalSaldoActual), tableX + tableWidth - 8, y + 5.5, { align: "right" })

  y += 16

  // =====================================================
  // 2. CUENTA BANCARIA PARA PAGO
  // =====================================================
  if (y > pageHeight - 40) {
    doc.addPage("landscape")
    drawPageHeader()
    y = 40
  }

  // Recuadro con datos de cuenta bancaria
  doc.setFillColor(239, 246, 255) // blue-50
  doc.setDrawColor(...colors.blue)
  doc.setLineWidth(0.5)
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, "FD")
  doc.setLineWidth(0.2)

  y += 6
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.blue)
  doc.text("Cuenta bancaria de pago:", pageWidth / 2, y, { align: "center" })

  y += 6
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.primary)
  doc.text("B.R.O.U. - Caja de Ahorro $ - N°. 000990109-00004 - Mario Bentancor", pageWidth / 2, y, { align: "center" })

  y += 5
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...colors.secondary)
  doc.text("Para transferencia desde otros bancos: 00099010900004  |  Concepto: OTROS", pageWidth / 2, y, { align: "center" })

  y += 24

  // =====================================================
  // 3. RESUMEN GENERAL DEL MES ANTERIOR
  // =====================================================
  if (y > pageHeight - 45) {
    doc.addPage("landscape")
    drawPageHeader()
    y = 40
  }

  y = drawSectionTitle(doc, `Resumen General - ${data.mesAnterior.label}`, margin, y)

  const summaryItems = [
    { label: "Saldo Anterior", value: data.datosAnterior.totales.totalSaldoAnterior, type: "neutral" },
    { label: "Pagos del Mes", value: data.datosAnterior.totales.totalPagosMes, type: "positive" },
    { label: "Gastos Comunes", value: data.datosAnterior.totales.totalGastosComunesMes, type: "neutral" },
    { label: "Fondo Reserva", value: data.datosAnterior.totales.totalFondoReservaMes, type: "neutral" },
    { label: "Saldo Actual", value: data.datosAnterior.totales.totalSaldoActual, type: data.datosAnterior.totales.totalSaldoActual > 0 ? "negative" : "positive" },
  ]

  summaryItems.forEach((item, index) => {
    const x = margin + index * (cardWidth + cardGap)

    doc.setFillColor(...colors.background)
    doc.setDrawColor(...colors.light)
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD")

    doc.setFontSize(7)
    doc.setTextColor(...colors.secondary)
    doc.setFont("helvetica", "normal")
    doc.text(item.label.toUpperCase(), x + cardWidth / 2, y + 8, { align: "center" })

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    if (item.type === "positive") {
      doc.setTextColor(...colors.positive)
    } else if (item.type === "negative") {
      doc.setTextColor(...colors.negative)
    } else {
      doc.setTextColor(...colors.primary)
    }
    doc.text(formatCurrencyLocal(item.value), x + cardWidth / 2, y + 17, { align: "center" })
  })

  y += cardHeight + 16

  // =====================================================
  // 5. RESUMEN BANCARIO DEL MES ANTERIOR
  // =====================================================
  if (y > pageHeight - 45) {
    doc.addPage("landscape")
    drawPageHeader()
    y = 40
  }

  y = drawSectionTitle(doc, `Resumen Bancario - ${data.mesAnterior.label}`, margin, y)

  const bankItems = [
    { label: "Ingreso G. Comunes", value: data.datosAnterior.resumenBancario.ingresoGastosComunes, type: "positive" },
    { label: "Ingreso F. Reserva", value: data.datosAnterior.resumenBancario.ingresoFondoReserva, type: "positive" },
    { label: "Egreso G. Comunes", value: data.datosAnterior.resumenBancario.egresoGastosComunes, type: "negative" },
    { label: "Egreso F. Reserva", value: data.datosAnterior.resumenBancario.egresoFondoReserva, type: "negative" },
    { label: "Saldo Bancario", value: data.datosAnterior.resumenBancario.saldoBancarioTotal, type: "highlight" },
  ]

  bankItems.forEach((item, index) => {
    const x = margin + index * (cardWidth + cardGap)

    if (item.type === "highlight") {
      doc.setFillColor(...colors.blue)
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "F")

      doc.setFontSize(7)
      doc.setTextColor(...colors.light)
      doc.setFont("helvetica", "normal")
      doc.text(item.label.toUpperCase(), x + cardWidth / 2, y + 8, { align: "center" })

      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...colors.white)
      doc.text(formatCurrencyLocal(item.value), x + cardWidth / 2, y + 17, { align: "center" })
    } else {
      doc.setFillColor(...colors.background)
      doc.setDrawColor(...colors.light)
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD")

      doc.setFontSize(7)
      doc.setTextColor(...colors.secondary)
      doc.setFont("helvetica", "normal")
      doc.text(item.label.toUpperCase(), x + cardWidth / 2, y + 8, { align: "center" })

      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(item.type === "positive" ? colors.positive[0] : colors.negative[0],
                       item.type === "positive" ? colors.positive[1] : colors.negative[1],
                       item.type === "positive" ? colors.positive[2] : colors.negative[2])
      doc.text(formatCurrencyLocal(item.value), x + cardWidth / 2, y + 17, { align: "center" })
    }
  })

  y += cardHeight + 8

  // =====================================================
  // 5b. SALDO POR CUENTA BANCARIA DEL MES ANTERIOR
  // =====================================================
  if (data.datosAnterior.saldosPorCuenta && data.datosAnterior.saldosPorCuenta.length > 0) {
    y = drawSaldosPorCuenta(doc, data.datosAnterior.saldosPorCuenta, y, margin, availableWidth, formatCurrencyLocal, pageHeight)
  }

  y += 8

  // =====================================================
  // 6. AVISOS IMPORTANTES
  // =====================================================
  if (avisosActivos.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage("landscape")
      drawPageHeader()
      y = 40
    }

    y = drawSectionTitle(doc, "Información", margin, y)

    // Calcular altura total de los avisos
    doc.setFontSize(8)
    const lineHeight = 4.5
    const avisoSpacing = 3
    let avisosHeight = 10
    for (const aviso of avisosActivos) {
      const lines = doc.splitTextToSize(aviso.texto, pageWidth - margin * 2 - 20)
      avisosHeight += lines.length * lineHeight + avisoSpacing
    }

    // Recuadro con fondo sutil
    doc.setFillColor(...colors.background)
    doc.setDrawColor(...colors.light)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, pageWidth - margin * 2, avisosHeight, 2, 2, "FD")
    doc.setLineWidth(0.2)

    y += 6

    // Dibujar cada aviso con bullet simple
    doc.setFontSize(8)
    for (let i = 0; i < avisosActivos.length; i++) {
      const aviso = avisosActivos[i]
      const lines = doc.splitTextToSize(aviso.texto, pageWidth - margin * 2 - 20)

      doc.setFillColor(...colors.secondary)
      doc.circle(margin + 6, y - 1, 1.2, "F")

      doc.setFont("helvetica", "normal")
      doc.setTextColor(...colors.primary)
      doc.text(lines, margin + 12, y)

      y += lines.length * lineHeight + avisoSpacing
    }

    y += 16
  }

  // =====================================================
  // 7. DETALLE DE EGRESOS DEL MES ANTERIOR
  // =====================================================
  if (data.datosAnterior.detalleEgresos && data.datosAnterior.detalleEgresos.length > 0) {
    const egresosGastosComunes = data.datosAnterior.detalleEgresos.filter(e => e.clasificacion === 'GASTO_COMUN')
    const egresosFondoReserva = data.datosAnterior.detalleEgresos.filter(e => e.clasificacion === 'FONDO_RESERVA')

    // Tabla de Egresos por Gastos Comunes
    if (egresosGastosComunes.length > 0) {
      if (y > pageHeight - 50) {
        doc.addPage("landscape")
        drawPageHeader()
        y = 40
      }

      y = drawSectionTitle(doc, `Detalle de Egresos - Gastos Comunes - ${data.mesAnterior.label}`, margin, y)
      y = drawEgresosTable(doc, egresosGastosComunes, y, margin, availableWidth, pageHeight, drawPageHeader)
      y += 16
    }

    // Tabla de Egresos por Fondo de Reserva
    if (egresosFondoReserva.length > 0) {
      if (y > pageHeight - 50) {
        doc.addPage("landscape")
        drawPageHeader()
        y = 40
      }

      y = drawSectionTitle(doc, `Detalle de Egresos - Fondo de Reserva - ${data.mesAnterior.label}`, margin, y)
      y = drawEgresosTable(doc, egresosFondoReserva, y, margin, availableWidth, pageHeight, drawPageHeader)
    }
  }

  // =====================================================
  // 8. NOTA FINAL (Aviso Final)
  // =====================================================
  if (avisoFinal && avisoFinal.trim()) {
    if (y > pageHeight - 50) {
      doc.addPage("landscape")
      drawPageHeader()
      y = 40
    }

    y += 8
    y = drawSectionTitle(doc, "Nota", margin, y)

    // Calcular altura del aviso final
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(avisoFinal.trim(), pageWidth - margin * 2 - 16)
    const avisoHeight = lines.length * 4.5 + 12

    // Recuadro con fondo azul claro
    doc.setFillColor(239, 246, 255) // blue-50
    doc.setDrawColor(...colors.blue)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, pageWidth - margin * 2, avisoHeight, 2, 2, "FD")
    doc.setLineWidth(0.2)

    y += 6

    // Texto del aviso final
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...colors.primary)
    doc.text(lines, margin + 8, y)
  }

  // Footer
  const totalPages = doc.internal.pages.length - 1
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    doc.setDrawColor(...colors.light)
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)

    doc.setFontSize(7)
    doc.setTextColor(...colors.muted)
    doc.setFont("helvetica", "normal")
    const footerText = piePagina || "Informe Gastos Comunes"
    doc.text(footerText, margin, pageHeight - 8)
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" })
  }

  const fileName = `Edificio Constituyente II – Informe Mensual ${data.mesCorriente.label}.pdf`
  doc.save(fileName)
}
