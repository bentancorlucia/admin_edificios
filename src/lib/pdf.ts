import jsPDF from "jspdf"

type Apartamento = {
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
  apartamento?: {
    numero: string
  } | null
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

// PDF para Propietario - Minimalista
export function generatePropietarioPDF(grupo: ApartamentoAgrupado, saldos?: SaldosCuentaCorriente) {
  if (!grupo.propietario) return

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const apt = grupo.propietario
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
  const saldo = saldos?.[apt.id] || 0

  // Header minimalista
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pageWidth, 8, "F")

  doc.setTextColor(37, 99, 235)
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text(`Apto ${grupo.numero}`, 20, 25)

  doc.setFontSize(11)
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text(`Propietario · Piso ${grupo.piso || 'N/A'} · ${fecha}`, 20, 33)

  let y = 50

  // Línea separadora
  doc.setDrawColor(226, 232, 240)
  doc.line(20, y, pageWidth - 20, y)
  y += 15

  // Contacto
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text("CONTACTO", 20, y)
  y += 8

  doc.setFontSize(12)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  const nombreCompleto = apt.contactoNombre
    ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim()
    : "Sin registrar"
  doc.text(nombreCompleto, 20, y)
  y += 7

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  if (apt.contactoCelular) {
    doc.text(apt.contactoCelular, 20, y)
    y += 6
  }
  if (apt.contactoEmail) {
    doc.setTextColor(100, 116, 139)
    doc.text(apt.contactoEmail, 20, y)
    y += 6
  }

  y += 10

  // Gastos - Tabla simple
  doc.setDrawColor(226, 232, 240)
  doc.line(20, y, pageWidth - 20, y)
  y += 15

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text("GASTOS MENSUALES", 20, y)
  y += 12

  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "normal")

  doc.text("Gastos Comunes", 20, y)
  doc.text(`$ ${apt.gastosComunes.toLocaleString()}`, pageWidth - 20, y, { align: "right" })
  y += 10

  doc.text("Fondo de Reserva", 20, y)
  doc.text(`$ ${apt.fondoReserva.toLocaleString()}`, pageWidth - 20, y, { align: "right" })
  y += 12

  // Total destacado
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.5)
  doc.line(20, y, pageWidth - 20, y)
  y += 10

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(37, 99, 235)
  doc.text("TOTAL MENSUAL", 20, y)
  doc.text(`$ ${(apt.gastosComunes + apt.fondoReserva).toLocaleString()}`, pageWidth - 20, y, { align: "right" })

  // Estado de Cuenta
  y += 25
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(20, y, pageWidth - 20, y)
  y += 15

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text("ESTADO DE CUENTA", 20, y)
  y += 12

  // Cuadro de estado de cuenta
  const estadoColor = saldo > 0 ? [220, 38, 38] : saldo < 0 ? [22, 163, 74] : [100, 116, 139]
  const estadoTexto = saldo > 0 ? "SALDO DEUDOR" : saldo < 0 ? "SALDO A FAVOR" : "SIN SALDO PENDIENTE"

  doc.setFillColor(estadoColor[0], estadoColor[1], estadoColor[2])
  doc.roundedRect(20, y, pageWidth - 40, 30, 3, 3, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(estadoTexto, pageWidth / 2, y + 10, { align: "center" })

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(`$ ${Math.abs(saldo).toLocaleString()}`, pageWidth / 2, y + 22, { align: "center" })

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(180, 180, 180)
  doc.setFont("helvetica", "normal")
  doc.text("EdificioApp", pageWidth / 2, pageHeight - 10, { align: "center" })

  doc.save(`apto-${grupo.numero}-propietario.pdf`)
}

