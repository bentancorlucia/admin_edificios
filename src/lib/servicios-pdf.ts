import jsPDF from "jspdf"

// Paleta de colores minimalista (consistente con informe-pdf.ts)
const colors = {
  primary: [45, 55, 72] as [number, number, number],
  secondary: [100, 116, 139] as [number, number, number],
  muted: [148, 163, 184] as [number, number, number],
  light: [226, 232, 240] as [number, number, number],
  background: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

type TipoServicio =
  | "ELECTRICISTA"
  | "PLOMERO"
  | "SANITARIO"
  | "CERRAJERO"
  | "PINTOR"
  | "CARPINTERO"
  | "ALBANIL"
  | "JARDINERO"
  | "LIMPIEZA"
  | "SEGURIDAD"
  | "FUMIGACION"
  | "ASCENSOR"
  | "VIDRIERIA"
  | "HERRERIA"
  | "AIRE_ACONDICIONADO"
  | "GAS"
  | "UTE"
  | "OSE"
  | "TARIFA_SANEAMIENTO"
  | "OTRO"

type Servicio = {
  id: string
  tipo: TipoServicio
  nombre: string
  celular: string | null
  email: string | null
  observaciones: string | null
  activo: boolean
}

const tipoServicioLabels: Record<TipoServicio, string> = {
  ELECTRICISTA: "Electricista",
  PLOMERO: "Plomero",
  SANITARIO: "Sanitario",
  CERRAJERO: "Cerrajero",
  PINTOR: "Pintor",
  CARPINTERO: "Carpintero",
  ALBANIL: "Albañil",
  JARDINERO: "Jardinero",
  LIMPIEZA: "Limpieza",
  SEGURIDAD: "Seguridad",
  FUMIGACION: "Fumigación",
  ASCENSOR: "Ascensor",
  VIDRIERIA: "Vidriería",
  HERRERIA: "Herrería",
  AIRE_ACONDICIONADO: "Aire Acondicionado",
  GAS: "Gas",
  UTE: "UTE (Electricidad)",
  OSE: "OSE (Agua)",
  TARIFA_SANEAMIENTO: "Tarifa de Saneamiento",
  OTRO: "Otro",
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

export function generateServiciosPDF(servicios: Servicio[]) {
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
  doc.text("Directorio de Servicios", margin, 14)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  const fechaGen = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  doc.text(`Generado: ${fechaGen}`, pageWidth - margin, 14, { align: "right" })

  let y = 35

  // Resumen por tipo
  y = drawSectionTitle(doc, `Total de Servicios: ${servicios.length}`, margin, y)

  // Agrupar servicios por tipo
  const serviciosPorTipo = servicios.reduce(
    (acc, srv) => {
      if (!acc[srv.tipo]) acc[srv.tipo] = []
      acc[srv.tipo].push(srv)
      return acc
    },
    {} as Record<TipoServicio, Servicio[]>
  )

  // Tabla principal
  const tableHeaders = ["Tipo", "Nombre", "Celular", "Email"]
  const colWidths = [40, 55, 35, 50]
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

  // Filas de datos agrupadas por tipo
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)

  const tiposOrdenados = Object.keys(serviciosPorTipo).sort((a, b) =>
    tipoServicioLabels[a as TipoServicio].localeCompare(tipoServicioLabels[b as TipoServicio])
  ) as TipoServicio[]

  for (const tipo of tiposOrdenados) {
    const serviciosDelTipo = serviciosPorTipo[tipo]

    for (let i = 0; i < serviciosDelTipo.length; i++) {
      const srv = serviciosDelTipo[i]
      const rowHeight = 7

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
        tableHeaders.forEach((header, idx) => {
          doc.text(header, colX, y + 5.5)
          colX += colWidths[idx]
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

      // Tipo (solo mostrar en la primera fila del grupo)
      doc.setTextColor(...colors.secondary)
      doc.setFont("helvetica", "bold")
      if (i === 0) {
        doc.text(tipoServicioLabels[tipo], colX, rowY)
      }
      colX += colWidths[0]

      // Nombre
      doc.setTextColor(...colors.primary)
      doc.setFont("helvetica", "normal")
      let nombre = srv.nombre
      const maxNombreWidth = colWidths[1] - 6
      while (doc.getTextWidth(nombre) > maxNombreWidth && nombre.length > 3) {
        nombre = nombre.slice(0, -4) + "..."
      }
      doc.text(nombre, colX, rowY)
      colX += colWidths[1]

      // Celular
      doc.setTextColor(...colors.secondary)
      doc.text(srv.celular || "-", colX, rowY)
      colX += colWidths[2]

      // Email
      let email = srv.email || "-"
      const maxEmailWidth = colWidths[3] - 6
      while (doc.getTextWidth(email) > maxEmailWidth && email.length > 3) {
        email = email.slice(0, -4) + "..."
      }
      doc.text(email, colX, rowY)

      y += rowHeight
    }

    // Línea separadora entre grupos
    if (tipo !== tiposOrdenados[tiposOrdenados.length - 1]) {
      doc.setDrawColor(...colors.light)
      doc.line(tableX, y, tableX + tableWidth, y)
    }
  }

  // Sección de observaciones (si hay servicios con observaciones)
  const serviciosConObs = servicios.filter((s) => s.observaciones)
  if (serviciosConObs.length > 0) {
    y += 12

    if (y > pageHeight - 50) {
      doc.addPage()
      y = 15
    }

    y = drawSectionTitle(doc, "Observaciones", margin, y)

    doc.setFontSize(7)
    for (const srv of serviciosConObs) {
      if (y > pageHeight - 25) {
        doc.addPage()
        y = 15
      }

      doc.setTextColor(...colors.primary)
      doc.setFont("helvetica", "bold")
      doc.text(`${srv.nombre} (${tipoServicioLabels[srv.tipo]}):`, margin, y)

      doc.setFont("helvetica", "normal")
      doc.setTextColor(...colors.secondary)
      const obsLines = doc.splitTextToSize(srv.observaciones!, pageWidth - margin * 2 - 5)
      doc.text(obsLines, margin + 3, y + 4)

      y += 4 + obsLines.length * 3.5 + 4
    }
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
    doc.text("Directorio de Servicios", margin, pageHeight - 6)
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" })
  }

  doc.save("directorio-servicios.pdf")
}
