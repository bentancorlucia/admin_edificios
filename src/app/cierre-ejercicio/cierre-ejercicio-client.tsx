"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BackToHome } from "@/components/back-to-home"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertTriangle,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileUp,
  Landmark,
  Loader2,
  Lock,
  LockOpen,
  Paperclip,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"
import {
  type CierreEjercicioData,
  type CierreFondoEgreso,
  type CuentaBancaria,
  type EstadoCuentaBancoArchivo,
  cerrarEjercicio,
  createEstadoCuentaBanco,
  deleteEstadoCuentaBanco,
  getCierreEjercicioData,
  getContenidoEstadoCuentaBanco,
  getCuentasBancarias,
  getPiePaginaInforme,
  reabrirEjercicio,
  updateCuentaEstadoCuentaBanco,
} from "@/lib/database"
import {
  base64ToBytes,
  bytesToBase64,
  generateCierreEjercicioPDF,
  inspeccionarPdfBanco,
} from "@/lib/cierre-ejercicio-pdf"
import { savePDFWithDialog } from "@/lib/save-pdf"
import { toast } from "@/hooks/use-toast"

const SIN_CUENTA = "__sin_cuenta__"
const TAMANIO_MAXIMO = 20 * 1024 * 1024

const GRUPOS_FONDO_EGRESO: { fondo: CierreFondoEgreso; titulo: string }[] = [
  { fondo: "GASTO_COMUN", titulo: "Gastos Comunes" },
  { fondo: "FONDO_RESERVA", titulo: "Fondo de Reserva (incluye Otros Gastos)" },
  { fondo: "SIN_CLASIFICAR", titulo: "Sin clasificar" },
]

const tipoOcupacionLabels: Record<string, string> = {
  PROPIETARIO: "Propietario",
  INQUILINO: "Inquilino",
}

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" })

const formatTamanio = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const colorSaldo = (valor: number) => (valor > 0.005 ? "text-red-600" : valor < -0.005 ? "text-green-600" : "text-slate-700")

