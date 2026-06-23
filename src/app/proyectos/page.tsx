"use client"

import { useEffect, useState } from "react"
import { ProyectosClient } from "./proyectos-client"
import { getProyectos, type Proyecto } from "@/lib/database"

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getProyectos()
        setProyectos(data)
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
        <div className="text-slate-500">Cargando proyectos...</div>
      </div>
    )
  }

  return <ProyectosClient initialProyectos={proyectos} />
}
