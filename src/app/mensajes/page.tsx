"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { MensajesClient } from "./mensajes-client"
import {
  getApartamentos,
  getServiciosActivos,
  getContactosLibres,
  getPlantillas,
  getDestinatariosMensajes,
  getHistorialMensajes,
  type Apartamento,
  type Servicio,
  type ContactoLibre,
  type PlantillaMensaje,
  type Destinatario,
  type HistorialMensaje,
} from "@/lib/database"

export default function MensajesPage() {
  const searchParams = useSearchParams()
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([])
  const [plantillas, setPlantillas] = useState<PlantillaMensaje[]>([])
  const [contactosLibres, setContactosLibres] = useState<ContactoLibre[]>([])
  const [historial, setHistorial] = useState<HistorialMensaje[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [destData, plantillasData, contactosData, historialData] = await Promise.all([
          getDestinatariosMensajes(),
          getPlantillas(),
          getContactosLibres(),
          getHistorialMensajes(),
        ])
        setDestinatarios(destData)
        setPlantillas(plantillasData)
        setContactosLibres(contactosData)
        setHistorial(historialData)
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
        <div className="text-slate-500">Cargando mensajes...</div>
      </div>
    )
  }

  return (
    <MensajesClient
      initialDestinatarios={destinatarios}
      initialPlantillas={plantillas}
      initialContactosLibres={contactosLibres}
      initialHistorial={historial}
      contexto={searchParams.get("contexto")}
      contextoId={searchParams.get("id")}
      contextoMes={searchParams.get("mes")}
      contextoAnio={searchParams.get("anio")}
    />
  )
}
