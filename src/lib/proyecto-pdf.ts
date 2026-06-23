import jsPDF from "jspdf"
import type { ReporteProyectoData } from "./database"

export function generateReporteProyectoPDF(data: ReporteProyectoData) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, pageWidth, 28, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Edificio Constituyente II", 20, 10)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`Constituyente 2015 - Montevideo  |  Proyecto: ${data.proyecto.nombre}`, 20, 19)

  let y = 36

  // Info del proyecto
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(9)
  doc.text("DATOS DEL PROYECTO", 20, y)
  y += 8

  doc.setTextColor(30, 41, 59)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")

  if (data.proyecto.fechaInicio) {
    const fechaInicio = new Date(data.proyecto.fechaInicio).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    const fechaFin = data.proyecto.fechaFin
      ? new Date(data.proyecto.fechaFin).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
      : "En curso"
    doc.text(`Periodo: ${fechaInicio} - ${fechaFin}`, 20, y)
    y += 6
  }

  doc.text(`Estado: ${data.proyecto.activo ? "Activo" : "Inactivo"}`, 20, y)
  y += 6

  if (data.proyecto.observaciones) {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.text("Observaciones:", 20, y)
    y += 5
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    const lines = doc.splitTextToSize(data.proyecto.observaciones, pageWidth - 40)
    doc.text(lines, 20, y)
    y += lines.length * 4.5
  }

  y += 6

  // Resumen financiero
  doc.setDrawColor(226, 232, 240)
  doc.line(20, y, pageWidth - 20, y)
  y += 8

  doc.setTextColor(100, 116, 139)
  doc.setFontSize(9)
  doc.text("RESUMEN FINANCIERO", 20, y)
  y += 8

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)
  doc.text("Presupuesto:", 20, y)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 64, 175)
  doc.text(`$${data.presupuesto.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 48, y)

  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)
  doc.text("Ejecutado:", 85, y)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(185, 28, 28)
  doc.text(`$${data.ejecutado.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 107, y)

  const resultado = data.presupuesto - data.ejecutado
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)
  doc.text("Resultado:", 140, y)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(resultado >= 0 ? 22 : 220, resultado >= 0 ? 163 : 38, resultado >= 0 ? 74 : 38)
  doc.text(`$${resultado.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 163, y)

  y += 6

  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)
  doc.text("% Ejecutado:", 20, y)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(71, 85, 105)
  doc.text(`${data.porcentajeEjecutado.toFixed(1)}%`, 48, y)

  y += 10

  // Barra de progreso
  if (data.presupuesto > 0) {
    doc.setFillColor(226, 232, 240)
    doc.roundedRect(20, y, pageWidth - 40, 6, 2, 2, "F")
    const progreso = Math.min(data.porcentajeEjecutado, 100)
    const barWidth = ((pageWidth - 40) * progreso) / 100
    if (data.porcentajeEjecutado > 100) {
      doc.setFillColor(239, 68, 68) // red
    } else if (data.porcentajeEjecutado > 80) {
      doc.setFillColor(249, 115, 22) // orange
    } else {
      doc.setFillColor(37, 99, 235) // blue
    }
    if (barWidth > 0) {
      doc.roundedRect(20, y, barWidth, 6, 2, 2, "F")
    }
    y += 15
  }

  // Tabla de movimientos
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`DETALLE DE MOVIMIENTOS (${data.movimientos.length})`, 20, y)
  y += 8

  if (data.movimientos.length === 0) {
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(10)
    doc.text("No hay movimientos asociados a este proyecto", pageWidth / 2, y + 10, { align: "center" })
  } else {
    // Header de tabla
    doc.setFillColor(241, 245, 249)
    doc.rect(20, y, pageWidth - 40, 8, "F")
    doc.setTextColor(71, 85, 105)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("Fecha", 22, y + 5.5)
    doc.text("Descripcion", 48, y + 5.5)
    doc.text("Cuenta", 110, y + 5.5)
    doc.text("Monto", pageWidth - 22, y + 5.5, { align: "right" })
    y += 14

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)

    for (const mov of data.movimientos) {
      if (y > 270) {
        doc.addPage()
        y = 20
      }

      const fecha = new Date(mov.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })

      doc.setTextColor(71, 85, 105)
      doc.text(fecha, 22, y)

      doc.setTextColor(30, 41, 59)
      const desc = mov.descripcion.length > 35 ? mov.descripcion.substring(0, 35) + "..." : mov.descripcion
      doc.text(desc, 48, y)

      doc.setTextColor(100, 116, 139)
      doc.setFontSize(7)
      doc.text(`${mov.cuentaBancaria} - ${mov.numeroCuenta}`, 110, y)
      doc.setFontSize(8)

      if (mov.tipo === "INGRESO") {
        doc.setTextColor(22, 163, 74)
        doc.text(`+$${mov.monto.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 22, y, { align: "right" })
      } else {
        doc.setTextColor(220, 38, 38)
        doc.text(`-$${mov.monto.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 22, y, { align: "right" })
      }

      y += 7

      // Linea separadora
      doc.setDrawColor(241, 245, 249)
      doc.line(20, y - 2, pageWidth - 20, y - 2)
    }

    // Totales
    y += 5
    doc.setDrawColor(30, 41, 59)
    doc.line(20, y, pageWidth - 20, y)
    y += 8

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(30, 41, 59)
    doc.text("Total Egresos:", 120, y)
    doc.setTextColor(220, 38, 38)
    doc.text(`-$${data.totalEgresos.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 22, y, { align: "right" })
  }

  // Retornar el arraybuffer y nombre de archivo
  const fileName = `Reporte_Proyecto_${data.proyecto.nombre.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
  const arrayBuffer = doc.output("arraybuffer")
  return { arrayBuffer, fileName }
}
