"use client"

import { useEffect, useState } from "react"
import { BitacoraClient } from "./bitacora-client"
import { getRegistros, type Registro } from "@/lib/database"

export default function BitacoraPage() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getRegistros()
        setRegistros(data)
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
        <div className="text-slate-500">Cargando bitácora...</div>
      </div>
    )
  }

  return <BitacoraClient initialRegistros={registros} />
}
