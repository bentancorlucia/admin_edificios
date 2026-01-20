import jsPDF from "jspdf"
import { type InformeData } from "@/lib/database"

const tipoOcupacionLabels: Record<string, string> = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
}

// Paleta de colores minimalista
const colors = {
  primary: [45, 55, 72] as [number, number, number],      // slate-700
  secondary: [100, 116, 139] as [number, number, number], // slate-500
  muted: [148, 163, 184] as [number, number, number],     // slate-400
  light: [226, 232, 240] as [number, number, number],     // slate-200
  background: [248, 250, 252] as [number, number, number],// slate-50
  white: [255, 255, 255] as [number, number, number],
  positive: [22, 163, 74] as [number, number, number],    // green-600
  negative: [220, 38, 38] as [number, number, number],    // red-600
}

export function generateInformePDF(data: InformeData, periodoLabel: string, piePagina?: string) {
  const avisosActivos = (data.avisos || []).filter((a) => a.activo)
  const doc = new jsPDF("landscape")
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  const formatCurrency = (val: number) =>
    `$ ${val.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Header minimalista
  doc.setFillColor(...colors.primary)
  doc.rect(0, 0, pageWidth, 28, "F")

  doc.setTextColor(...colors.white)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Informe Mensual de Cuenta Corriente", margin, 16)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  const fechaGen = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  doc.text(periodoLabel, pageWidth - margin, 12, { align: "right" })
  doc.setFontSize(8)
  doc.text(`Generado: ${fechaGen}`, pageWidth - margin, 20, { align: "right" })

  let y = 40

  // Sección: Resumen General
  y = drawSectionTitle(doc, "Resumen General", margin, y)

  // Tarjetas de resumen en línea
  const cardWidth = (pageWidth - margin * 2 - 16) / 5
  const cardHeight = 22
  const cardGap = 4

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

  // Sección: Desglose por Apartamento
  y = drawSectionTitle(doc, "Desglose por Apartamento", margin, y)

  // Tabla de apartamentos - ajustada al ancho completo de la página
  const tableHeaders = ["Apto", "Tipo", "Saldo Ant.", "Pagos Mes", "G. Comunes", "F. Reserva", "Saldo Actual"]
  const availableWidth = pageWidth - margin * 2
  const colWidths = [1, 1, 1, 1, 1, 1, 1] // Todas las columnas con el mismo ancho
  const totalColWidth = colWidths.reduce((a, b) => a + b, 0)
  const scaleFactor = availableWidth / totalColWidth
  const scaledColWidths = colWidths.map(w => w * scaleFactor)
  const tableWidth = availableWidth
  const tableX = margin

  // Header de tabla
  doc.setFillColor(...colors.primary)
  doc.rect(tableX, y, tableWidth, 9, "F")

  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.white)

  let colX = tableX + 4
  tableHeaders.forEach((header, i) => {
    const align = i > 1 ? "right" : "left"
    // Última columna alineada al borde derecho de la tabla
    const textX = i === 6 ? tableX + tableWidth - 4 : (i > 1 ? colX + scaledColWidths[i] - 4 : colX)
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
      y = 20

      // Repetir header de tabla
      doc.setFillColor(...colors.primary)
      doc.rect(tableX, y, tableWidth, 9, "F")
      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...colors.white)

      colX = tableX + 4
      tableHeaders.forEach((header, idx) => {
        const align = idx > 1 ? "right" : "left"
        // Última columna alineada al borde derecho de la tabla
        const textX = idx === 6 ? tableX + tableWidth - 4 : (idx > 1 ? colX + scaledColWidths[idx] - 4 : colX)
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
    doc.text(formatCurrency(apt.saldoAnterior), colX + scaledColWidths[2] - 4, rowY, { align: "right" })
    colX += scaledColWidths[2]

    // Pagos Mes
    doc.setTextColor(...colors.positive)
    doc.text(formatCurrency(apt.pagosMes), colX + scaledColWidths[3] - 4, rowY, { align: "right" })
    colX += scaledColWidths[3]

    // Gastos Comunes
    doc.setTextColor(...colors.primary)
    doc.text(formatCurrency(apt.gastosComunesMes), colX + scaledColWidths[4] - 4, rowY, { align: "right" })
    colX += scaledColWidths[4]

    // Fondo Reserva
    doc.text(formatCurrency(apt.fondoReservaMes), colX + scaledColWidths[5] - 4, rowY, { align: "right" })
    colX += scaledColWidths[5]

    // Saldo Actual - alinear al borde derecho de la tabla
    doc.setFont("helvetica", "bold")
    doc.setTextColor(apt.saldoActual > 0 ? colors.negative[0] : colors.positive[0],
                     apt.saldoActual > 0 ? colors.negative[1] : colors.positive[1],
                     apt.saldoActual > 0 ? colors.negative[2] : colors.positive[2])
    doc.text(formatCurrency(apt.saldoActual), tableX + tableWidth - 4, rowY, { align: "right" })

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

  doc.text(formatCurrency(data.totales.totalSaldoAnterior), colX + scaledColWidths[2] - 4, y + 5.5, { align: "right" })
  colX += scaledColWidths[2]

  doc.setTextColor(...colors.positive)
  doc.text(formatCurrency(data.totales.totalPagosMes), colX + scaledColWidths[3] - 4, y + 5.5, { align: "right" })
  colX += scaledColWidths[3]

  doc.setTextColor(...colors.primary)
  doc.text(formatCurrency(data.totales.totalGastosComunesMes), colX + scaledColWidths[4] - 4, y + 5.5, { align: "right" })
  colX += scaledColWidths[4]

  doc.text(formatCurrency(data.totales.totalFondoReservaMes), colX + scaledColWidths[5] - 4, y + 5.5, { align: "right" })
  colX += scaledColWidths[5]

  doc.setTextColor(data.totales.totalSaldoActual > 0 ? colors.negative[0] : colors.positive[0],
                   data.totales.totalSaldoActual > 0 ? colors.negative[1] : colors.positive[1],
                   data.totales.totalSaldoActual > 0 ? colors.negative[2] : colors.positive[2])
  doc.text(formatCurrency(data.totales.totalSaldoActual), tableX + tableWidth - 4, y + 5.5, { align: "right" })

  y += 16

  // Sección: Avisos (si hay)
  if (avisosActivos.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage("landscape")
      y = 20
    }

    y = drawSectionTitle(doc, "Avisos", margin, y)

    doc.setDrawColor(...colors.light)
    doc.setFillColor(...colors.background)

    // Calcular altura
    doc.setFontSize(8)
    let avisosHeight = 8
    for (const aviso of avisosActivos) {
      const lines = doc.splitTextToSize(aviso.texto, pageWidth - margin * 2 - 20)
      avisosHeight += lines.length * 4 + 4
    }

    doc.roundedRect(margin, y, pageWidth - margin * 2, avisosHeight, 2, 2, "FD")
    y += 6

    doc.setTextColor(...colors.primary)
    for (let i = 0; i < avisosActivos.length; i++) {
      const aviso = avisosActivos[i]
      const lines = doc.splitTextToSize(aviso.texto, pageWidth - margin * 2 - 25)

      doc.setFont("helvetica", "normal")
      doc.text(`${i + 1}.`, margin + 5, y)
      doc.text(lines, margin + 14, y)

      y += lines.length * 4 + 4
    }

    y += 8
  }

  // Sección: Resumen Bancario
  if (y > pageHeight - 45) {
    doc.addPage("landscape")
    y = 20
  }

  y = drawSectionTitle(doc, "Resumen Bancario", margin, y)

  // Tarjetas de resumen bancario
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
      doc.setFillColor(...colors.primary)
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

  y += cardHeight + 16

  // Sección: Detalle de Egresos
  if (data.detalleEgresos && data.detalleEgresos.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage("landscape")
      y = 20
    }

    y = drawSectionTitle(doc, "Detalle de Egresos", margin, y)

    const egresoHeaders = ["Fecha", "Descripción", "Clasificación", "Banco", "Monto"]
    const egresoColBase = [25, 120, 40, 40, 32]
    const egresoTotalBase = egresoColBase.reduce((a, b) => a + b, 0)
    const egresoScaleFactor = availableWidth / egresoTotalBase
    const egresoColWidths = egresoColBase.map(w => w * egresoScaleFactor)
    const egresoTableWidth = availableWidth

    // Header
    doc.setFillColor(...colors.primary)
    doc.rect(tableX, y, egresoTableWidth, 9, "F")

    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...colors.white)

    colX = tableX + 4
    egresoHeaders.forEach((header, i) => {
      const align = i === 4 ? "right" : "left"
      const textX = i === 4 ? colX + egresoColWidths[i] - 4 : colX
      doc.text(header, textX, y + 6, { align })
      colX += egresoColWidths[i]
    })

    y += 9

    const clasificacionLabels: Record<string, string> = {
      GASTO_COMUN: "G. Común",
      FONDO_RESERVA: "F. Reserva",
      SIN_CLASIFICAR: "Sin clasificar",
    }

    let totalEgresos = 0

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)

    for (let i = 0; i < data.detalleEgresos.length; i++) {
      const egreso = data.detalleEgresos[i]

      if (y > pageHeight - 25) {
        doc.addPage("landscape")
        y = 20

        // Repetir header
        doc.setFillColor(...colors.primary)
        doc.rect(tableX, y, egresoTableWidth, 9, "F")
        doc.setFontSize(7)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...colors.white)

        colX = tableX + 4
        egresoHeaders.forEach((header, idx) => {
          const align = idx === 4 ? "right" : "left"
          const textX = idx === 4 ? colX + egresoColWidths[idx] - 4 : colX
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
      })
      doc.text(fecha, colX, rowY)
      colX += egresoColWidths[0]

      // Descripción (truncar si es necesario)
      let descripcion = egreso.descripcion
      const maxDescWidth = egresoColWidths[1] - 8
      while (doc.getTextWidth(descripcion) > maxDescWidth && descripcion.length > 3) {
        descripcion = descripcion.slice(0, -4) + "..."
      }
      doc.text(descripcion, colX, rowY)
      colX += egresoColWidths[1]

      // Clasificación
      doc.setTextColor(...colors.secondary)
      doc.text(clasificacionLabels[egreso.clasificacion] || egreso.clasificacion, colX, rowY)
      colX += egresoColWidths[2]

      // Banco
      doc.text(egreso.banco || "N/A", colX, rowY)
      colX += egresoColWidths[3]

      // Monto
      doc.setTextColor(...colors.negative)
      doc.text(formatCurrency(egreso.monto), colX + egresoColWidths[4] - 4, rowY, { align: "right" })

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
    doc.text("TOTAL EGRESOS", tableX + 4, y + 5.5)

    doc.setTextColor(...colors.negative)
    doc.text(formatCurrency(totalEgresos), tableX + egresoTableWidth - 4, y + 5.5, { align: "right" })
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
    const footerText = piePagina || "Informe Mensual de Cuenta Corriente"
    doc.text(footerText, margin, pageHeight - 8)
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" })
  }

  const fileName = `informe-mensual-${periodoLabel.toLowerCase().replace(/\s/g, "-")}.pdf`
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
