"use client"

import { useEffect, useState } from "react"
import { TransaccionesClient } from "./transacciones-client"
import {
  getTransaccionesConApartamento,
  getApartamentos,
  getCuentasBancarias,
  type TransaccionConApartamento,
  type Apartamento,
  type CuentaBancaria,
} from "@/lib/database"

export default function TransaccionesPage() {
  const [transacciones, setTransacciones] = useState<TransaccionConApartamento[]>([])
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [transaccionesData, apartamentosData, cuentasData] = await Promise.all([
          getTransaccionesConApartamento(),
          getApartamentos(),
          getCuentasBancarias(),
        ])
        setTransacciones(transaccionesData)
        setApartamentos(apartamentosData)
        setCuentasBancarias(cuentasData.filter(c => c.activa))
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
        <div className="text-slate-500">Cargando transacciones...</div>
      </div>
    )
  }

  return (
    <TransaccionesClient
      initialTransacciones={transacciones}
      apartamentos={apartamentos}
      cuentasBancarias={cuentasBancarias}
    />
  )
}
