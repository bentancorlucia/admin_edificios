"use client"

import { useEffect, useState } from "react"
import { ServiciosClient } from "./servicios-client"
import { getServicios, getTiposServicioActivos, type Servicio, type TipoServicio } from "@/lib/database"

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [serviciosData, tiposData] = await Promise.all([
          getServicios(),
          getTiposServicioActivos()
        ])
        setServicios(serviciosData)
        setTiposServicio(tiposData)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Cargando servicios...</div>
      </div>
    )
  }

  return <ServiciosClient initialServicios={servicios} initialTiposServicio={tiposServicio} />
}
