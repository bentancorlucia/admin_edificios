"use client"

import { useEffect, useState } from "react"
import { BancosClient } from "./bancos-client"
import {
  getCuentasBancariasConMovimientos,
  getRecibosNoVinculados,
  getServiciosActivos,
  type CuentaBancariaConMovimientos,
  type ReciboNoVinculado,
  type Servicio,
} from "@/lib/database"

export default function BancosPage() {
  const [cuentas, setCuentas] = useState<CuentaBancariaConMovimientos[]>([])
  const [recibosNoVinculados, setRecibosNoVinculados] = useState<ReciboNoVinculado[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [cuentasData, recibosData, serviciosData] = await Promise.all([
          getCuentasBancariasConMovimientos(),
          getRecibosNoVinculados(),
          getServiciosActivos(),
        ])
        setCuentas(cuentasData)
        setRecibosNoVinculados(recibosData)
        setServicios(serviciosData)
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
        <div className="text-slate-500">Cargando cuentas bancarias...</div>
      </div>
    )
  }

  return (
    <BancosClient
      initialCuentas={cuentas}
      recibosNoVinculados={recibosNoVinculados}
      servicios={servicios}
    />
  )
}
