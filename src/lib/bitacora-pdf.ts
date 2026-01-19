import jsPDF from "jspdf"

// Paleta de colores minimalista (consistente con informe-pdf.ts)
const colors = {
  primary: [45, 55, 72] as [number, number, number],
  secondary: [100, 116, 139] as [number, number, number],
  muted: [148, 163, 184] as [number, number, number],
  light: [226, 232, 240] as [number, number, number],
  background: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  positive: [22, 163, 74] as [number, number, number],
  warning: [217, 119, 6] as [number, number, number],
  negative: [220, 38, 38] as [number, number, number],
}

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

type Registro = {
  id: string
  fecha: string
  tipo: TipoRegistro
  detalle: string
  observaciones: string | null
  situacion: SituacionRegistro
}

const tipoRegistroLabels: Record<TipoRegistro, string> = {
  NOVEDAD: "Novedad",
  VENCIMIENTO: "Vencimiento",
  MANTENIMIENTO: "Mantenimiento",
  REUNION: "Reunión",
  INCIDENTE: "Incidente",
  RECORDATORIO: "Recordatorio",
  OTRO: "Otro",
}

const situacionLabels: Record<SituacionRegistro, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En Proceso",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
  VENCIDO: "Vencido",
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number): number {
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.primary)
  doc.text(title.toUpperCase(), x, y)

  const textWidth = doc.getTextWidth(title.toUpperCase())
  doc.setDrawColor(...colors.primary)
  doc.setLineWidth(0.5)
  doc.line(x, y + 2, x + textWidth, y + 2)
  doc.setLineWidth(0.2)

  return y + 10
}

export function generateBitacoraPDF(registros: Registro[]) {
  const doc = new jsPDF("portrait")
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15

  // Header
  doc.setFillColor(...colors.primary)
  doc.rect(0, 0, pageWidth, 25, "F")

  doc.setTextColor(...colors.white)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Bitácora de Gestión", margin, 14)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  const fechaGen = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  doc.text(`Generado: ${fechaGen}`, pageWidth - margin, 14, { align: "right" })

  let y = 35

  // Resumen
  y = drawSectionTitle(doc, "Resumen", margin, y)

  const pendientes = registros.filter((r) => r.situacion === "PENDIENTE").length
  const enProceso = registros.filter((r) => r.situacion === "EN_PROCESO").length
  const realizados = registros.filter((r) => r.situacion === "REALIZADO").length
  const vencidos = registros.filter((r) => r.situacion === "VENCIDO").length
  const cancelados = registros.filter((r) => r.situacion === "CANCELADO").length

  const summaryItems = [
    { label: "Pendientes", value: pendientes, color: colors.warning },
    { label: "En Proceso", value: enProceso, color: colors.secondary },
    { label: "Realizados", value: realizados, color: colors.positive },
    { label: "Vencidos", value: vencidos, color: colors.negative },
    { label: "Cancelados", value: cancelados, color: colors.muted },
  ]

  const cardWidth = (pageWidth - margin * 2 - 16) / 5
  const cardHeight = 18

  summaryItems.forEach((item, index) => {
    const x = margin + index * (cardWidth + 4)

    doc.setFillColor(...colors.background)
    doc.setDrawColor(...colors.light)
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD")

    doc.setFontSize(6)
    doc.setTextColor(...colors.secondary)
    doc.setFont("helvetica", "normal")
    doc.text(item.label.toUpperCase(), x + cardWidth / 2, y + 6, { align: "center" })

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(item.color[0], item.color[1], item.color[2])
    doc.text(item.value.toString(), x + cardWidth / 2, y + 14, { align: "center" })
  })

  y += cardHeight + 12

  // Tabla de registros
  y = drawSectionTitle(doc, "Registros", margin, y)

  const tableHeaders = ["Fecha", "Tipo", "Detalle", "Situación"]
  const colWidths = [25, 30, 95, 25]
  const tableWidth = colWidths.reduce((a, b) => a + b, 0)
  const tableX = margin

  // Header de tabla
  doc.setFillColor(...colors.primary)
  doc.rect(tableX, y, tableWidth, 8, "F")

  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...colors.white)

  let colX = tableX + 3
  tableHeaders.forEach((header, i) => {
    doc.text(header, colX, y + 5.5)
    colX += colWidths[i]
  })

  y += 8

  // Filas de datos
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)

  for (let i = 0; i < registros.length; i++) {
    const reg = registros[i]

    // Calcular altura de la fila basado en el detalle
    const detalleLines = doc.splitTextToSize(reg.detalle, colWidths[2] - 6)
    const rowHeight = Math.max(7, detalleLines.length * 3.5 + 3)

    if (y + rowHeight > pageHeight - 20) {
      doc.addPage()
      y = 15

      // Repetir header
      doc.setFillColor(...colors.primary)
      doc.rect(tableX, y, tableWidth, 8, "F")
      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...colors.white)

      colX = tableX + 3
      tableHeaders.forEach((header) => {
        doc.text(header, colX, y + 5.5)
        colX += colWidths[tableHeaders.indexOf(header)]
      })
      y += 8
      doc.setFont("helvetica", "normal")
    }

    // Fondo alternado
    if (i % 2 === 0) {
      doc.setFillColor(...colors.background)
      doc.rect(tableX, y, tableWidth, rowHeight, "F")
    }

    colX = tableX + 3
    const rowY = y + 5

    // Fecha
    doc.setTextColor(...colors.primary)
    doc.text(formatDate(reg.fecha), colX, rowY)
    colX += colWidths[0]

    // Tipo
    doc.setTextColor(...colors.secondary)
    doc.text(tipoRegistroLabels[reg.tipo], colX, rowY)
    colX += colWidths[1]

    // Detalle (multilínea)
    doc.setTextColor(...colors.primary)
    doc.text(detalleLines, colX, rowY)
    colX += colWidths[2]

    // Situación con color
    const sitColor =
      reg.situacion === "REALIZADO"
        ? colors.positive
        : reg.situacion === "VENCIDO"
          ? colors.negative
          : reg.situacion === "PENDIENTE"
            ? colors.warning
            : colors.secondary
    doc.setTextColor(sitColor[0], sitColor[1], sitColor[2])
    doc.setFont("helvetica", "bold")
    doc.text(situacionLabels[reg.situacion], colX, rowY)
    doc.setFont("helvetica", "normal")

    y += rowHeight
  }

  // Footer en todas las páginas
  const totalPages = doc.internal.pages.length - 1
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    doc.setDrawColor(...colors.light)
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

    doc.setFontSize(7)
    doc.setTextColor(...colors.muted)
    doc.setFont("helvetica", "normal")
    doc.text("Bitácora de Gestión", margin, pageHeight - 6)
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" })
  }

  doc.save("bitacora.pdf")
}