// PDF para Inquilino - Minimalista
export function generateInquilinoPDF(grupo: ApartamentoAgrupado, saldos?: SaldosCuentaCorriente) {
  if (!grupo.inquilino) return

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const apt = grupo.inquilino
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
  const saldo = saldos?.[apt.id] || 0

  // Header minimalista
  doc.setFillColor(147, 51, 234)
  doc.rect(0, 0, pageWidth, 8, "F")

  doc.setTextColor(147, 51, 234)
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text(`Apto ${grupo.numero}`, 20, 25)

  doc.setFontSize(11)
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text(`Inquilino · Piso ${grupo.piso || 'N/A'} · ${fecha}`, 20, 33)

  let y = 50

  // Línea separadora
  doc.setDrawColor(226, 232, 240)
  doc.line(20, y, pageWidth - 20, y)
  y += 15

  // Contacto
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text("CONTACTO", 20, y)
  y += 8

  doc.setFontSize(12)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  const nombreCompleto = apt.contactoNombre
    ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim()
    : "Sin registrar"
  doc.text(nombreCompleto, 20, y)
  y += 7

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  if (apt.contactoCelular) {
    doc.text(apt.contactoCelular, 20, y)
    y += 6
  }
  if (apt.contactoEmail) {
    doc.setTextColor(100, 116, 139)
    doc.text(apt.contactoEmail, 20, y)
    y += 6
  }

  y += 10

  // Gastos - Tabla simple
  doc.setDrawColor(226, 232, 240)
  doc.line(20, y, pageWidth - 20, y)
  y += 15

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text("GASTOS MENSUALES", 20, y)
  y += 12

  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "normal")

  doc.text("Gastos Comunes", 20, y)
  doc.text(`$ ${apt.gastosComunes.toLocaleString()}`, pageWidth - 20, y, { align: "right" })
  y += 10

  doc.text("Fondo de Reserva", 20, y)
  doc.text(`$ ${apt.fondoReserva.toLocaleString()}`, pageWidth - 20, y, { align: "right" })
  y += 12

  // Total destacado
  doc.setDrawColor(147, 51, 234)
  doc.setLineWidth(0.5)
  doc.line(20, y, pageWidth - 20, y)
  y += 10

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(147, 51, 234)
  doc.text("TOTAL MENSUAL", 20, y)
  doc.text(`$ ${(apt.gastosComunes + apt.fondoReserva).toLocaleString()}`, pageWidth - 20, y, { align: "right" })

  // Estado de Cuenta
  y += 25
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(20, y, pageWidth - 20, y)
  y += 15

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text("ESTADO DE CUENTA", 20, y)
  y += 12

  // Cuadro de estado de cuenta
  const estadoColor = saldo > 0 ? [220, 38, 38] : saldo < 0 ? [22, 163, 74] : [100, 116, 139]
  const estadoTexto = saldo > 0 ? "SALDO DEUDOR" : saldo < 0 ? "SALDO A FAVOR" : "SIN SALDO PENDIENTE"

  doc.setFillColor(estadoColor[0], estadoColor[1], estadoColor[2])
  doc.roundedRect(20, y, pageWidth - 40, 30, 3, 3, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(estadoTexto, pageWidth / 2, y + 10, { align: "center" })

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(`$ ${Math.abs(saldo).toLocaleString()}`, pageWidth / 2, y + 22, { align: "center" })

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(180, 180, 180)
  doc.setFont("helvetica", "normal")
  doc.text("EdificioApp", pageWidth / 2, pageHeight - 10, { align: "center" })

  doc.save(`apto-${grupo.numero}-inquilino.pdf`)
}

