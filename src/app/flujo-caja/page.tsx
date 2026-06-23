"use client"

import { useEffect, useState } from "react"
import { FlujoCajaClient } from "./flujo-caja-client"
import { getFlujoCajaData, type FlujoCajaData } from "@/lib/database"

export default function FlujoCajaPage() {
  const [data, setData] = useState<FlujoCajaData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const now = new Date()
        const fechaInicio = new Date(now.getFullYear(), 0, 1).toISOString()
        const fechaFin = new Date(now.getFullYear(), now.getMonth(), 28, 23, 59, 59).toISOString()
        const result = await getFlujoCajaData(fechaInicio, fechaFin, 3, 'AMBOS')
        setData(result)
      } catch (error) {
        console.error("Error loading flujo de caja:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading || !data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Cargando flujo de caja...</div>
      </div>
    )
  }

  return <FlujoCajaClient initialData={data} />
}
