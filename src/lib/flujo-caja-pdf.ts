import jsPDF from "jspdf"
import type { FlujoCajaData } from "./database"

function formatNum(n: number): string {
  return n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export interface FlujoCajaEffectiveValues {
  cargosTotalPorMes: number[]
  totalEgresosPorMes: number[]
  balancePorMes: number[]
  servicioProyeccion: Record<string, number[]> // key=servicioId, value=montosPorMes efectivos
  gcPromedio: number  // Gasto Comun unitario promedio (meses reales)
  gcProyeccion: number // Gasto Comun unitario proyectado (efectivo)
}

export function generateFlujoCajaPDF(data: FlujoCajaData, effective?: FlujoCajaEffectiveValues) {
  const doc = new jsPDF({ orientation: "landscape" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const clasificacionLabel = data.clasificacionFiltro === 'GASTO_COMUN'
    ? 'Gastos Comunes'
    : data.clasificacionFiltro === 'FONDO_RESERVA'
      ? 'Fondo de Reserva'
      : 'Todos'

  // Separar columnas reales y proyectadas (con indice original)
  const realCols = data.columnas.map((c, i) => ({ ...c, i })).filter(c => !c.esProyeccion)
  const proyCols = data.columnas.map((c, i) => ({ ...c, i })).filter(c => c.esProyeccion)

  // Header
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, pageWidth, 24, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.text("Flujo de Caja - Proyección - Edificio Constituyente II", 14, 10)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  const primerMes = data.columnas[0]
  const ultimoMesReal = realCols[realCols.length - 1]
  const periodoLabel = primerMes && ultimoMesReal
    ? `${primerMes.label} - ${ultimoMesReal.label}`
    : ''
  doc.text(
    `Periodo: ${periodoLabel}  |  Clasificacion: ${clasificacionLabel}  |  Proyeccion: ${proyCols.length} mes(es)`,
    14, 18
  )

  // Configurar tabla
  const marginLeft = 14
  const marginRight = 14
  const conceptColWidth = 52
  const promedioColWidth = 24
  // Total de columnas de datos = reales + proyectadas
  const totalDataCols = realCols.length + proyCols.length
  const availableWidth = pageWidth - marginLeft - marginRight - conceptColWidth - promedioColWidth
  const pageColWidth = Math.min(availableWidth / Math.max(totalDataCols, 1), 28)

  // Posiciones X para cada seccion
  const realStartX = marginLeft + conceptColWidth
  const promX = realStartX + realCols.length * pageColWidth
  const proyStartX = promX + promedioColWidth

  let y = 30

  // === ENCABEZADO DE TABLA ===
  doc.setFillColor(241, 245, 249)
  doc.rect(marginLeft, y, pageWidth - marginLeft - marginRight, 12, "F")

  doc.setTextColor(71, 85, 105)
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.text("Concepto", marginLeft + 2, y + 7)

  // Encabezados meses reales
  for (let ri = 0; ri < realCols.length; ri++) {
    const col = realCols[ri]
    const x = realStartX + ri * pageColWidth
    const parts = col.label.split(" ")
    doc.setTextColor(71, 85, 105)
    doc.text(parts[0] || "", x + pageColWidth - 2, y + 5, { align: "right" })
    if (parts[1]) {
      doc.setFontSize(6)
      doc.text(parts[1], x + pageColWidth - 2, y + 9, { align: "right" })
      doc.setFontSize(7)
    }
  }

  // Encabezado Promedio
  doc.setTextColor(71, 85, 105)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.text("Promedio", promX + promedioColWidth - 2, y + 7, { align: "right" })

  // Encabezados meses proyectados
  for (let pi = 0; pi < proyCols.length; pi++) {
    const col = proyCols[pi]
    const x = proyStartX + pi * pageColWidth
    const parts = col.label.split(" ")
    doc.setTextColor(180, 130, 40)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.text(parts[0] || "", x + pageColWidth - 2, y + 4, { align: "right" })
    if (parts[1]) {
      doc.setFontSize(6)
      doc.text(parts[1], x + pageColWidth - 2, y + 8, { align: "right" })
    }
    doc.setFontSize(5)
    doc.text("(proy.)", x + pageColWidth - 2, y + 11, { align: "right" })
    doc.setFontSize(7)
  }

  y += 16

  // === FUNCION PARA DIBUJAR FILA ===
  // values: array indexado igual que data.columnas (indice original)
  const drawRow = (
    label: string,
    values: number[],
    promedio: number,
    opts: {
      bold?: boolean
      bgColor?: [number, number, number]
      textColor?: [number, number, number]
      indent?: boolean
      fontSize?: number
    } = {}
  ) => {
    const rowHeight = 7
    const fs = opts.fontSize || 7

    if (y + rowHeight > pageHeight - 10) {
      doc.addPage("landscape")
      y = 20
    }

    if (opts.bgColor) {
      doc.setFillColor(...opts.bgColor)
      doc.rect(marginLeft, y - 1, pageWidth - marginLeft - marginRight, rowHeight, "F")
    }

    doc.setFontSize(fs)
    doc.setFont("helvetica", opts.bold ? "bold" : "normal")
    doc.setTextColor(...(opts.textColor || [30, 41, 59]))

    const labelX = opts.indent ? marginLeft + 8 : marginLeft + 2
    doc.text(label, labelX, y + 4)

    // Valores reales
    for (let ri = 0; ri < realCols.length; ri++) {
      const x = realStartX + ri * pageColWidth
      const val = values[realCols[ri].i]
      doc.setTextColor(...(opts.textColor || [30, 41, 59]))
      doc.setFont("helvetica", opts.bold ? "bold" : "normal")
      doc.text(`$${formatNum(val)}`, x + pageColWidth - 2, y + 4, { align: "right" })
    }

    // Promedio
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...(opts.textColor || [30, 41, 59]))
    doc.text(`$${formatNum(promedio)}`, promX + promedioColWidth - 2, y + 4, { align: "right" })

    // Valores proyectados
    for (let pi = 0; pi < proyCols.length; pi++) {
      const x = proyStartX + pi * pageColWidth
      const val = values[proyCols[pi].i]
      doc.setTextColor(180, 130, 40)
      doc.setFont("helvetica", "italic")
      doc.text(`$${formatNum(val)}`, x + pageColWidth - 2, y + 4, { align: "right" })
    }

    y += rowHeight

    // Separador
    doc.setDrawColor(226, 232, 240)
    doc.line(marginLeft, y - 1, pageWidth - marginRight, y - 1)
  }

  // --- CARGOS MENSUALES ---
  const effCargos = effective?.cargosTotalPorMes || data.cargosTotalPorMes
  drawRow(
    "CARGOS MENSUALES",
    effCargos,
    data.promedioCargosGlobal,
    { bold: true, bgColor: [219, 234, 254], textColor: [30, 64, 175] }
  )

  if (data.clasificacionFiltro === 'AMBOS') {
    const mesesRealesCount = realCols.length
    const promGC = mesesRealesCount > 0
      ? realCols.reduce((s, c) => s + data.cargosGCPorMes[c.i], 0) / mesesRealesCount : 0
    const promFR = mesesRealesCount > 0
      ? realCols.reduce((s, c) => s + data.cargosFRPorMes[c.i], 0) / mesesRealesCount : 0

    drawRow(
      "Gastos Comunes",
      data.cargosGCPorMes,
      promGC,
      { indent: true, textColor: [100, 116, 139], fontSize: 6.5 }
    )
    drawRow(
      "Fondo de Reserva",
      data.cargosFRPorMes,
      promFR,
      { indent: true, textColor: [100, 116, 139], fontSize: 6.5 }
    )
  }

  y += 3

  // --- GASTOS ---
  const effEgresos = effective?.totalEgresosPorMes || data.totalEgresosPorMes
  drawRow(
    "GASTOS",
    effEgresos,
    data.promedioEgresosGlobal,
    { bold: true, bgColor: [254, 226, 226], textColor: [185, 28, 28] }
  )

  // Detalle por servicio
  for (const servicio of data.servicios) {
    const sKey = servicio.servicioId || '__sin_servicio__'
    const effServicio = effective?.servicioProyeccion[sKey]
    const valores = servicio.montosPorMes.map((v, i) => {
      if (data.columnas[i].esProyeccion) {
        return effServicio ? effServicio[i] : (v !== null ? v : servicio.promedio)
      }
      return v || 0
    })
    drawRow(
      servicio.servicioNombre.length > 28
        ? servicio.servicioNombre.substring(0, 28) + "..."
        : servicio.servicioNombre,
      valores,
      servicio.promedio,
      { indent: true, textColor: [100, 116, 139], fontSize: 6.5 }
    )
  }

  y += 3

  // --- RESULTADO ---
  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.5)
  doc.line(marginLeft, y, pageWidth - marginRight, y)
  doc.setLineWidth(0.2)
  y += 2

  const totalCargosReales = realCols.reduce((s, c) => s + data.cargosTotalPorMes[c.i], 0)
  const totalEgresosReales = realCols.reduce((s, c) => s + data.totalEgresosPorMes[c.i], 0)
  const balanceReal = totalCargosReales - totalEgresosReales
  const promBalance = data.promedioCargosGlobal - data.promedioEgresosGlobal

  const rowHeight = 8
  if (y + rowHeight > pageHeight - 10) {
    doc.addPage("landscape")
    y = 20
  }

  doc.setFillColor(balanceReal >= 0 ? 220 : 254, balanceReal >= 0 ? 252 : 226, balanceReal >= 0 ? 231 : 226)
  doc.rect(marginLeft, y - 1, pageWidth - marginLeft - marginRight, rowHeight, "F")

  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 41, 59)
  doc.text("RESULTADO", marginLeft + 2, y + 5)

  const effBalance = effective?.balancePorMes || data.balancePorMes

  // Valores reales del resultado
  for (let ri = 0; ri < realCols.length; ri++) {
    const x = realStartX + ri * pageColWidth
    const val = effBalance[realCols[ri].i]
    doc.setTextColor(val >= 0 ? 22 : 220, val >= 0 ? 163 : 38, val >= 0 ? 74 : 38)
    doc.text(`$${formatNum(val)}`, x + pageColWidth - 2, y + 5, { align: "right" })
  }

  // Promedio del resultado
  doc.setTextColor(promBalance >= 0 ? 22 : 220, promBalance >= 0 ? 163 : 38, promBalance >= 0 ? 74 : 38)
  doc.text(`$${formatNum(promBalance)}`, promX + promedioColWidth - 2, y + 5, { align: "right" })

  // Valores proyectados del resultado
  for (let pi = 0; pi < proyCols.length; pi++) {
    const x = proyStartX + pi * pageColWidth
    const val = effBalance[proyCols[pi].i]
    doc.setTextColor(val >= 0 ? 22 : 220, val >= 0 ? 163 : 38, val >= 0 ? 74 : 38)
    doc.text(`$${formatNum(val)}`, x + pageColWidth - 2, y + 5, { align: "right" })
  }

  y += rowHeight + 8

  // Resumen al final
  if (y + 30 < pageHeight - 10) {
    doc.setDrawColor(226, 232, 240)
    doc.line(marginLeft, y, pageWidth - marginRight, y)
    y += 8

    doc.setTextColor(100, 116, 139)
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.text("RESUMEN DEL PERIODO", marginLeft, y)
    y += 7

    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text("Total Cargos:", marginLeft, y)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 64, 175)
    doc.text(`$${formatNum(totalCargosReales)}`, marginLeft + 30, y)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text("Total Gastos:", marginLeft + 70, y)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(185, 28, 28)
    doc.text(`$${formatNum(totalEgresosReales)}`, marginLeft + 100, y)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text("Resultado:", marginLeft + 140, y)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(balanceReal >= 0 ? 22 : 220, balanceReal >= 0 ? 163 : 38, balanceReal >= 0 ? 74 : 38)
    doc.text(`$${formatNum(balanceReal)}`, marginLeft + 165, y)

    y += 7
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text("Prom. Cargos/mes:", marginLeft, y)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 64, 175)
    doc.text(`$${formatNum(data.promedioCargosGlobal)}`, marginLeft + 37, y)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text("Prom. Gastos/mes:", marginLeft + 70, y)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(185, 28, 28)
    doc.text(`$${formatNum(data.promedioEgresosGlobal)}`, marginLeft + 107, y)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text("Proveedores:", marginLeft + 140, y)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 41, 59)
    doc.text(`${data.servicios.length}`, marginLeft + 165, y)

    // Valor GC
    if (effective && data.cantApartamentosGC > 0) {
      y += 10
      doc.setDrawColor(226, 232, 240)
      doc.line(marginLeft, y - 3, pageWidth - marginRight, y - 3)

      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 116, 139)
      doc.text("GASTO COMUN POR APARTAMENTO", marginLeft, y)
      y += 7

      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 116, 139)
      doc.text("Valor G.C. - Promedio:", marginLeft, y)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 64, 175)
      doc.text(`$${formatNum(effective.gcPromedio)}`, marginLeft + 45, y)

      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 116, 139)
      doc.text("Valor G.C. - Proyección:", marginLeft + 80, y)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(180, 130, 40)
      doc.text(`$${formatNum(effective.gcProyeccion)}`, marginLeft + 128, y)

      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 116, 139)
      doc.text(`(${data.cantApartamentosGC} aptos.)`, marginLeft + 155, y)
    }
  }

  // Pie de pagina
  doc.setFontSize(6)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(148, 163, 184)

  const fechaArchivo = new Date().toISOString().split("T")[0]
  const fileName = `Flujo_de_Caja_${fechaArchivo}.pdf`
  const arrayBuffer = doc.output("arraybuffer")
  return { arrayBuffer, fileName }
}