// PDF combinado - Minimalista
export function generateApartamentoCompletoPDF(grupo: ApartamentoAgrupado, saldos?: SaldosCuentaCorriente) {
  if (!grupo.propietario && !grupo.inquilino) return

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })

  // Header minimalista
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageWidth, 8, "F")

  doc.setTextColor(30, 41, 59)
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text(`Apto ${grupo.numero}`, 20, 25)

  doc.setFontSize(11)
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text(`Piso ${grupo.piso || 'N/A'} · ${fecha}`, 20, 33)

  let y = 50

  // Función helper para agregar sección de persona con estado de cuenta
  const addPersonSection = (apt: Apartamento, tipo: string, color: number[]) => {
    const saldo = saldos?.[apt.id] || 0

    doc.setDrawColor(226, 232, 240)
    doc.line(20, y, pageWidth - 20, y)
    y += 12

    doc.setFontSize(9)
    doc.setTextColor(color[0], color[1], color[2])
    doc.text(tipo.toUpperCase(), 20, y)
    y += 8

    doc.setFontSize(11)
    doc.setTextColor(30, 41, 59)
    doc.setFont("helvetica", "bold")
    const nombre = apt.contactoNombre
      ? `${apt.contactoNombre} ${apt.contactoApellido || ''}`.trim()
      : "Sin registrar"
    doc.text(nombre, 20, y)

    if (apt.contactoCelular) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text(apt.contactoCelular, pageWidth - 20, y, { align: "right" })
    }
    y += 12

    // Gastos en línea
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "normal")
    doc.text(`G. Comunes: $${apt.gastosComunes.toLocaleString()}`, 20, y)
    doc.text(`F. Reserva: $${apt.fondoReserva.toLocaleString()}`, 85, y)

    doc.setFont("helvetica", "bold")
    doc.setTextColor(color[0], color[1], color[2])
    doc.text(`Total: $${(apt.gastosComunes + apt.fondoReserva).toLocaleString()}`, pageWidth - 20, y, { align: "right" })
    y += 10

    // Estado de cuenta en línea
    const estadoColor = saldo > 0 ? [220, 38, 38] : saldo < 0 ? [22, 163, 74] : [100, 116, 139]
    const estadoTexto = saldo > 0 ? "Debe:" : saldo < 0 ? "A favor:" : "Sin saldo"

    doc.setFontSize(9)
    doc.setTextColor(estadoColor[0], estadoColor[1], estadoColor[2])
    doc.setFont("helvetica", "bold")
    doc.text(`${estadoTexto} $${Math.abs(saldo).toLocaleString()}`, 20, y)
    y += 12
  }

  // Propietario
  if (grupo.propietario) {
    addPersonSection(grupo.propietario, "Propietario", [37, 99, 235])
  }

  // Inquilino
  if (grupo.inquilino) {
    addPersonSection(grupo.inquilino, "Inquilino", [147, 51, 234])
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(180, 180, 180)
  doc.setFont("helvetica", "normal")
  doc.text("EdificioApp", pageWidth / 2, pageHeight - 10, { align: "center" })

  doc.save(`apto-${grupo.numero}-completo.pdf`)
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
    fecha: Date
    descripcion: string
    referencia: string | null
    clasificacion: "GASTO_COMUN" | "FONDO_RESERVA" | null
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
  const fecha = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  // Header
  doc.setFillColor(30, 64, 175) // blue-800
  doc.rect(0, 0, pageWidth, 45, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.text("Estado de Cuenta Bancario", 20, 22)

  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(`${data.cuenta.banco} - ${data.cuenta.tipoCuenta}`, 20, 32)
  doc.text(`Cuenta: ${data.cuenta.numeroCuenta}`, 20, 40)

  // Fecha generación
  doc.setFontSize(10)
  doc.text(fecha, pageWidth - 20, 22, { align: "right" })

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

  // Header de tabla
  doc.setFillColor(241, 245, 249)
  doc.rect(15, y, pageWidth - 30, 10, "F")

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(71, 85, 105)
  y += 7
  doc.text("Fecha", 20, y)
  doc.text("Descripción", 50, y)
  doc.text("Ingreso", 120, y, { align: "right" })
  doc.text("Egreso", 150, y, { align: "right" })
  doc.text("Saldo", pageWidth - 20, y, { align: "right" })

  y += 8

  // Línea de saldo inicial
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)
  doc.text("-", 20, y)
  doc.text("Saldo Inicial", 50, y)
  doc.text("-", 120, y, { align: "right" })
  doc.text("-", 150, y, { align: "right" })
  doc.setTextColor(30, 41, 59)
  doc.text(`$${data.resumen.saldoInicial.toLocaleString()}`, pageWidth - 20, y, {
    align: "right",
  })
  y += 8

  // Movimientos
  data.movimientos.forEach((mov) => {
    if (y > 270) {
      doc.addPage()
      y = 20

      // Repetir header en nueva página
      doc.setFillColor(241, 245, 249)
      doc.rect(15, y, pageWidth - 30, 10, "F")
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(71, 85, 105)
      y += 7
      doc.text("Fecha", 20, y)
      doc.text("Descripción", 50, y)
      doc.text("Ingreso", 120, y, { align: "right" })
      doc.text("Egreso", 150, y, { align: "right" })
      doc.text("Saldo", pageWidth - 20, y, { align: "right" })
      y += 8
    }

    const fechaMov = new Date(mov.fecha).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    })

    doc.setFont("helvetica", "normal")
    doc.setTextColor(71, 85, 105)
    doc.text(fechaMov, 20, y)

    // Descripción (truncar si es muy larga)
    const desc =
      mov.descripcion.length > 35
        ? mov.descripcion.substring(0, 32) + "..."
        : mov.descripcion
    doc.setTextColor(30, 41, 59)
    doc.text(desc, 50, y)

    // Ingreso
    if (mov.tipo === "INGRESO") {
      doc.setTextColor(22, 163, 74)
      doc.text(`+$${mov.monto.toLocaleString()}`, 120, y, { align: "right" })
      doc.setTextColor(71, 85, 105)
      doc.text("-", 150, y, { align: "right" })
    } else {
      doc.setTextColor(71, 85, 105)
      doc.text("-", 120, y, { align: "right" })
      doc.setTextColor(220, 38, 38)
      doc.text(`-$${mov.monto.toLocaleString()}`, 150, y, { align: "right" })
    }

    // Saldo
    doc.setTextColor(30, 41, 59)
    doc.setFont("helvetica", "bold")
    doc.text(`$${mov.saldoAcumulado.toLocaleString()}`, pageWidth - 20, y, {
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
