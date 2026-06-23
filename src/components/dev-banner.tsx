"use client";

import { useEffect, useState } from "react";
import { isDevMode, syncDevFromProd, generarTransaccionesMensuales, generarOtrosGastosMensuales } from "@/lib/database";

const MESES = [
  { v: 1, n: "Enero" }, { v: 2, n: "Febrero" }, { v: 3, n: "Marzo" }, { v: 4, n: "Abril" },
  { v: 5, n: "Mayo" }, { v: 6, n: "Junio" }, { v: 7, n: "Julio" }, { v: 8, n: "Agosto" },
  { v: 9, n: "Septiembre" }, { v: 10, n: "Octubre" }, { v: 11, n: "Noviembre" }, { v: 12, n: "Diciembre" },
];

export function DevBanner() {
  const [isDev, setIsDev] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const ahora = new Date();
  const [mesGen, setMesGen] = useState(ahora.getMonth() + 1);
  const [anioGen, setAnioGen] = useState(ahora.getFullYear());
  const [generando, setGenerando] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  useEffect(() => {
    isDevMode().then(setIsDev);
  }, []);

  if (!isDev) return null;

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncDevFromProd();
      setSyncMessage(result);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setSyncMessage(`Error: ${err}`);
    } finally {
      setSyncing(false);
      setShowConfirm(false);
    }
  };

  const handleGenerarMes = async () => {
    setGenerando(true);
    setGenMessage(null);
    try {
      let totalCreadas = 0;
      let detalles: string[] = [];
      try {
        const r = await generarTransaccionesMensuales({ mes: mesGen, anio: anioGen });
        totalCreadas += r.creadas;
        detalles.push(`GC+FR: ${r.creadas}`);
      } catch (e) {
        detalles.push(`GC+FR: ya generados`);
      }
      const rog = await generarOtrosGastosMensuales({ mes: mesGen, anio: anioGen });
      totalCreadas += rog.creadas;
      detalles.push(`OG: ${rog.creadas}${rog.saltadosYaExistentes > 0 ? ` (${rog.saltadosYaExistentes} existían)` : ""}`);
      setGenMessage(`${rog.mes} → ${detalles.join(" | ")}`);
    } catch (err) {
      setGenMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="bg-amber-500 text-black px-4 py-1.5 text-sm font-medium flex items-center justify-between gap-4 shrink-0 z-50">
      <div className="flex items-center gap-2">
        <span className="bg-black text-amber-500 px-2 py-0.5 rounded text-xs font-bold tracking-wider">
          DEV
        </span>
        <span>Modo Desarrollo — Base de datos de prueba</span>
      </div>

      <div className="flex items-center gap-2">
        {genMessage && (
          <span className={`text-xs px-2 py-0.5 rounded ${genMessage.startsWith("Error") ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}>
            {genMessage}
          </span>
        )}
        <div className="flex items-center gap-1 text-xs">
          <span className="opacity-70">Generar:</span>
          <select
            value={mesGen}
            onChange={(e) => setMesGen(parseInt(e.target.value))}
            disabled={generando}
            className="bg-black/20 text-black px-1 py-0.5 rounded text-xs border-0"
          >
            {MESES.map((m) => (
              <option key={m.v} value={m.v}>{m.n}</option>
            ))}
          </select>
          <input
            type="number"
            min="2020"
            max="2099"
            value={anioGen}
            onChange={(e) => setAnioGen(parseInt(e.target.value) || ahora.getFullYear())}
            disabled={generando}
            className="bg-black/20 text-black px-1 py-0.5 rounded text-xs w-16 border-0"
          />
          <button
            onClick={handleGenerarMes}
            disabled={generando}
            className="bg-black/20 text-black px-2 py-0.5 rounded text-xs font-medium hover:bg-black/30 disabled:opacity-50"
          >
            {generando ? "Generando..." : "Generar mes"}
          </button>
        </div>

        {syncMessage && (
          <span className={`text-xs px-2 py-0.5 rounded ${syncMessage.startsWith("Error") ? "bg-red-600 text-white" : "bg-green-600 text-white"}`}>
            {syncMessage}
          </span>
        )}

        {showConfirm ? (
          <div className="flex items-center gap-1">
            <span className="text-xs mr-1">Esto reemplazará la DB dev con la de prod. La app se recargará.</span>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-red-700 text-white px-2 py-0.5 rounded text-xs font-medium hover:bg-red-800 disabled:opacity-50"
            >
              {syncing ? "Sincronizando..." : "Confirmar"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="bg-black/20 text-black px-2 py-0.5 rounded text-xs font-medium hover:bg-black/30"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="bg-black/20 text-black px-2 py-0.5 rounded text-xs font-medium hover:bg-black/30 transition-colors"
          >
            Sincronizar desde Prod
          </button>
        )}
      </div>
    </div>
  );
}
