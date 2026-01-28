"use client"

import { useEffect, useState } from "react"
import { AnalisisClient } from "./analisis-client"
import {
  getAnalisisData,
  getTiposServicioActivos,
  type AnalisisData,
  type TipoServicio,
} from "@/lib/database"

export default function AnalisisPage() {
  const [analisisData, setAnalisisData] = useState<AnalisisData | null>(null)
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([])
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [data, tipos] = await Promise.all([
          getAnalisisData(mes, anio, 'AMBOS', null),
          getTiposServicioActivos(),
        ])
        setAnalisisData(data)
        setTiposServicio(tipos)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [mes, anio])

  if (isLoading || !analisisData) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Cargando análisis...</div>
      </div>
    )
  }

  return (
    <AnalisisClient
      initialData={analisisData}
      initialMes={mes}
      initialAnio={anio}
      tiposServicio={tiposServicio}
    />
  )
}
