"use client";

import { useEffect, useState } from "react";
import { initDatabase } from "@/lib/database";

interface DatabaseInitializerProps {
  children: React.ReactNode;
}

export function DatabaseInitializer({ children }: DatabaseInitializerProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [status, setStatus] = useState("Preparando...");

  useEffect(() => {
    const init = async () => {
      try {
        // Esperar un momento para que Tauri inicialice completamente
        if (retryCount === 0) {
          setStatus("Esperando inicialización de Tauri...");
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          setStatus(`Reintentando conexión (intento ${retryCount + 1}/5)...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setStatus("Conectando a la base de datos...");
        await initDatabase();
        setStatus("Base de datos lista");
        setIsReady(true);
      } catch (err) {
        console.error("Error inicializando base de datos:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Aumentar reintentos para dar más tiempo al plugin SQL
        if (retryCount < 5) {
          console.log(`Reintentando inicialización (intento ${retryCount + 1}/5)...`);
          setRetryCount(prev => prev + 1);
          return;
        }

        setError(errorMessage);
        // Capturar detalles adicionales del error
        if (err && typeof err === 'object') {
          try {
            const details = JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
            if (details !== '{}') {
              setErrorDetails(details);
            }
          } catch {
            setErrorDetails(String(err));
          }
        }
      }
    };

    init();
  }, [retryCount]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg bg-white p-8 shadow-lg max-w-lg">
          <h2 className="text-xl font-semibold text-red-600 mb-4">
            Error de Base de Datos
          </h2>
          <p className="text-gray-600 mb-4">
            No se pudo inicializar la base de datos local.
          </p>
          <div className="text-sm text-gray-500 bg-gray-100 p-3 rounded font-mono mb-4 max-h-32 overflow-auto break-all">
            {error}
          </div>
          {errorDetails && errorDetails !== '{}' && (
            <details className="text-xs text-gray-400 mb-4">
              <summary className="cursor-pointer hover:text-gray-600">Ver detalles técnicos</summary>
              <pre className="mt-2 bg-gray-50 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap break-all">
                {errorDetails}
              </pre>
            </details>
          )}
          <div className="text-sm text-gray-500 space-y-2">
            <p className="font-medium">Posibles soluciones:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Cierra la aplicación completamente y vuelve a abrirla</li>
              <li>Verifica que la aplicación tenga permisos de escritura</li>
              <li>Ejecuta la aplicación como administrador</li>
              <li>Si persiste, elimina la carpeta de datos de la app en: <code className="bg-gray-100 px-1 rounded text-xs">%APPDATA%\com.adminedificios.desktop</code></li>
            </ol>
          </div>
          <button
            onClick={() => {
              setError(null);
              setErrorDetails(null);
              setRetryCount(0);
            }}
            className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{status}</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-400 mt-2">
              Intento {retryCount + 1} de 5
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
