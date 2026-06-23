import ExcelJS from "exceljs"

export type CellValue = string | number | boolean | Date | null | undefined

export interface ExcelExportOptions {
  filename: string
  sheetName?: string
  headers: string[]
  rows: CellValue[][]
  // Anchos en "caracteres" (px aprox = ancho * 7). Si no se pasan, autocalcula.
  columnWidths?: number[]
}

/**
 * Exporta datos a un archivo .xlsx con headers en negrita y anchos automáticos.
 * Descarga el archivo desde el browser.
 */
export async function exportToExcel(opts: ExcelExportOptions): Promise<void> {
  const { filename, sheetName = "Datos", headers, rows, columnWidths } = opts

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Admin Edificios"
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet(sheetName)

  // Header row
  const headerRow = worksheet.addRow(headers)
  headerRow.font = { bold: true }
  headerRow.alignment = { vertical: "middle" }

  // Data rows
  for (const row of rows) {
    worksheet.addRow(row)
  }

  // Anchos
  if (columnWidths && columnWidths.length === headers.length) {
    headers.forEach((_, i) => {
      worksheet.getColumn(i + 1).width = columnWidths[i]
    })
  } else {
    // Auto-calcular ancho según el contenido más largo (con tope mín/máx)
    headers.forEach((header, i) => {
      let max = String(header).length
      for (const row of rows) {
        const v = row[i]
        if (v != null) {
          const len = String(v).length
          if (len > max) max = len
        }
      }
      worksheet.getColumn(i + 1).width = Math.min(Math.max(max + 2, 10), 60)
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
