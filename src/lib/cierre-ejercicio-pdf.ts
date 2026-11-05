import jsPDF from "jspdf"
import { PDFDocument, StandardFonts, rgb, EncryptedPDFError } from "pdf-lib"
import type { CierreEjercicioData, CierreFondoEgreso } from "@/lib/database"

type RGB = [number, number, number]

const colors = {
  primary: [45, 55, 72] as RGB,      // slate-700
  secondary: [100, 116, 139] as RGB, // slate-500
  muted: [148, 163, 184] as RGB,     // slate-400
  light: [226, 232, 240] as RGB,     // slate-200
  background: [248, 250, 252] as RGB,// slate-50
  white: [255, 255, 255] as RGB,
  positive: [22, 163, 74] as RGB,    // green-600
  negative: [220, 38, 38] as RGB,    // red-600
  blue: [37, 99, 235] as RGB,        // blue-600
  amber: [217, 119, 6] as RGB,       // amber-600
}

const tipoOcupacionLabels: Record<string, string> = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
}

const formatCurrency = (val: number) =>
  `$ ${val.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatFecha = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

// ── Utilidades para los PDF del banco ──

export function base64ToBytes(base64: string): Uint8Array {
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binario = ""
  const bloque = 0x8000
  for (let i = 0; i < bytes.length; i += bloque) {
    binario += String.fromCharCode(...Array.from(bytes.subarray(i, i + bloque)))
  }
  return btoa(binario)
}

// Valida que el PDF del banco se pueda anexar y devuelve su cantidad de páginas.
export async function inspeccionarPdfBanco(bytes: Uint8Array): Promise<number> {
  try {
    const doc = await PDFDocument.load(bytes)
    return doc.getPageCount()
  } catch (error) {
    if (error instanceof EncryptedPDFError) {
      throw new Error(
        'El PDF está protegido por el banco y no se puede anexar. Abrilo, elegí Imprimir → "Microsoft Print to PDF" y volvé a importar el archivo generado.'
      )
    }
    throw new Error("El archivo no es un PDF válido o está dañado.")
  }
}

export interface AnexoEstadoCuenta {
  titulo: string
  bytes: Uint8Array
}

// pdf-lib con fuentes estándar solo admite caracteres Latin-1
const latin1 = (s: string) => s.replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "")

type Align = "left" | "right"
interface Columna {
  header: string
  peso: number
  align?: Align
}
interface Celda {
  text: string
  color?: RGB
  bold?: boolean
}
type ValorCelda = string | Celda

export async function generateCierreEjercicioPDF(
  data: CierreEjercicioData,
  opciones: { piePagina?: string; anexos: AnexoEstadoCuenta[] }
): Promise<{ arrayBuffer: ArrayBuffer; fileName: string }> {
  // Cargar anexos primero para conocer el total de páginas del informe
  const anexosCargados: { titulo: string; doc: PDFDocument }[] = []
  for (const anexo of opciones.anexos) {
    anexosCargados.push({ titulo: anexo.titulo, doc: await PDFDocument.load(anexo.bytes) })
  }
  const paginasAnexos = anexosCargados.reduce((s, a) => s + a.doc.getPageCount(), 0)

  const doc = new jsPDF("landscape")
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const anchoUtil = pageWidth - margin * 2
  const limiteInferior = pageHeight - 22
  const { anio } = data

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
    doc.text(`Cierre de Ejercicio ${anio}`, pageWidth - margin, 12, { align: "right" })
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`01/01/${anio} al 31/12/${anio}`, pageWidth - margin, 20, { align: "right" })
  }

  let y = 0
  const nuevaPagina = () => {
    doc.addPage("landscape")
    drawPageHeader()
    y = 38
  }
  const asegurarEspacio = (alto: number) => {
    if (y + alto > limiteInferior) nuevaPagina()
  }

  const sectionTitle = (titulo: string) => {
    asegurarEspacio(30)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...colors.primary)
    const texto = titulo.toUpperCase()
    doc.text(texto, margin, y)
    doc.setDrawColor(...colors.primary)
    doc.setLineWidth(0.5)
    doc.line(margin, y + 2, margin + doc.getTextWidth(texto), y + 2)
    doc.setLineWidth(0.2)
    y += 8
  }

  const ajustarTexto = (texto: string, ancho: number) => {
    if (doc.getTextWidth(texto) <= ancho) return texto
    let t = texto
    while (t.length > 1 && doc.getTextWidth(`${t}...`) > ancho) t = t.slice(0, -1)
    return `${t}...`
  }

  const drawTable = (columnas: Columna[], filas: ValorCelda[][], filaTotal?: ValorCelda[]) => {
    const pesoTotal = columnas.reduce((s, c) => s + c.peso, 0)
    const anchos = columnas.map(c => (c.peso / pesoTotal) * anchoUtil)
    const altoHeader = 8
    const altoFila = 6.5
    const padding = 3

    const drawHeader = () => {
      doc.setFillColor(...colors.blue)
      doc.rect(margin, y, anchoUtil, altoHeader, "F")
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...colors.white)
      let x = margin
      columnas.forEach((col, i) => {
        const textX = col.align === "right" ? x + anchos[i] - padding : x + padding
        doc.text(ajustarTexto(col.header, anchos[i] - padding * 2), textX, y + 5.5, { align: col.align ?? "left" })
        x += anchos[i]
      })
      y += altoHeader
    }

    const drawFila = (fila: ValorCelda[], esTotal: boolean, indice: number) => {
      if (y + altoFila > limiteInferior) {
        nuevaPagina()
        drawHeader()
      }
      if (esTotal) {
        doc.setFillColor(...colors.light)
        doc.rect(margin, y, anchoUtil, altoFila + 0.5, "F")
      } else if (indice % 2 === 0) {
        doc.setFillColor(...colors.background)
        doc.rect(margin, y, anchoUtil, altoFila, "F")
      }
      doc.setFontSize(7.5)
      let x = margin
      fila.forEach((valor, i) => {
        const celda: Celda = typeof valor === "string" ? { text: valor } : valor
        doc.setFont("helvetica", esTotal || celda.bold ? "bold" : "normal")
        doc.setTextColor(...(celda.color ?? colors.primary))
        const col = columnas[i]
        const textX = col.align === "right" ? x + anchos[i] - padding : x + padding
        doc.text(ajustarTexto(celda.text, anchos[i] - padding * 2), textX, y + 4.5, { align: col.align ?? "left" })
        x += anchos[i]
      })
      y += esTotal ? altoFila + 0.5 : altoFila
    }

    asegurarEspacio(altoHeader + altoFila * 2)
    drawHeader()
    filas.forEach((fila, i) => drawFila(fila, false, i))
    if (filaTotal) drawFila(filaTotal, true, 0)
    y += 8
  }

  const montoColor = (valor: number, invertir = false): Celda => {
    const negativo = invertir ? valor > 0.005 : valor < -0.005
    return { text: formatCurrency(valor), color: negativo ? colors.negative : colors.primary }
  }

  // =====================================================
  // PÁGINA 1: encabezado, estado y resumen
  // =====================================================
  drawPageHeader()
  y = 38

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  if (data.cierre) {
    doc.setTextColor(...colors.positive)
    doc.text(`EJERCICIO CERRADO el ${formatFecha(data.cierre.fechaCierre)}`, margin, y)
  } else {
    doc.setTextColor(...colors.amber)
    doc.text("BORRADOR - el ejercicio todavía está abierto y los importes pueden cambiar", margin, y)
  }
  y += 8

  const t = data.totales
  const tarjetas: { label: string; valor: number; color?: RGB }[] = [
    { label: `Saldo bancario al 01/01/${anio}`, valor: t.saldoBancarioInicio },
    { label: "Ingresos del ejercicio", valor: t.ingresosBanco, color: colors.positive },
    { label: "Egresos del ejercicio", valor: t.egresosBanco, color: colors.negative },
    { label: `Saldo bancario al 31/12/${anio}`, valor: t.saldoBancarioCierre, color: colors.blue },
    { label: `Deuda de unidades al 31/12/${anio}`, valor: t.deudaUnidadesCierre, color: t.deudaUnidadesCierre > 0 ? colors.negative : colors.primary },
  ]
  const gap = 4
  const anchoTarjeta = (anchoUtil - gap * (tarjetas.length - 1)) / tarjetas.length
  tarjetas.forEach((tarjeta, i) => {
    const x = margin + i * (anchoTarjeta + gap)
    doc.setFillColor(...colors.background)
    doc.setDrawColor(...colors.light)
    doc.roundedRect(x, y, anchoTarjeta, 20, 2, 2, "FD")
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...colors.secondary)
    doc.text(tarjeta.label, x + 4, y + 7)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...(tarjeta.color ?? colors.primary))
    doc.text(formatCurrency(tarjeta.valor), x + 4, y + 15)
  })
  y += 30

  // =====================================================
  // CUENTAS BANCARIAS
  // =====================================================
  sectionTitle("Cuentas bancarias")
  const hayTransferencias = data.cuentas.some(c => Math.abs(c.transferencias) > 0.005)
  drawTable(
    [
      { header: "Banco", peso: 1.4 },
      { header: "Tipo", peso: 1 },
      { header: "Número", peso: 1.2 },
      { header: "Saldo al 01/01", peso: 1.2, align: "right" },
      { header: "Ingresos", peso: 1.2, align: "right" },
      { header: "Egresos", peso: 1.2, align: "right" },
      ...(hayTransferencias ? [{ header: "Transferencias", peso: 1.2, align: "right" as Align }] : []),
      { header: "Saldo al 31/12", peso: 1.2, align: "right" },
    ],
    data.cuentas.map(c => [
      { text: c.activa ? c.banco : `${c.banco} (inactiva)`, bold: true },
      c.tipoCuenta,
      c.numeroCuenta,
      montoColor(c.saldoInicio),
      { text: formatCurrency(c.ingresos), color: colors.positive },
      { text: formatCurrency(c.egresos), color: colors.negative },
      ...(hayTransferencias ? [`${c.transferencias > 0 ? "+" : ""}${formatCurrency(c.transferencias)}`] : []),
      { ...montoColor(c.saldoCierre), bold: true },
    ]),
    [
      "Total",
      "",
      "",
      formatCurrency(t.saldoBancarioInicio),
      formatCurrency(t.ingresosBanco),
      formatCurrency(t.egresosBanco),
      ...(hayTransferencias ? [formatCurrency(data.cuentas.reduce((s, c) => s + c.transferencias, 0))] : []),
      formatCurrency(t.saldoBancarioCierre),
    ]
  )
  if (hayTransferencias) {
    const { cantidad, monto } = data.transferenciasEntreCuentas
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...colors.secondary)
    doc.text(
      `${cantidad === 1 ? "1 transferencia" : `${cantidad} transferencias`} entre cuentas del edificio por ${formatCurrency(monto)}: no se cuentan como ingresos ni egresos del ejercicio.`,
      margin,
      y - 4
    )
    y += 2
  }

  // =====================================================
  // RESULTADO POR FONDO
  // =====================================================
  sectionTitle("Resultado del ejercicio por fondo")
  const f = data.fondos
  const filasFondo: ValorCelda[][] = [
    [{ text: "Gastos Comunes", bold: true }, formatCurrency(f.gastosComunes.ingresos), formatCurrency(f.gastosComunes.egresos), montoColor(f.gastosComunes.resultado)],
    [{ text: "Fondo de Reserva (incluye Otros Gastos)", bold: true }, formatCurrency(f.fondoReserva.ingresos), formatCurrency(f.fondoReserva.egresos), montoColor(f.fondoReserva.resultado)],
  ]
  if (Math.abs(f.sinClasificar.ingresos) > 0.005 || Math.abs(f.sinClasificar.egresos) > 0.005) {
    filasFondo.push([{ text: "Sin clasificar", bold: true }, formatCurrency(f.sinClasificar.ingresos), formatCurrency(f.sinClasificar.egresos), montoColor(f.sinClasificar.resultado)])
  }
  drawTable(
    [
      { header: "Fondo", peso: 2.2 },
      { header: "Ingresos", peso: 1, align: "right" },
      { header: "Egresos", peso: 1, align: "right" },
      { header: "Resultado", peso: 1, align: "right" },
    ],
    filasFondo,
    ["Total", formatCurrency(f.total.ingresos), formatCurrency(f.total.egresos), formatCurrency(f.total.resultado)]
  )

  // =====================================================
  // EVOLUCIÓN MENSUAL
  // =====================================================
  sectionTitle("Evolución mensual")
  drawTable(
    [
      { header: "Mes", peso: 1.2 },
      { header: "Cargos emitidos", peso: 1, align: "right" },
      { header: "Cobranzas", peso: 1, align: "right" },
      { header: "Ingresos banco", peso: 1, align: "right" },
      { header: "Egresos banco", peso: 1, align: "right" },
      { header: "Saldo bancario fin de mes", peso: 1.3, align: "right" },
    ],
    data.meses.map(m => [
      { text: m.label, bold: true },
      formatCurrency(m.cargosEmitidos),
      formatCurrency(m.cobranzas),
      { text: formatCurrency(m.ingresos), color: colors.positive },
      { text: formatCurrency(m.egresos), color: colors.negative },
      montoColor(m.saldoBancarioFinMes),
    ]),
    [
      "Total",
      formatCurrency(data.meses.reduce((s, m) => s + m.cargosEmitidos, 0)),
      formatCurrency(data.meses.reduce((s, m) => s + m.cobranzas, 0)),
      formatCurrency(data.meses.reduce((s, m) => s + m.ingresos, 0)),
      formatCurrency(data.meses.reduce((s, m) => s + m.egresos, 0)),
      formatCurrency(t.saldoBancarioCierre),
    ]
  )

  // =====================================================
  // EGRESOS POR SERVICIO
  // =====================================================
  if (data.egresosPorServicio.length > 0) {
    // Cada fondo arranca en una página nueva, empezando por Gastos Comunes
    if (y > 38) nuevaPagina()
    sectionTitle("Egresos por servicio")
    const gruposFondo: { fondo: CierreFondoEgreso; titulo: string }[] = [
      { fondo: "GASTO_COMUN", titulo: "Gastos Comunes" },
      { fondo: "FONDO_RESERVA", titulo: "Fondo de Reserva (incluye Otros Gastos)" },
      { fondo: "SIN_CLASIFICAR", titulo: "Sin clasificar" },
    ]
    let primerGrupo = true
    for (const grupo of gruposFondo) {
      const items = data.egresosPorServicio.filter(e => e.fondo === grupo.fondo)
      if (items.length === 0) continue
      const totalFondo = items.reduce((s, e) => s + e.total, 0)
      if (!primerGrupo) {
        nuevaPagina()
        sectionTitle("Egresos por servicio")
      }
      primerGrupo = false
      asegurarEspacio(30)
      doc.setFontSize(8.5)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...colors.blue)
      doc.text(grupo.titulo, margin, y)
      y += 4
      drawTable(
        [
          { header: "Servicio / Proveedor", peso: 2.5 },
          { header: "Pagos", peso: 0.6, align: "right" },
          { header: "Total", peso: 1, align: "right" },
          { header: "% del fondo", peso: 0.8, align: "right" },
        ],
        items.map(e => [
          { text: e.servicio, bold: true },
          String(e.cantidad),
          formatCurrency(e.total),
          totalFondo > 0 ? `${((e.total / totalFondo) * 100).toFixed(1)} %` : "-",
        ]),
        [`Total ${grupo.titulo}`, String(items.reduce((s, e) => s + e.cantidad, 0)), formatCurrency(totalFondo), "100 %"]
      )
    }
  }

  // =====================================================
  // ESTADO DE CUENTA POR UNIDAD
  // =====================================================
  // Página propia, para no compartirla con los egresos por fondo
  if (data.egresosPorServicio.length > 0 && y > 38) nuevaPagina()
  sectionTitle("Estado de cuenta por unidad")
  const hayOtros = data.apartamentos.some(a => Math.abs(a.cargosOtrosGastos) > 0.005)
  const columnasUnidad: Columna[] = [
    { header: "Apto", peso: 0.6 },
    { header: "Tipo", peso: 0.9 },
    { header: "Titular", peso: 1.8 },
    { header: "Saldo al 01/01", peso: 1.1, align: "right" },
    { header: "G. Comunes", peso: 1.1, align: "right" },
    { header: "F. Reserva", peso: 1.1, align: "right" },
    ...(hayOtros ? [{ header: "Otros", peso: 1, align: "right" as Align }] : []),
    { header: "Pagos", peso: 1.1, align: "right" },
    { header: "Saldo al 31/12", peso: 1.1, align: "right" },
  ]
  const sumaApto = (fn: (a: CierreEjercicioData["apartamentos"][number]) => number) =>
    formatCurrency(data.apartamentos.reduce((s, a) => s + fn(a), 0))
  drawTable(
    columnasUnidad,
    data.apartamentos.map(a => [
      { text: a.numero, bold: true },
      tipoOcupacionLabels[a.tipoOcupacion] ?? a.tipoOcupacion,
      `${[a.contactoNombre, a.contactoApellido].filter(Boolean).join(" ") || "-"}${a.activo ? "" : " (archivado)"}`,
      montoColor(a.saldoInicio, true),
      formatCurrency(a.cargosGastosComunes),
      formatCurrency(a.cargosFondoReserva),
      ...(hayOtros ? [formatCurrency(a.cargosOtrosGastos)] : []),
      { text: formatCurrency(a.pagos), color: colors.positive },
      { ...montoColor(a.saldoCierre, true), bold: true },
    ]),
    [
      "Total",
      "",
      `${t.unidadesConDeuda} con deuda`,
      sumaApto(a => a.saldoInicio),
      sumaApto(a => a.cargosGastosComunes),
      sumaApto(a => a.cargosFondoReserva),
      ...(hayOtros ? [sumaApto(a => a.cargosOtrosGastos)] : []),
      sumaApto(a => a.pagos),
      sumaApto(a => a.saldoCierre),
    ]
  )

  // =====================================================
  // OBSERVACIONES
  // =====================================================
  if (data.cierre?.observaciones) {
    sectionTitle("Observaciones del cierre")
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...colors.primary)
    const lineas = doc.splitTextToSize(data.cierre.observaciones, anchoUtil - 8) as string[]
    for (const linea of lineas) {
      asegurarEspacio(5)
      doc.text(linea, margin + 2, y)
      y += 4.5
    }
    y += 6
  }

  // =====================================================
  // ÍNDICE DE ANEXOS
  // =====================================================
  // La página de inicio de cada anexo depende del total de páginas del informe:
  // se reserva el espacio y se completa cuando se conoce.
  let indiceAnexos: { pagina: number; y: number } | null = null
  if (anexosCargados.length > 0) {
    sectionTitle("Anexo: estados de cuenta emitidos por el banco")
    asegurarEspacio(anexosCargados.length * 5.5 + 4)
    indiceAnexos = { pagina: doc.getNumberOfPages(), y }
    y += anexosCargados.length * 5.5 + 4
  }

  const paginasInforme = doc.getNumberOfPages()
  const totalPaginas = paginasInforme + paginasAnexos

  if (indiceAnexos) {
    doc.setPage(indiceAnexos.pagina)
    let yIndice = indiceAnexos.y
    let paginaInicio = paginasInforme + 1
    doc.setFontSize(8)
    anexosCargados.forEach((anexo, i) => {
      const cantidad = anexo.doc.getPageCount()
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...colors.primary)
      doc.text(`Anexo ${i + 1}.`, margin + 2, yIndice)
      doc.setFont("helvetica", "normal")
      doc.text(ajustarTexto(anexo.titulo, anchoUtil - 80), margin + 20, yIndice)
      doc.setTextColor(...colors.secondary)
      const rango = cantidad > 1 ? `páginas ${paginaInicio} a ${paginaInicio + cantidad - 1}` : `página ${paginaInicio}`
      doc.text(rango, pageWidth - margin, yIndice, { align: "right" })
      paginaInicio += cantidad
      yIndice += 5.5
    })
  }

  // Footer del informe
  for (let i = 1; i <= paginasInforme; i++) {
    doc.setPage(i)
    doc.setDrawColor(...colors.light)
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
    doc.setFontSize(7)
    doc.setTextColor(...colors.muted)
    doc.setFont("helvetica", "normal")
    doc.text(opciones.piePagina || `Cierre de Ejercicio ${anio}`, margin, pageHeight - 8)
    doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - margin, pageHeight - 8, { align: "right" })
  }

  const fileName = `Edificio Constituyente II – Cierre de Ejercicio ${anio}.pdf`
  const informeBuffer = doc.output("arraybuffer")
  if (anexosCargados.length === 0) {
    return { arrayBuffer: informeBuffer, fileName }
  }

  // =====================================================
  // ANEXAR LOS PDF DEL BANCO
  // =====================================================
  const final = await PDFDocument.load(informeBuffer)
  const fuente = await final.embedFont(StandardFonts.Helvetica)
  let numeroPagina = paginasInforme
  for (let i = 0; i < anexosCargados.length; i++) {
    const anexo = anexosCargados[i]
    const paginas = await final.copyPages(anexo.doc, anexo.doc.getPageIndices())
    for (const pagina of paginas) {
      final.addPage(pagina)
      numeroPagina++
      const texto = latin1(`Anexo ${i + 1}: ${anexo.titulo} - Página ${numeroPagina} de ${totalPaginas}`)
      const tamanio = 7
      const ancho = fuente.widthOfTextAtSize(texto, tamanio)
      const { width } = pagina.getSize()
      pagina.drawText(texto, {
        x: Math.max(10, (width - ancho) / 2),
        y: 6,
        size: tamanio,
        font: fuente,
        color: rgb(0.39, 0.45, 0.55),
      })
    }
  }

  const bytes = await final.save()
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return { arrayBuffer, fileName }
}