export function CierreEjercicioClient() {
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual - 1)
  const [data, setData] = useState<CierreEjercicioData | null>(null)
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [importando, setImportando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [dialogCerrar, setDialogCerrar] = useState(false)
  const [dialogReabrir, setDialogReabrir] = useState(false)
  const [observaciones, setObservaciones] = useState("")
  const [motivoReapertura, setMotivoReapertura] = useState("")
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  const years = useMemo(() => Array.from({ length: 8 }, (_, i) => anioActual - 7 + i), [anioActual])

  const cargar = useCallback(async (anioObjetivo: number) => {
    setIsLoading(true)
    try {
      const [datos, cuentas] = await Promise.all([getCierreEjercicioData(anioObjetivo), getCuentasBancarias()])
      setData(datos)
      setCuentasBancarias(cuentas)
    } catch (error) {
      console.error("Error cargando cierre de ejercicio:", error)
      toast({ title: "Error", description: "No se pudieron cargar los datos del ejercicio", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar(anio)
  }, [anio, cargar])

  const estadosCuenta = data?.estadosCuenta ?? []
  const setEstadosCuenta = (fn: (prev: EstadoCuentaBancoArchivo[]) => EstadoCuentaBancoArchivo[]) =>
    setData(prev => (prev ? { ...prev, estadosCuenta: fn(prev.estadosCuenta) } : prev))

  const cuentasMap = useMemo(() => new Map(cuentasBancarias.map(c => [c.id, c])), [cuentasBancarias])

  // Estado del ejercicio
  const cerrado = Boolean(data?.cierre)
  const ultimoCerrado = data?.ultimoAnioCerrado ?? null
  const bloqueadoPorPosterior = !cerrado && ultimoCerrado !== null && anio < ultimoCerrado
  const enCurso = anio >= anioActual
  const puedeCerrar = !cerrado && !enCurso
  const puedeReabrir = cerrado && ultimoCerrado === anio

  // Verificación: los saldos actuales deben coincidir con la foto tomada al cerrar
  const diferenciasCierre = useMemo(() => {
    if (!data?.cierre) return []
    const s = data.cierre.snapshot
    const t = data.totales
    const difs: string[] = []
    if (Math.abs(s.saldoBancarioCierre - t.saldoBancarioCierre) > 0.01) {
      difs.push(`Saldo bancario al cierre: registrado ${formatCurrency(s.saldoBancarioCierre)}, actual ${formatCurrency(t.saldoBancarioCierre)}`)
    }
    if (Math.abs(s.deudaUnidadesCierre - t.deudaUnidadesCierre) > 0.01) {
      difs.push(`Deuda de unidades al cierre: registrada ${formatCurrency(s.deudaUnidadesCierre)}, actual ${formatCurrency(t.deudaUnidadesCierre)}`)
    }
    return difs
  }, [data])

  const tituloAnexo = (estado: EstadoCuentaBancoArchivo) => {
    const cuenta = estado.cuentaBancariaId ? cuentasMap.get(estado.cuentaBancariaId) : null
    return cuenta ? `${cuenta.banco} ${cuenta.numeroCuenta} - ${estado.nombreArchivo}` : estado.nombreArchivo
  }

  // ── Importar estados de cuenta (PDF del banco) ──
  const handleArchivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (archivos.length === 0 || !data) return

    // Si el ejercicio tiene una sola cuenta, se asigna automáticamente
    const cuentaPorDefecto = data.cuentas.length === 1 ? data.cuentas[0].id : null

    setImportando(true)
    let importados = 0
    for (const archivo of archivos) {
      try {
        if (!archivo.name.toLowerCase().endsWith(".pdf") && archivo.type !== "application/pdf") {
          throw new Error("Solo se pueden importar archivos PDF.")
        }
        if (archivo.size > TAMANIO_MAXIMO) {
          throw new Error("El archivo supera los 20 MB.")
        }
        const bytes = new Uint8Array(await archivo.arrayBuffer())
        const paginas = await inspeccionarPdfBanco(bytes)
        const creado = await createEstadoCuentaBanco({
          anio,
          cuentaBancariaId: cuentaPorDefecto,
          nombreArchivo: archivo.name,
          tamanio: archivo.size,
          paginas,
          contenidoBase64: bytesToBase64(bytes),
        })
        setEstadosCuenta(prev => [...prev, creado])
        importados++
      } catch (error) {
        toast({
          title: `No se pudo importar "${archivo.name}"`,
          description: error instanceof Error ? error.message : "Error desconocido",
          variant: "destructive",
        })
      }
    }
    setImportando(false)
    if (importados > 0) {
      toast({
        title: importados === 1 ? "Estado de cuenta importado" : `${importados} estados de cuenta importados`,
        description: "Se agregarán como anexo al PDF del cierre.",
        variant: "success",
      })
    }
  }

  const handleCambiarCuenta = async (estadoId: string, valor: string) => {
    const cuentaId = valor === SIN_CUENTA ? null : valor
    try {
      await updateCuentaEstadoCuentaBanco(estadoId, cuentaId)
      setEstadosCuenta(prev => prev.map(e => (e.id === estadoId ? { ...e, cuentaBancariaId: cuentaId } : e)))
    } catch {
      toast({ title: "Error", description: "No se pudo asignar la cuenta", variant: "destructive" })
    }
  }

  const handleEliminarEstado = async (estado: EstadoCuentaBancoArchivo) => {
    if (!confirm(`¿Quitar "${estado.nombreArchivo}" del cierre ${anio}?`)) return
    try {
      await deleteEstadoCuentaBanco(estado.id)
      setEstadosCuenta(prev => prev.filter(e => e.id !== estado.id))
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el archivo", variant: "destructive" })
    }
  }

  // ── PDF del cierre ──
  const handleGenerarPDF = async () => {
    if (!data) return
    setGenerandoPDF(true)
    try {
      const anexos = []
      for (const estado of data.estadosCuenta) {
        const contenido = await getContenidoEstadoCuentaBanco(estado.id)
        if (contenido) anexos.push({ titulo: tituloAnexo(estado), bytes: base64ToBytes(contenido) })
      }
      const piePagina = await getPiePaginaInforme()
      const result = await generateCierreEjercicioPDF(data, { piePagina, anexos })
      const saved = await savePDFWithDialog(result)
      if (saved) {
        toast({ title: "PDF guardado", description: `Cierre de ejercicio ${anio} guardado correctamente`, variant: "success" })
      }
    } catch (error) {
      console.error("Error generando PDF de cierre:", error)
      toast({ title: "Error", description: "No se pudo generar el PDF del cierre", variant: "destructive" })
    } finally {
      setGenerandoPDF(false)
    }
  }

  // ── Cerrar / reabrir ──
  const handleCerrar = async () => {
    setProcesando(true)
    try {
      await cerrarEjercicio(anio, observaciones)
      setDialogCerrar(false)
      setObservaciones("")
      toast({
        title: `Ejercicio ${anio} cerrado`,
        description: `Los movimientos hasta el 31/12/${anio} quedaron bloqueados.`,
        variant: "success",
      })
      await cargar(anio)
    } catch (error) {
      toast({ title: "No se pudo cerrar", description: error instanceof Error ? error.message : "Error desconocido", variant: "destructive" })
    } finally {
      setProcesando(false)
    }
  }

  const handleReabrir = async () => {
    setProcesando(true)
    try {
      await reabrirEjercicio(anio, motivoReapertura)
      setDialogReabrir(false)
      setMotivoReapertura("")
      toast({ title: `Ejercicio ${anio} reabierto`, description: "Ya se pueden modificar sus movimientos." })
      await cargar(anio)
    } catch (error) {
      toast({ title: "No se pudo reabrir", description: error instanceof Error ? error.message : "Error desconocido", variant: "destructive" })
    } finally {
      setProcesando(false)
    }
  }

  const t = data?.totales
  const hayTransferencias = Boolean(data && data.cuentas.some(c => Math.abs(c.transferencias) > 0.005))

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <BackToHome />
          <h1 className="text-2xl font-bold text-slate-900">Cierre de Ejercicio</h1>
          <p className="text-sm text-slate-500">Cierre anual de cuentas, saldos y estados de cuenta del banco</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-white p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnio(a => a - 1)} disabled={isLoading} aria-label="Ejercicio anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={anio.toString()} onValueChange={v => setAnio(parseInt(v))}>
              <SelectTrigger className="h-8 w-[90px] border-0 bg-transparent font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(years.includes(anio) ? years : [...years, anio].sort()).map(y => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setAnio(a => a + 1)}
              disabled={isLoading || anio >= anioActual}
              aria-label="Ejercicio siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" className="gap-2" onClick={handleGenerarPDF} disabled={isLoading || generandoPDF || !data}>
            {generandoPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF del cierre
          </Button>

          {puedeReabrir && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setDialogReabrir(true)} disabled={isLoading}>
              <LockOpen className="h-4 w-4" />
              Reabrir ejercicio
            </Button>
          )}
          {!cerrado && (
            <Button
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={() => setDialogCerrar(true)}
              disabled={isLoading || !puedeCerrar}
              title={enCurso ? `El ejercicio ${anio} todavía no terminó` : undefined}
            >
              <Lock className="h-4 w-4" />
              Cerrar ejercicio {anio}
            </Button>
          )}
        </div>
      </div>

      {isLoading || !data || !t ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Estado del ejercicio */}
          {cerrado && data.cierre ? (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-green-800">
                  Ejercicio {anio} cerrado el {formatFecha(data.cierre.fechaCierre)}
                </p>
                <p className="text-green-700">
                  Los movimientos con fecha hasta el 31/12/{ultimoCerrado ?? anio} están bloqueados.
                  {!puedeReabrir && ultimoCerrado !== null && ` Para reabrirlo, primero reabrí el ejercicio ${ultimoCerrado}.`}
                </p>
                {data.cierre.observaciones && <p className="whitespace-pre-line text-green-700">{data.cierre.observaciones}</p>}
              </div>
            </div>
          ) : bloqueadoPorPosterior ? (
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
              <p className="text-slate-700">
                Este ejercicio no tiene cierre propio, pero sus movimientos ya están bloqueados por el cierre del ejercicio {ultimoCerrado}.
                Podés cerrarlo igual para dejar registrados sus saldos.
              </p>
            </div>
          ) : enCurso ? (
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
              <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <p className="text-blue-800">
                El ejercicio {anio} está en curso. Podés revisar los números y preparar los estados de cuenta;
                el cierre se habilita a partir del 01/01/{anio + 1}.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-amber-800">
                El ejercicio {anio} está abierto. Al cerrarlo se guardan los saldos al 31/12/{anio} y quedan bloqueados
                todos los movimientos hasta esa fecha (incluidos los años anteriores).
              </p>
            </div>
          )}

          {diferenciasCierre.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-medium text-red-800">Los saldos actuales no coinciden con los registrados al cerrar</p>
                <ul className="mt-1 list-disc pl-5 text-red-700">
                  {diferenciasCierre.map(d => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi icon={Landmark} label={`Saldo bancario al 01/01/${anio}`} value={formatCurrency(t.saldoBancarioInicio)} />
            <Kpi icon={TrendingUp} label="Ingresos del ejercicio" value={formatCurrency(t.ingresosBanco)} className="text-green-600" />
            <Kpi icon={TrendingDown} label="Egresos del ejercicio" value={formatCurrency(t.egresosBanco)} className="text-red-600" />
            <Kpi icon={Wallet} label={`Saldo bancario al 31/12/${anio}`} value={formatCurrency(t.saldoBancarioCierre)} className="text-blue-600" />
            <Kpi
              icon={Users}
              label={`Deuda de unidades al 31/12/${anio}`}
              value={formatCurrency(t.deudaUnidadesCierre)}
              hint={`${t.unidadesConDeuda} ${t.unidadesConDeuda === 1 ? "unidad" : "unidades"} con deuda`}
              className={colorSaldo(t.deudaUnidadesCierre)}
            />
          </div>

          {/* Estados de cuenta del banco */}
          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Paperclip className="h-4 w-4" />
                  Estados de cuenta del banco
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Importá los PDF que emite el banco: se agregan como anexo al final del PDF del cierre, en este orden.
                </p>
              </div>
              <input
                ref={inputArchivoRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={handleArchivos}
              />
              <Button variant="outline" size="sm" className="gap-2" onClick={() => inputArchivoRef.current?.click()} disabled={importando}>
                {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                Importar PDF
              </Button>
            </CardHeader>
            <CardContent>
              {estadosCuenta.length === 0 ? (
                <p className="rounded-lg border border-dashed py-6 text-center text-sm text-slate-500">
                  Todavía no hay estados de cuenta importados para {anio}.
                </p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {estadosCuenta.map((estado, i) => (
                    <div key={estado.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-600">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{estado.nombreArchivo}</p>
                          <p className="text-xs text-slate-500">
                            {estado.paginas} {estado.paginas === 1 ? "página" : "páginas"} · {formatTamanio(estado.tamanio)} · importado el {formatFecha(estado.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={estado.cuentaBancariaId ?? SIN_CUENTA}
                          onValueChange={v => handleCambiarCuenta(estado.id, v)}
                        >
                          <SelectTrigger className="h-8 w-full sm:w-[240px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SIN_CUENTA}>Sin cuenta asignada</SelectItem>
                            {cuentasBancarias.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.banco} · {c.numeroCuenta}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-600"
                          onClick={() => handleEliminarEstado(estado)}
                          aria-label={`Quitar ${estado.nombreArchivo}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detalle */}
          <Tabs defaultValue="cuentas" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
              <TabsTrigger value="cuentas">Cuentas y fondos</TabsTrigger>
              <TabsTrigger value="mensual">Mensual</TabsTrigger>
              <TabsTrigger value="unidades">Unidades</TabsTrigger>
              <TabsTrigger value="egresos">Egresos</TabsTrigger>
            </TabsList>

            <TabsContent value="cuentas" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cuentas bancarias</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead className="text-right">Saldo al 01/01</TableHead>
                        <TableHead className="text-right">Ingresos</TableHead>
                        <TableHead className="text-right">Egresos</TableHead>
                        {hayTransferencias && <TableHead className="text-right">Transferencias</TableHead>}
                        <TableHead className="text-right">Saldo al 31/12</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.cuentas.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={hayTransferencias ? 6 : 5} className="py-6 text-center text-slate-500">
                            No hay cuentas bancarias registradas.
                          </TableCell>
                        </TableRow>
                      )}
                      {data.cuentas.map(c => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">
                              {c.banco}
                              {!c.activa && (
                                <Badge variant="secondary" className="ml-2">
                                  Inactiva
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {c.tipoCuenta} · {c.numeroCuenta} · {c.cantidadMovimientos} movimientos
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(c.saldoInicio)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(c.ingresos)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(c.egresos)}</TableCell>
                          {hayTransferencias && (
                            <TableCell className="text-right text-slate-600">
                              {c.transferencias > 0 ? "+" : ""}
                              {formatCurrency(c.transferencias)}
                            </TableCell>
                          )}
                          <TableCell className="text-right font-semibold">{formatCurrency(c.saldoCierre)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.saldoBancarioInicio)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.ingresosBanco)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.egresosBanco)}</TableCell>
                        {hayTransferencias && (
                          <TableCell className="text-right">{formatCurrency(data.cuentas.reduce((s, c) => s + c.transferencias, 0))}</TableCell>
                        )}
                        <TableCell className="text-right">{formatCurrency(t.saldoBancarioCierre)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                  {hayTransferencias && (
                    <p className="mt-3 text-xs text-slate-500">
                      {data.transferenciasEntreCuentas.cantidad === 1
                        ? "Hubo 1 transferencia entre cuentas del edificio"
                        : `Hubo ${data.transferenciasEntreCuentas.cantidad} transferencias entre cuentas del edificio`}{" "}
                      por {formatCurrency(data.transferenciasEntreCuentas.monto)}. No se cuentan como ingresos ni egresos del ejercicio.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resultado del ejercicio por fondo</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fondo</TableHead>
                        <TableHead className="text-right">Ingresos</TableHead>
                        <TableHead className="text-right">Egresos</TableHead>
                        <TableHead className="text-right">Resultado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: "Gastos Comunes", fondo: data.fondos.gastosComunes },
                        { label: "Fondo de Reserva (incluye Otros Gastos)", fondo: data.fondos.fondoReserva },
                        ...(Math.abs(data.fondos.sinClasificar.ingresos) > 0.005 || Math.abs(data.fondos.sinClasificar.egresos) > 0.005
                          ? [{ label: "Sin clasificar", fondo: data.fondos.sinClasificar }]
                          : []),
                      ].map(({ label, fondo }) => (
                        <TableRow key={label}>
                          <TableCell className="font-medium">{label}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(fondo.ingresos)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(fondo.egresos)}</TableCell>
                          <TableCell className={`text-right font-semibold ${fondo.resultado < 0 ? "text-red-600" : "text-slate-900"}`}>
                            {formatCurrency(fondo.resultado)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{formatCurrency(data.fondos.total.ingresos)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(data.fondos.total.egresos)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(data.fondos.total.resultado)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                  {(Math.abs(data.fondos.sinClasificar.ingresos) > 0.005 || Math.abs(data.fondos.sinClasificar.egresos) > 0.005) && (
                    <p className="mt-3 text-xs text-slate-500">
                      &quot;Sin clasificar&quot; son movimientos bancarios sin fondo asignado. Conviene clasificarlos en Bancos antes de cerrar.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mensual">
              <Card>
                <CardContent className="overflow-x-auto pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mes</TableHead>
                        <TableHead className="text-right">Cargos emitidos</TableHead>
                        <TableHead className="text-right">Cobranzas</TableHead>
                        <TableHead className="text-right">Ingresos banco</TableHead>
                        <TableHead className="text-right">Egresos banco</TableHead>
                        <TableHead className="text-right">Saldo bancario fin de mes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.meses.map(m => (
                        <TableRow key={m.mes}>
                          <TableCell className="font-medium">{m.label}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.cargosEmitidos)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.cobranzas)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(m.ingresos)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(m.egresos)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(m.saldoBancarioFinMes)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.cargosEmitidos)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.cobranzas)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(data.meses.reduce((s, m) => s + m.ingresos, 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(data.meses.reduce((s, m) => s + m.egresos, 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.saldoBancarioCierre)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="unidades">
              <Card>
                <CardContent className="overflow-x-auto pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="text-right">Saldo al 01/01</TableHead>
                        <TableHead className="text-right">G. Comunes</TableHead>
                        <TableHead className="text-right">F. Reserva</TableHead>
                        <TableHead className="text-right">Otros</TableHead>
                        <TableHead className="text-right">Pagos</TableHead>
                        <TableHead className="text-right">Saldo al 31/12</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.apartamentos.map(a => (
                        <TableRow key={a.apartamentoId}>
                          <TableCell>
                            <div className="font-medium">
                              Apto {a.numero}{" "}
                              <span className="font-normal text-slate-500">({tipoOcupacionLabels[a.tipoOcupacion] ?? a.tipoOcupacion})</span>
                              {!a.activo && (
                                <Badge variant="secondary" className="ml-2">
                                  Archivado
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {[a.contactoNombre, a.contactoApellido].filter(Boolean).join(" ") || "Sin titular"}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right ${colorSaldo(a.saldoInicio)}`}>{formatCurrency(a.saldoInicio)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(a.cargosGastosComunes)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(a.cargosFondoReserva)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(a.cargosOtrosGastos)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(a.pagos)}</TableCell>
                          <TableCell className={`text-right font-semibold ${colorSaldo(a.saldoCierre)}`}>{formatCurrency(a.saldoCierre)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.deudaUnidadesInicio)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(data.apartamentos.reduce((s, a) => s + a.cargosGastosComunes, 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(data.apartamentos.reduce((s, a) => s + a.cargosFondoReserva, 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(data.apartamentos.reduce((s, a) => s + a.cargosOtrosGastos, 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.cobranzas)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.deudaUnidadesCierre)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                  <p className="mt-3 text-xs text-slate-500">Saldo positivo = deuda de la unidad; negativo = saldo a favor.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="egresos">
              <Card>
                <CardContent className="overflow-x-auto pt-6">
                  {data.egresosPorServicio.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">No hay egresos registrados en {anio}.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Servicio / Proveedor</TableHead>
                          <TableHead className="text-right">Pagos</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">% del fondo</TableHead>
                        </TableRow>
                      </TableHeader>
                      {GRUPOS_FONDO_EGRESO.map(grupo => {
                        const items = data.egresosPorServicio.filter(e => e.fondo === grupo.fondo)
                        if (items.length === 0) return null
                        const totalFondo = items.reduce((s, e) => s + e.total, 0)
                        return (
                          <TableBody key={grupo.fondo}>
                            <TableRow className="bg-blue-50 hover:bg-blue-50">
                              <TableCell colSpan={4} className="font-semibold text-blue-700">{grupo.titulo}</TableCell>
                            </TableRow>
                            {items.map(e => (
                              <TableRow key={`${e.fondo}-${e.servicio}`}>
                                <TableCell className="pl-6 font-medium">{e.servicio}</TableCell>
                                <TableCell className="text-right">{e.cantidad}</TableCell>
                                <TableCell className="text-right">{formatCurrency(e.total)}</TableCell>
                                <TableCell className="text-right text-slate-500">
                                  {totalFondo > 0 ? `${((e.total / totalFondo) * 100).toFixed(1)} %` : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-slate-50 font-semibold hover:bg-slate-50">
                              <TableCell className="pl-6">Total {grupo.titulo}</TableCell>
                              <TableCell className="text-right">{items.reduce((s, e) => s + e.cantidad, 0)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(totalFondo)}</TableCell>
                              <TableCell className="text-right text-slate-500">100 %</TableCell>
                            </TableRow>
                          </TableBody>
                        )
                      })}
                      <TableFooter>
                        <TableRow>
                          <TableCell>Total egresos</TableCell>
                          <TableCell className="text-right">{data.egresosPorServicio.reduce((s, e) => s + e.cantidad, 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.egresosPorServicio.reduce((s, e) => s + e.total, 0))}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableFooter>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Diálogo: cerrar ejercicio */}
      <Dialog open={dialogCerrar} onOpenChange={open => !procesando && setDialogCerrar(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cerrar ejercicio {anio}</DialogTitle>
            <DialogDescription>
              Se guardan los saldos al 31/12/{anio} y se bloquea crear, modificar o eliminar movimientos con fecha hasta ese día.
              Se puede reabrir más adelante si hace falta corregir algo.
            </DialogDescription>
          </DialogHeader>
          {t && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Saldo bancario al 31/12</p>
                <p className="font-semibold">{formatCurrency(t.saldoBancarioCierre)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Deuda de unidades al 31/12</p>
                <p className="font-semibold">{formatCurrency(t.deudaUnidadesCierre)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Resultado del ejercicio</p>
                <p className="font-semibold">{formatCurrency(data?.fondos.total.resultado ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Estados de cuenta adjuntos</p>
                <p className="font-semibold">{estadosCuenta.length}</p>
              </div>
            </div>
          )}
          {estadosCuenta.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No importaste ningún estado de cuenta del banco para este ejercicio.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="observaciones-cierre">Observaciones (opcional)</Label>
            <Textarea
              id="observaciones-cierre"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Ej.: Cierre aprobado en asamblea del 15/02. Saldo conciliado con el banco."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCerrar(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleCerrar} disabled={procesando}>
              {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Cerrar ejercicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: reabrir ejercicio */}
      <Dialog open={dialogReabrir} onOpenChange={open => !procesando && setDialogReabrir(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reabrir ejercicio {anio}</DialogTitle>
            <DialogDescription>
              Se desbloquean los movimientos del ejercicio y se descarta la foto de saldos guardada al cerrar.
              Queda constancia en la bitácora. Después de corregir, volvé a cerrarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-reapertura">Motivo (opcional)</Label>
            <Textarea
              id="motivo-reapertura"
              value={motivoReapertura}
              onChange={e => setMotivoReapertura(e.target.value)}
              placeholder="Ej.: Corregir pago de diciembre mal imputado."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogReabrir(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button variant="destructive" className="gap-2" onClick={handleReabrir} disabled={procesando}>
              {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
              Reabrir ejercicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
  className?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <p className={`mt-2 text-xl font-bold ${className ?? "text-slate-900"}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </CardContent>
    </Card>
  )
}
