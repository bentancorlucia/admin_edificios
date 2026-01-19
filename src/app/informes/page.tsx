import { getInformeData, getPiePaginaInforme } from "./actions"
import { InformesClient } from "./informes-client"

export default async function InformesPage() {
  // Obtener mes y año actual por defecto
  const now = new Date()
  const mes = now.getMonth() + 1
  const anio = now.getFullYear()

  const [informeData, piePagina] = await Promise.all([
    getInformeData(mes, anio),
    getPiePaginaInforme(),
  ])

  return (
    <InformesClient
      initialData={informeData}
      initialMes={mes}
      initialAnio={anio}
      initialPiePagina={piePagina}
    />
  )
}
