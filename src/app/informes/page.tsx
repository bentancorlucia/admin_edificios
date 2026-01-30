"use client"

import { useEffect, useState } from "react"
import { InformesClient } from "./informes-client"
import {
  getInformeData,
  getPiePaginaInforme,
  getAvisoFinalInforme,
  type InformeData,
} from "@/lib/database"

export default function InformesPage() {
  const [informeData, setInformeData] = useState<InformeData | null>(null)
  const [piePagina, setPiePagina] = useState("")
  const [avisoFinal, setAvisoFinal] = useState("")
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [data, pie, aviso] = await Promise.all([
          getInformeData(mes, anio),
          getPiePaginaInforme(),
          getAvisoFinalInforme(),
        ])
        setInformeData(data)
        setPiePagina(pie)
        setAvisoFinal(aviso)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [mes, anio])

  if (isLoading || !informeData) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Cargando informe...</div>
      </div>
    )
  }

  return (
    <InformesClient
      initialData={informeData}
      initialMes={mes}
      initialAnio={anio}
      initialPiePagina={piePagina}
      initialAvisoFinal={avisoFinal}
    />
  )
}
