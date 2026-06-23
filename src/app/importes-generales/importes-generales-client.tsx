"use client"

import { useState, useMemo } from "react"
import { BackToHome } from "@/components/back-to-home"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Calculator, Save, RotateCcw, AlertCircle, CheckCircle2, Receipt } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { updateApartamento, generarOtrosGastosMensuales, type Apartamento } from "@/lib/database"
import { toast } from "@/hooks/use-toast"

type Props = {
  initialApartamentos: Apartamento[]
}

type Editable = {
  gastosComunes: string
  fondoReserva: string
  otrosGastos: string
}

function toEditable(a: Apartamento): Editable {
  return {
    gastosComunes: String(a.gastosComunes ?? 0),
    fondoReserva: String(a.fondoReserva ?? 0),
    otrosGastos: String(a.otrosGastos ?? 0),
  }
}

function isDirty(edit: Editable, original: Apartamento): boolean {
  const gc = parseFloat(edit.gastosComunes) || 0
  const fr = parseFloat(edit.fondoReserva) || 0
  const og = parseFloat(edit.otrosGastos) || 0
  return (
    gc !== (original.gastosComunes ?? 0) ||
    fr !== (original.fondoReserva ?? 0) ||
    og !== (original.otrosGastos ?? 0)
  )
}

