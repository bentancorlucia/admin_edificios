"use client"

import { useEffect, useState } from "react"
import { RegistroPagosClient } from "./registro-pagos-client"
import {
  getApartamentos,
  getCuentasBancarias,
  obtenerSaldosCuentaCorriente,
  type Apartamento,
  type CuentaBancaria,
} from "@/lib/database"

export default function RegistroPagosPage() {
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([])
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [apartamentosData, cuentasData, saldosData] = await Promise.all([
          getApartamentos(),
          getCuentasBancarias(),
          obtenerSaldosCuentaCorriente(),
        ])
        setApartamentos(apartamentosData)
        setCuentasBancarias(cuentasData.filter(c => c.activa))
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
        <div className="text-slate-500">Cargando datos...</div>
      </div>
    )
  }

  return (
    <RegistroPagosClient
      apartamentos={apartamentos}
      cuentasBancarias={cuentasBancarias}
      initialSaldos={saldos}
    />
  )
}
