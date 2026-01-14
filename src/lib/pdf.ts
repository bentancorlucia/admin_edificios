import jsPDF from "jspdf"

type Apartamento = {
  id: string
  numero: string
  piso: number | null
  metrosCuadrados: number | null
  habitaciones: number
  banos: number
  alicuota: number
  cuotaMensual: number
  estado: string
  celular: string | null
  email: string | null
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
  apartamento?: {
    numero: string
  } | null
}

const estadoLabels: Record<string, string> = {
  DISPONIBLE: "Disponible",
  OCUPADO: "Ocupado",
  MANTENIMIENTO: "Mantenimiento",
}

export function generateApartamentoPDF(apt: Apartamento) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageWidth, 40, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.text("EdificioApp", 20, 25)

  doc.setFontSize(10)
  doc.text("Sistema de Gestión de Edificios", 20, 32)

  // Title
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(18)
  doc.text(`Reporte Apartamento ${apt.numero}`, 20, 55)

  // Date
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(`Generado: ${new Date().toLocaleDateString("es-ES")}`, 20, 62)

  // Content
  let y = 80

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
  addLine("Metros²", apt.metrosCuadrados?.toString() || "N/A")
  addLine("Habitaciones", apt.habitaciones.toString())
  addLine("Baños", apt.banos.toString())
  addLine("Estado", estadoLabels[apt.estado] || apt.estado)
  addLine("Cuota Mensual", `$ ${apt.cuotaMensual.toLocaleString()}`)

  if (apt.celular) {
    addLine("Celular", apt.celular)
  }
  if (apt.email) {
    addLine("Email", apt.email)
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

export function generateTransaccionesPDF(transacciones: Transaccion[], titulo: string = "Reporte de Transacciones") {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageWidth, 40, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.text("EdificioApp", 20, 25)

  doc.setFontSize(10)
  doc.text("Sistema de Gestión de Edificios", 20, 32)

  // Title
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(18)
  doc.text(titulo, 20, 55)

  // Date
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(`Generado: ${new Date().toLocaleDateString("es-ES")}`, 20, 62)

  // Summary
  const ingresos = transacciones
    .filter((t) => t.tipo === "INGRESO" || t.tipo === "RECIBO_PAGO")
    .reduce((acc, t) => acc + t.monto, 0)
  const egresos = transacciones
    .filter((t) => t.tipo === "EGRESO")
    .reduce((acc, t) => acc + t.monto, 0)

  let y = 80

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

  // Table header
  doc.setFillColor(241, 245, 249)
  doc.rect(15, y, pageWidth - 30, 10, "F")

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  y += 7
  doc.text("Fecha", 20, y)
  doc.text("Tipo", 55, y)
  doc.text("Apartamento", 100, y)
  doc.text("Monto", 155, y)

  y += 10

  // Table rows
  doc.setFont("helvetica", "normal")
  transacciones.forEach((t) => {
    if (y > 270) {
      doc.addPage()
      y = 20
    }

    const fecha = new Date(t.fecha).toLocaleDateString("es-ES")
    const tipoLabel = t.tipo === "INGRESO" ? "Ingreso" : t.tipo === "EGRESO" ? "Egreso" : t.tipo === "VENTA_CREDITO" ? "Venta Crédito" : "Recibo Pago"
    const apto = t.apartamento?.numero ? `Apto ${t.apartamento.numero}` : "General"

    doc.text(fecha, 20, y)
    doc.text(tipoLabel, 55, y)
    doc.text(apto, 100, y)

    if (t.tipo === "EGRESO") {
      doc.setTextColor(239, 68, 68)
    } else {
      doc.setTextColor(34, 197, 94)
    }
    doc.text(`$ ${t.monto.toLocaleString()}`, 155, y)
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
