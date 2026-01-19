"use client"

import { useEffect, useState } from "react"
import { ApartamentosClient } from "./apartamentos-client"
import { getApartamentos, obtenerSaldosCuentaCorriente, type Apartamento } from "@/lib/database"

export default function ApartamentosPage() {
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [apartamentosData, saldosData] = await Promise.all([
          getApartamentos(),
          obtenerSaldosCuentaCorriente(),
        ])
        setApartamentos(apartamentosData)
        setSaldos(saldosData)
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
        <div className="text-slate-500">Cargando apartamentos...</div>
      </div>
    )
  }

  return <ApartamentosClient initialApartamentos={apartamentos} initialSaldos={saldos} />
}
