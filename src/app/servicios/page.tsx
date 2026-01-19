"use client"

import { useEffect, useState } from "react"
import { ServiciosClient } from "./servicios-client"
import { getServicios, type Servicio } from "@/lib/database"

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getServicios()
        setServicios(data)
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

  return <ServiciosClient initialServicios={servicios} />
}