export function ImportesGeneralesClient({ initialApartamentos }: Props) {
  const [apartamentos, setApartamentos] = useState<Apartamento[]>(initialApartamentos)
  const [edits, setEdits] = useState<Record<string, Editable>>(() => {
    const map: Record<string, Editable> = {}
    for (const a of initialApartamentos) map[a.id] = toEditable(a)
    return map
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Bulk apply inputs
  const [bulkGC, setBulkGC] = useState("")
  const [bulkFR, setBulkFR] = useState("")
  const [bulkOG, setBulkOG] = useState("")
  const [soloConfigurados, setSoloConfigurados] = useState(true)
  const [isGeneratingOG, setIsGeneratingOG] = useState(false)
  const [isGenerateOGDialogOpen, setIsGenerateOGDialogOpen] = useState(false)

  const aptosConOG = useMemo(() => apartamentos.filter(a => a.otrosGastos > 0).length, [apartamentos])

  const handleGenerarOG = async () => {
    setIsGeneratingOG(true)
    setIsGenerateOGDialogOpen(false)
    try {
      const result = await generarOtrosGastosMensuales()
      if (result.creadas === 0 && result.saltadosYaExistentes === 0) {
        toast({
          title: "Sin apartamentos para procesar",
          description: "No hay apartamentos con un importe de Otros Gastos configurado.",
        })
      } else if (result.creadas === 0) {
        toast({
          title: "Ya están generados",
          description: `Los ${result.saltadosYaExistentes} apartamento(s) con OG ya tienen el cargo de ${result.mes}.`,
        })
      } else {
        toast({
          title: "Otros Gastos generados",
          description: `Se crearon ${result.creadas} cargo(s) para ${result.mes}${result.saltadosYaExistentes > 0 ? ` (${result.saltadosYaExistentes} ya existían)` : ""}.`,
        })
      }
    } catch (err) {
      console.error("Error generando OG:", err)
      const msg = err instanceof Error ? err.message : "Error desconocido"
      setError(`Error al generar Otros Gastos: ${msg}`)
    } finally {
      setIsGeneratingOG(false)
    }
  }

  const dirtyIds = useMemo(() => {
    const ids: string[] = []
    for (const a of apartamentos) {
      if (edits[a.id] && isDirty(edits[a.id], a)) ids.push(a.id)
    }
    return ids
  }, [apartamentos, edits])

  const totales = useMemo(() => {
    let gc = 0, fr = 0, og = 0
    for (const a of apartamentos) {
      const e = edits[a.id]
      gc += parseFloat(e?.gastosComunes ?? "0") || 0
      fr += parseFloat(e?.fondoReserva ?? "0") || 0
      og += parseFloat(e?.otrosGastos ?? "0") || 0
    }
    return { gc, fr, og, total: gc + fr + og }
  }, [apartamentos, edits])

  const updateField = (id: string, field: keyof Editable, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const aplicarATodos = (field: keyof Editable, valueStr: string) => {
    const value = parseFloat(valueStr)
    if (isNaN(value) || value < 0) {
      toast({ title: "Valor inválido", description: "Ingresá un número válido (≥ 0).", variant: "destructive" })
      return
    }
    let aplicados = 0
    setEdits((prev) => {
      const next = { ...prev }
      for (const a of apartamentos) {
        const valorActual = parseFloat(prev[a.id]?.[field] ?? "0") || 0
        if (soloConfigurados && valorActual <= 0) continue
        next[a.id] = { ...next[a.id], [field]: String(value) }
        aplicados++
      }
      return next
    })
    if (soloConfigurados && aplicados === 0) {
      toast({
        title: "Ningún apartamento actualizado",
        description: "No hay apartamentos con este concepto configurado. Destildá la opción para aplicarlo a todos o editá manualmente las filas.",
      })
    }
  }

  const descartarCambios = () => {
    const map: Record<string, Editable> = {}
    for (const a of apartamentos) map[a.id] = toEditable(a)
    setEdits(map)
    setBulkGC("")
    setBulkFR("")
    setBulkOG("")
    setError(null)
  }

  const guardarTodo = async () => {
    if (dirtyIds.length === 0) {
      toast({ title: "Sin cambios", description: "No hay importes modificados para guardar." })
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const updated: Apartamento[] = []
      for (const id of dirtyIds) {
        const e = edits[id]
        const apt = await updateApartamento(id, {
          gastosComunes: parseFloat(e.gastosComunes) || 0,
          fondoReserva: parseFloat(e.fondoReserva) || 0,
          otrosGastos: parseFloat(e.otrosGastos) || 0,
        })
        updated.push(apt)
      }

      setApartamentos((prev) => {
        const map = new Map(updated.map((a) => [a.id, a]))
        return prev.map((a) => map.get(a.id) ?? a)
      })
      setEdits((prev) => {
        const next = { ...prev }
        for (const a of updated) next[a.id] = toEditable(a)
        return next
      })

      toast({
        title: "Importes actualizados",
        description: `${updated.length} apartamento(s) modificado(s) correctamente.`,
      })
    } catch (err) {
      console.error("Error al guardar importes:", err)
      const msg = err instanceof Error ? err.message : "Error desconocido"
      setError(`Error al guardar: ${msg}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 px-4 md:px-8 lg:px-12 py-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 p-6 text-white shadow-xl">
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <BackToHome dark />
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Importes Generales</h1>
                <p className="text-emerald-100 text-sm">
                  Edición masiva de Gastos Comunes, Fondo de Reserva y Otros Gastos
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <AlertDialog open={isGenerateOGDialogOpen} onOpenChange={setIsGenerateOGDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="secondary"
                  disabled={isGeneratingOG || aptosConOG === 0}
                  className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  {isGeneratingOG ? "Generando..." : "Generar OG del mes"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Generar cargos de Otros Gastos</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se generarán cargos de <strong>Otros Gastos</strong> para el mes en curso, sólo para los apartamentos con un importe configurado (OG &gt; 0). Si un apartamento ya tiene el cargo de este mes, se omitirá (no se duplica).
                    <br /><br />
                    <strong>Apartamentos con OG configurado:</strong> {aptosConOG} de {apartamentos.length}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGenerarOG} className="bg-emerald-600 hover:bg-emerald-700">
                    Generar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="secondary"
              onClick={descartarCambios}
              disabled={isSaving || dirtyIds.length === 0}
              className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Descartar
            </Button>
            <Button
              onClick={guardarTodo}
              disabled={isSaving || dirtyIds.length === 0}
              className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Guardando..." : `Guardar todo${dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ""}`}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {dirtyIds.length > 0 && !error && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4 !text-amber-700" />
          <AlertDescription>
            Hay <strong>{dirtyIds.length}</strong> apartamento(s) con cambios sin guardar.
          </AlertDescription>
        </Alert>
      )}

      {/* Aplicar a todos */}
      <div className="rounded-xl border bg-slate-50 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Aplicar el mismo importe a todos los apartamentos
        </h2>
        <label className="flex items-start gap-2 mb-3 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloConfigurados}
            onChange={(e) => setSoloConfigurados(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            Solo aplicar a apartamentos que ya tienen un importe configurado para el concepto
            <span className="block text-slate-400 mt-0.5">
              (recomendado: evita asignar el cargo a filas donde el concepto no corresponde — ej: GC del Propietario cuando lo paga el Inquilino)
            </span>
          </span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Gastos Comunes"
              value={bulkGC}
              onChange={(e) => setBulkGC(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => aplicarATodos("gastosComunes", bulkGC)}
              disabled={!bulkGC}
            >
              Aplicar GC
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Fondo de Reserva"
              value={bulkFR}
              onChange={(e) => setBulkFR(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => aplicarATodos("fondoReserva", bulkFR)}
              disabled={!bulkFR}
            >
              Aplicar FR
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Otros Gastos"
              value={bulkOG}
              onChange={(e) => setBulkOG(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => aplicarATodos("otrosGastos", bulkOG)}
              disabled={!bulkOG}
            >
              Aplicar OG
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Tras aplicar, podés ajustar valores individuales en la grilla y luego presionar <strong>Guardar todo</strong>.
        </p>
      </div>

      {/* Grilla */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="w-20">Apto</TableHead>
              <TableHead className="w-24">Tipo</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead className="w-40 text-right">Gastos Comunes</TableHead>
              <TableHead className="w-40 text-right">Fondo Reserva</TableHead>
              <TableHead className="w-40 text-right">Otros Gastos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apartamentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                  No hay apartamentos cargados.
                </TableCell>
              </TableRow>
            )}
            {apartamentos.map((a) => {
              const e = edits[a.id]
              const dirty = e && isDirty(e, a)
              const nombre = [a.contactoNombre, a.contactoApellido].filter(Boolean).join(" ") || "—"
              return (
                <TableRow key={a.id} className={dirty ? "bg-amber-50/60" : ""}>
                  <TableCell className="font-semibold">{a.numero}</TableCell>
                  <TableCell>
                    <Badge variant={a.tipoOcupacion === "PROPIETARIO" ? "default" : "secondary"}>
                      {a.tipoOcupacion === "PROPIETARIO" ? "Propietario" : "Inquilino"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-700">{nombre}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={e?.gastosComunes ?? "0"}
                      onChange={(ev) => updateField(a.id, "gastosComunes", ev.target.value)}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={e?.fondoReserva ?? "0"}
                      onChange={(ev) => updateField(a.id, "fondoReserva", ev.target.value)}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={e?.otrosGastos ?? "0"}
                      onChange={(ev) => updateField(a.id, "otrosGastos", ev.target.value)}
                      className="text-right"
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          {apartamentos.length > 0 && (
            <tfoot className="border-t bg-slate-50 font-semibold">
              <tr>
                <td colSpan={3} className="p-2 text-right text-slate-700">Totales:</td>
                <td className="p-2 text-right text-slate-900">{formatCurrency(totales.gc)}</td>
                <td className="p-2 text-right text-slate-900">{formatCurrency(totales.fr)}</td>
                <td className="p-2 text-right text-slate-900">{formatCurrency(totales.og)}</td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    </div>
  )
}
