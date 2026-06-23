import ExcelJS from "exceljs"
import { type InformeData } from "@/lib/database"

const tipoOcupacionLabels: Record<string, string> = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
}

export async function generateInformeExcel(data: InformeData, periodoLabel: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Admin Edificios"
  workbook.created = new Date()

  const ws = workbook.addWorksheet("Informe Mensual")

  // Título
  ws.addRow([`Informe Mensual de Cuenta Corriente - ${periodoLabel}`])
  ws.getRow(1).font = { bold: true, size: 14 }
  ws.addRow([`Generado: ${new Date().toLocaleDateString("es-ES")}`])
  ws.addRow([])

  // Resumen General
  ws.addRow(["RESUMEN GENERAL"]).font = { bold: true }
  ws.addRow(["Concepto", "Monto"]).font = { bold: true }
  ws.addRow(["Saldo Anterior Total", data.totales.totalSaldoAnterior])
  ws.addRow(["Pagos del Mes Total", data.totales.totalPagosMes])
  ws.addRow(["Gastos Comunes Total", data.totales.totalGastosComunesMes])
  ws.addRow(["Fondo Reserva Total", data.totales.totalFondoReservaMes])
  ws.addRow(["Saldo Actual Total", data.totales.totalSaldoActual])
  ws.addRow([])

  // Resumen Bancario
  ws.addRow(["RESUMEN BANCARIO"]).font = { bold: true }
  ws.addRow(["Concepto", "Monto"]).font = { bold: true }
  ws.addRow(["Ingreso por Gastos Comunes", data.resumenBancario.ingresoGastosComunes])
  ws.addRow(["Ingreso por Fondo de Reserva", data.resumenBancario.ingresoFondoReserva])
  ws.addRow(["Egreso por Gastos Comunes", data.resumenBancario.egresoGastosComunes])
  ws.addRow(["Egreso por Fondo de Reserva", data.resumenBancario.egresoFondoReserva])
  ws.addRow(["Saldo Bancario Total", data.resumenBancario.saldoBancarioTotal])
  ws.addRow([])

  // Avisos (si hay avisos activos)
  const avisosActivos = (data.avisos || []).filter((a) => a.activo)
  if (avisosActivos.length > 0) {
    ws.addRow(["AVISOS"]).font = { bold: true }
    ws.addRow(["#", "Aviso"]).font = { bold: true }
    avisosActivos.forEach((aviso, index) => {
      ws.addRow([index + 1, aviso.texto])
    })
    ws.addRow([])
  }

  // Desglose por Apartamento
  ws.addRow(["DESGLOSE POR APARTAMENTO"]).font = { bold: true }
  const headerRow = ws.addRow([
    "Apartamento",
    "Tipo",
    "Saldo Anterior",
    "Pagos del Mes",
    "Gastos Comunes",
    "Fondo Reserva",
    "Saldo Actual",
  ])
  headerRow.font = { bold: true }

  for (const apt of data.apartamentos) {
    ws.addRow([
      apt.numero,
      tipoOcupacionLabels[apt.tipoOcupacion],
      apt.saldoAnterior,
      apt.pagosMes,
      apt.gastosComunesMes,
      apt.fondoReservaMes,
      apt.saldoActual,
    ])
  }

  // Fila de totales
  const totalRow = ws.addRow([
    "TOTALES",
    "",
    data.totales.totalSaldoAnterior,
    data.totales.totalPagosMes,
    data.totales.totalGastosComunesMes,
    data.totales.totalFondoReservaMes,
    data.totales.totalSaldoActual,
  ])
  totalRow.font = { bold: true }

  // Anchos de columna
  ws.getColumn(1).width = 28
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 18
  ws.getColumn(4).width = 18
  ws.getColumn(5).width = 18
  ws.getColumn(6).width = 18
  ws.getColumn(7).width = 18

  // Descargar
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `informe-mensual-${periodoLabel.toLowerCase().replace(/\s/g, "-")}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
