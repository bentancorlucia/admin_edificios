"use client"

import { useEffect, useState } from "react"
import { ImportesGeneralesClient } from "./importes-generales-client"
import { getApartamentosOrdenados, type Apartamento } from "@/lib/database"

export default function ImportesGeneralesPage() {
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getApartamentosOrdenados()
        setApartamentos(data)
      } catch (error) {
        console.error("Error loading apartamentos:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Cargando importes...</div>
      </div>
    )
  }

  return <ImportesGeneralesClient initialApartamentos={apartamentos} />
}
