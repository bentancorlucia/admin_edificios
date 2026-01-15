import jsPDF from "jspdf"
import { InformeData } from "@/app/informes/actions"

const tipoOcupacionLabels: Record<string, string> = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
}

export function generateInformePDF(data: InformeData, periodoLabel: string) {
  // Filtrar solo avisos activos
  const avisosActivos = (data.avisos || []).filter((a) => a.activo)
  const doc = new jsPDF("landscape")
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, pageWidth, 35, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.text("Informe Mensual de Cuenta Corriente", 20, 18)

  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text(`Periodo: ${periodoLabel}`, 20, 28)

  doc.setFontSize(10)
  const fechaGen = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  doc.text(`Generado: ${fechaGen}`, pageWidth - 20, 18, { align: "right" })

  let y = 45

  // Resumen de totales en cajas
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text("RESUMEN GENERAL", 20, y)
  y += 8

  const boxWidth = (pageWidth - 60) / 5
  const boxHeight = 25
  const startX = 20

  const formatCurrency = (val: number) =>
    `$ ${val.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Saldo Anterior
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(startX, y, boxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text("Saldo Anterior", startX + boxWidth / 2, y + 8, { align: "center" })
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  doc.text(formatCurrency(data.totales.totalSaldoAnterior), startX + boxWidth / 2, y + 18, {
    align: "center",
  })

  // Pagos del Mes
  doc.setFillColor(220, 252, 231)
  doc.roundedRect(startX + boxWidth + 5, y, boxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(8)
  doc.setTextColor(22, 163, 74)
  doc.setFont("helvetica", "normal")
  doc.text("Pagos del Mes", startX + boxWidth + 5 + boxWidth / 2, y + 8, { align: "center" })
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(formatCurrency(data.totales.totalPagosMes), startX + boxWidth + 5 + boxWidth / 2, y + 18, {
    align: "center",
  })

  // Gastos Comunes
  doc.setFillColor(219, 234, 254)
  doc.roundedRect(startX + (boxWidth + 5) * 2, y, boxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(8)
  doc.setTextColor(37, 99, 235)
  doc.setFont("helvetica", "normal")
  doc.text("Gastos Comunes", startX + (boxWidth + 5) * 2 + boxWidth / 2, y + 8, { align: "center" })
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(
    formatCurrency(data.totales.totalGastosComunesMes),
    startX + (boxWidth + 5) * 2 + boxWidth / 2,
    y + 18,
    { align: "center" }
  )

  // Fondo Reserva
  doc.setFillColor(243, 232, 255)
  doc.roundedRect(startX + (boxWidth + 5) * 3, y, boxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(8)
  doc.setTextColor(147, 51, 234)
  doc.setFont("helvetica", "normal")
  doc.text("Fondo Reserva", startX + (boxWidth + 5) * 3 + boxWidth / 2, y + 8, { align: "center" })
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(
    formatCurrency(data.totales.totalFondoReservaMes),
    startX + (boxWidth + 5) * 3 + boxWidth / 2,
    y + 18,
    { align: "center" }
  )

  // Saldo Actual
  const saldoColor = data.totales.totalSaldoActual > 0 ? [220, 38, 38] : [22, 163, 74]
  doc.setFillColor(saldoColor[0], saldoColor[1], saldoColor[2])
  doc.roundedRect(startX + (boxWidth + 5) * 4, y, boxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "normal")
  doc.text("Saldo Actual", startX + (boxWidth + 5) * 4 + boxWidth / 2, y + 8, { align: "center" })
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(
    formatCurrency(data.totales.totalSaldoActual),
    startX + (boxWidth + 5) * 4 + boxWidth / 2,
    y + 18,
    { align: "center" }
  )

  y += boxHeight + 15

  // Tabla de apartamentos (DESGLOSE POR APARTAMENTO)
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text("DESGLOSE POR APARTAMENTO", 20, y)
  y += 8

  // Header de tabla
  doc.setFillColor(241, 245, 249)
  doc.rect(15, y, pageWidth - 30, 10, "F")

  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(71, 85, 105)
  y += 7

  const colWidths = {
    apto: 35,
    tipo: 40,
    saldoAnt: 45,
    pagos: 45,
    gc: 45,
    fr: 45,
    saldoAct: 45,
  }

  let x = 20
  doc.text("Apto", x, y)
  x += colWidths.apto
  doc.text("Tipo", x, y)
  x += colWidths.tipo
  doc.text("Saldo Ant.", x, y, { align: "right" })
  x += colWidths.saldoAnt
  doc.text("Pagos Mes", x, y, { align: "right" })
  x += colWidths.pagos
  doc.text("G. Comunes", x, y, { align: "right" })
  x += colWidths.gc
  doc.text("F. Reserva", x, y, { align: "right" })
  x += colWidths.fr
  doc.text("Saldo Actual", x, y, { align: "right" })

  y += 6

  // Filas de datos
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)

  for (const apt of data.apartamentos) {
    if (y > pageHeight - 25) {
      doc.addPage("landscape")
      y = 20

      // Repetir header
      doc.setFillColor(241, 245, 249)
      doc.rect(15, y, pageWidth - 30, 10, "F")
      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(71, 85, 105)
      y += 7

      x = 20
      doc.text("Apto", x, y)
      x += colWidths.apto
      doc.text("Tipo", x, y)
      x += colWidths.tipo
      doc.text("Saldo Ant.", x, y, { align: "right" })
      x += colWidths.saldoAnt
      doc.text("Pagos Mes", x, y, { align: "right" })
      x += colWidths.pagos
      doc.text("G. Comunes", x, y, { align: "right" })
      x += colWidths.gc
      doc.text("F. Reserva", x, y, { align: "right" })
      x += colWidths.fr
      doc.text("Saldo Actual", x, y, { align: "right" })
      y += 6

      doc.setFont("helvetica", "normal")
    }

    x = 20
    doc.setTextColor(30, 41, 59)
    doc.text(apt.numero, x, y)

    x += colWidths.apto
    doc.setTextColor(apt.tipoOcupacion === "PROPIETARIO" ? 37 : 147, apt.tipoOcupacion === "PROPIETARIO" ? 99 : 51, apt.tipoOcupacion === "PROPIETARIO" ? 235 : 234)
    doc.text(tipoOcupacionLabels[apt.tipoOcupacion], x, y)

    x += colWidths.tipo
    doc.setTextColor(apt.saldoAnterior > 0 ? 220 : 22, apt.saldoAnterior > 0 ? 38 : 163, apt.saldoAnterior > 0 ? 38 : 74)
    doc.text(formatCurrency(apt.saldoAnterior), x, y, { align: "right" })

    x += colWidths.saldoAnt
    doc.setTextColor(22, 163, 74)
    doc.text(formatCurrency(apt.pagosMes), x, y, { align: "right" })

    x += colWidths.pagos
    doc.setTextColor(30, 41, 59)
    doc.text(formatCurrency(apt.gastosComunesMes), x, y, { align: "right" })

    x += colWidths.gc
    doc.text(formatCurrency(apt.fondoReservaMes), x, y, { align: "right" })

    x += colWidths.fr
    doc.setTextColor(apt.saldoActual > 0 ? 220 : 22, apt.saldoActual > 0 ? 38 : 163, apt.saldoActual > 0 ? 38 : 74)
    doc.setFont("helvetica", "bold")
    doc.text(formatCurrency(apt.saldoActual), x, y, { align: "right" })
    doc.setFont("helvetica", "normal")

    y += 6
  }

  // Fila de totales
  y += 2
  doc.setFillColor(226, 232, 240)
  doc.rect(15, y - 4, pageWidth - 30, 10, "F")

  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 41, 59)
  y += 3

  x = 20
  doc.text("TOTALES", x, y)

  x = 20 + colWidths.apto + colWidths.tipo
  doc.text(formatCurrency(data.totales.totalSaldoAnterior), x, y, { align: "right" })

  x += colWidths.saldoAnt
  doc.setTextColor(22, 163, 74)
  doc.text(formatCurrency(data.totales.totalPagosMes), x, y, { align: "right" })

  x += colWidths.pagos
  doc.setTextColor(30, 41, 59)
  doc.text(formatCurrency(data.totales.totalGastosComunesMes), x, y, { align: "right" })

  x += colWidths.gc
  doc.text(formatCurrency(data.totales.totalFondoReservaMes), x, y, { align: "right" })

  x += colWidths.fr
  doc.setTextColor(
    data.totales.totalSaldoActual > 0 ? 220 : 22,
    data.totales.totalSaldoActual > 0 ? 38 : 163,
    data.totales.totalSaldoActual > 0 ? 38 : 74
  )
  doc.text(formatCurrency(data.totales.totalSaldoActual), x, y, { align: "right" })

  y += 15

  // Sección de Avisos (si hay avisos activos)
  if (avisosActivos.length > 0) {
    // Verificar si necesitamos nueva página
    if (y > pageHeight - 60) {
      doc.addPage("landscape")
      y = 20
    }

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "normal")
    doc.text("AVISOS", 20, y)
    y += 6

    // Fondo para avisos
    const avisoBoxHeight = Math.min(avisosActivos.length * 8 + 10, 50)
    doc.setFillColor(255, 251, 235) // amber-50
    doc.roundedRect(15, y, pageWidth - 30, avisoBoxHeight, 2, 2, "F")
    doc.setDrawColor(251, 191, 36) // amber-400
    doc.roundedRect(15, y, pageWidth - 30, avisoBoxHeight, 2, 2, "S")

    y += 7
    doc.setFontSize(9)
    doc.setTextColor(146, 64, 14) // amber-800

    for (const aviso of avisosActivos) {
      // Verificar si necesitamos nueva página
      if (y > pageHeight - 30) {
        doc.addPage("landscape")
        y = 20
      }

      // Bullet point y texto
      doc.setFont("helvetica", "bold")
      doc.text("•", 20, y)
      doc.setFont("helvetica", "normal")

      // Dividir texto largo en múltiples líneas
      const maxWidth = pageWidth - 55
      const lines = doc.splitTextToSize(aviso.texto, maxWidth)
      doc.text(lines, 28, y)

      y += lines.length * 5 + 3
    }

    y += 10
  }

  // Resumen Bancario (Detalle de cuentas bancarias)
  // Verificar si necesitamos nueva página
  if (y > pageHeight - 50) {
    doc.addPage("landscape")
    y = 20
  }

  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text("DETALLE DE CUENTAS BANCARIAS", 20, y)
  y += 8

  const bankBoxWidth = (pageWidth - 60) / 5

  // Ingreso G. Comunes
  doc.setFillColor(220, 252, 231)
  doc.roundedRect(startX, y, bankBoxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(7)
  doc.setTextColor(22, 163, 74)
  doc.text("Ingreso G. Comunes", startX + bankBoxWidth / 2, y + 8, { align: "center" })
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(formatCurrency(data.resumenBancario.ingresoGastosComunes), startX + bankBoxWidth / 2, y + 18, {
    align: "center",
  })

  // Ingreso F. Reserva
  doc.setFillColor(220, 252, 231)
  doc.roundedRect(startX + bankBoxWidth + 5, y, bankBoxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(7)
  doc.setTextColor(22, 163, 74)
  doc.setFont("helvetica", "normal")
  doc.text("Ingreso F. Reserva", startX + bankBoxWidth + 5 + bankBoxWidth / 2, y + 8, { align: "center" })
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(
    formatCurrency(data.resumenBancario.ingresoFondoReserva),
    startX + bankBoxWidth + 5 + bankBoxWidth / 2,
    y + 18,
    { align: "center" }
  )

  // Egreso G. Comunes
  doc.setFillColor(254, 226, 226)
  doc.roundedRect(startX + (bankBoxWidth + 5) * 2, y, bankBoxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(7)
  doc.setTextColor(220, 38, 38)
  doc.setFont("helvetica", "normal")
  doc.text("Egreso G. Comunes", startX + (bankBoxWidth + 5) * 2 + bankBoxWidth / 2, y + 8, {
    align: "center",
  })
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(
    formatCurrency(data.resumenBancario.egresoGastosComunes),
    startX + (bankBoxWidth + 5) * 2 + bankBoxWidth / 2,
    y + 18,
    { align: "center" }
  )

  // Egreso F. Reserva
  doc.setFillColor(254, 226, 226)
  doc.roundedRect(startX + (bankBoxWidth + 5) * 3, y, bankBoxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(7)
  doc.setTextColor(220, 38, 38)
  doc.setFont("helvetica", "normal")
  doc.text("Egreso F. Reserva", startX + (bankBoxWidth + 5) * 3 + bankBoxWidth / 2, y + 8, {
    align: "center",
  })
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(
    formatCurrency(data.resumenBancario.egresoFondoReserva),
    startX + (bankBoxWidth + 5) * 3 + bankBoxWidth / 2,
    y + 18,
    { align: "center" }
  )

  // Saldo Bancario
  doc.setFillColor(30, 64, 175)
  doc.roundedRect(startX + (bankBoxWidth + 5) * 4, y, bankBoxWidth, boxHeight, 2, 2, "F")
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "normal")
  doc.text("Saldo Bancario", startX + (bankBoxWidth + 5) * 4 + bankBoxWidth / 2, y + 8, {
    align: "center",
  })
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(
    formatCurrency(data.resumenBancario.saldoBancarioTotal),
    startX + (bankBoxWidth + 5) * 4 + bankBoxWidth / 2,
    y + 18,
    { align: "center" }
  )

  y += boxHeight + 15

  // Detalle de Egresos Bancarios
  if (data.detalleEgresos && data.detalleEgresos.length > 0) {
    // Verificar si necesitamos nueva página
    if (y > pageHeight - 60) {
      doc.addPage("landscape")
      y = 20
    }

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "normal")
    doc.text("DETALLE DE EGRESOS", 20, y)
    y += 8

    // Header de tabla de egresos
    doc.setFillColor(254, 226, 226) // red-100
    doc.rect(15, y, pageWidth - 30, 10, "F")

    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(153, 27, 27) // red-800
    y += 7

    const egresoColWidths = {
      fecha: 35,
      descripcion: 120,
      clasificacion: 50,
      banco: 50,
      monto: 45,
    }

    let ex = 20
    doc.text("Fecha", ex, y)
    ex += egresoColWidths.fecha
    doc.text("Descripción", ex, y)
    ex += egresoColWidths.descripcion
    doc.text("Clasificación", ex, y)
    ex += egresoColWidths.clasificacion
    doc.text("Banco", ex, y)
    ex += egresoColWidths.banco
    doc.text("Monto", ex, y, { align: "right" })

    y += 6

    // Filas de egresos
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)

    const clasificacionLabels: Record<string, string> = {
      GASTO_COMUN: "G. Común",
      FONDO_RESERVA: "F. Reserva",
      SIN_CLASIFICAR: "Sin clasificar",
    }

    let totalEgresos = 0

    for (const egreso of data.detalleEgresos) {
      if (y > pageHeight - 25) {
        doc.addPage("landscape")
        y = 20

        // Repetir header de egresos
        doc.setFillColor(254, 226, 226)
        doc.rect(15, y, pageWidth - 30, 10, "F")
        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(153, 27, 27)
        y += 7

        ex = 20
        doc.text("Fecha", ex, y)
        ex += egresoColWidths.fecha
        doc.text("Descripción", ex, y)
        ex += egresoColWidths.descripcion
        doc.text("Clasificación", ex, y)
        ex += egresoColWidths.clasificacion
        doc.text("Banco", ex, y)
        ex += egresoColWidths.banco
        doc.text("Monto", ex, y, { align: "right" })
        y += 6

        doc.setFont("helvetica", "normal")
      }

      ex = 20
      doc.setTextColor(30, 41, 59)

      // Fecha
      const fechaEgreso = new Date(egreso.fecha).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
      doc.text(fechaEgreso, ex, y)

      // Descripción (truncar si es muy larga)
      ex += egresoColWidths.fecha
      const descMaxWidth = egresoColWidths.descripcion - 5
      let descripcion = egreso.descripcion
      while (doc.getTextWidth(descripcion) > descMaxWidth && descripcion.length > 3) {
        descripcion = descripcion.slice(0, -4) + "..."
      }
      doc.text(descripcion, ex, y)

      // Clasificación
      ex += egresoColWidths.descripcion
      doc.text(clasificacionLabels[egreso.clasificacion] || egreso.clasificacion, ex, y)

      // Banco
      ex += egresoColWidths.clasificacion
      doc.text(egreso.banco || "N/A", ex, y)

      // Monto
      ex += egresoColWidths.banco
      doc.setTextColor(220, 38, 38) // red-600
      doc.text(formatCurrency(egreso.monto), ex, y, { align: "right" })

      totalEgresos += egreso.monto
      y += 6
    }

    // Fila de total de egresos
    y += 2
    doc.setFillColor(254, 202, 202) // red-200
    doc.rect(15, y - 4, pageWidth - 30, 10, "F")

    doc.setFont("helvetica", "bold")
    doc.setTextColor(153, 27, 27)
    y += 3

    ex = 20
    doc.text("TOTAL EGRESOS", ex, y)

    ex = 20 + egresoColWidths.fecha + egresoColWidths.descripcion + egresoColWidths.clasificacion + egresoColWidths.banco
    doc.setTextColor(220, 38, 38)
    doc.text(formatCurrency(totalEgresos), ex, y, { align: "right" })
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.setFont("helvetica", "normal")
  doc.text("EdificioApp - Informe Mensual de Cuenta Corriente", pageWidth / 2, pageHeight - 10, {
    align: "center",
  })

  const fileName = `informe-mensual-${periodoLabel.toLowerCase().replace(/\s/g, "-")}.pdf`
  doc.save(fileName)
}
