import { type InformeData } from "@/lib/database"

const tipoOcupacionLabels: Record<string, string> = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
}

export function generateInformeExcel(data: InformeData, periodoLabel: string) {
  // Crear contenido CSV con BOM para Excel
  const BOM = "\uFEFF"
  const rows: string[][] = []

  // Título
  rows.push([`Informe Mensual de Cuenta Corriente - ${periodoLabel}`])
  rows.push([`Generado: ${new Date().toLocaleDateString("es-ES")}`])
  rows.push([])

  // Resumen General
  rows.push(["RESUMEN GENERAL"])
  rows.push(["Concepto", "Monto"])
  rows.push(["Saldo Anterior Total", formatNumber(data.totales.totalSaldoAnterior)])
  rows.push(["Pagos del Mes Total", formatNumber(data.totales.totalPagosMes)])
  rows.push(["Gastos Comunes Total", formatNumber(data.totales.totalGastosComunesMes)])
  rows.push(["Fondo Reserva Total", formatNumber(data.totales.totalFondoReservaMes)])
  rows.push(["Saldo Actual Total", formatNumber(data.totales.totalSaldoActual)])
  rows.push([])

  // Resumen Bancario
  rows.push(["RESUMEN BANCARIO"])
  rows.push(["Concepto", "Monto"])
  rows.push(["Ingreso por Gastos Comunes", formatNumber(data.resumenBancario.ingresoGastosComunes)])
  rows.push(["Ingreso por Fondo de Reserva", formatNumber(data.resumenBancario.ingresoFondoReserva)])
  rows.push(["Egreso por Gastos Comunes", formatNumber(data.resumenBancario.egresoGastosComunes)])
  rows.push(["Egreso por Fondo de Reserva", formatNumber(data.resumenBancario.egresoFondoReserva)])
  rows.push(["Saldo Bancario Total", formatNumber(data.resumenBancario.saldoBancarioTotal)])
  rows.push([])

  // Avisos (si hay avisos activos)
  const avisosActivos = (data.avisos || []).filter((a) => a.activo)
  if (avisosActivos.length > 0) {
    rows.push(["AVISOS"])
    rows.push(["#", "Aviso"])
    avisosActivos.forEach((aviso, index) => {
      rows.push([(index + 1).toString(), aviso.texto])
    })
    rows.push([])
  }

  // Desglose por Apartamento
  rows.push(["DESGLOSE POR APARTAMENTO"])
  rows.push([
    "Apartamento",
    "Tipo",
    "Saldo Anterior",
    "Pagos del Mes",
    "Gastos Comunes",
    "Fondo Reserva",
    "Saldo Actual",
  ])

  for (const apt of data.apartamentos) {
    rows.push([
      apt.numero,
      tipoOcupacionLabels[apt.tipoOcupacion],
      formatNumber(apt.saldoAnterior),
      formatNumber(apt.pagosMes),
      formatNumber(apt.gastosComunesMes),
      formatNumber(apt.fondoReservaMes),
      formatNumber(apt.saldoActual),
    ])
  }

  // Fila de totales
  rows.push([
    "TOTALES",
    "",
    formatNumber(data.totales.totalSaldoAnterior),
    formatNumber(data.totales.totalPagosMes),
    formatNumber(data.totales.totalGastosComunesMes),
    formatNumber(data.totales.totalFondoReservaMes),
    formatNumber(data.totales.totalSaldoActual),
  ])

  // Convertir a CSV
  const csvContent = BOM + rows.map((row) => row.map(escapeCSV).join(";")).join("\n")

  // Descargar
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `informe-mensual-${periodoLabel.toLowerCase().replace(/\s/g, "-")}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace(".", ",")
}

function escapeCSV(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
