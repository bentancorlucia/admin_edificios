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

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        setIsReady(true);
      } catch (err) {
        console.error("Error inicializando base de datos:", err);
        const errorMessage = err instanceof Error ? err.message : "Error desconocido";
        setError(errorMessage);
        // Capturar detalles adicionales del error
        if (err && typeof err === 'object') {
          setErrorDetails(JSON.stringify(err, null, 2));
        }
      }
    };

    init();
  }, []);

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
          <div className="text-sm text-gray-500 bg-gray-100 p-3 rounded font-mono mb-4 max-h-32 overflow-auto">
            {error}
          </div>
          {errorDetails && errorDetails !== '{}' && (
            <details className="text-xs text-gray-400">
              <summary className="cursor-pointer hover:text-gray-600">Ver detalles técnicos</summary>
              <pre className="mt-2 bg-gray-50 p-2 rounded overflow-auto max-h-40">
                {errorDetails}
              </pre>
            </details>
          )}
          <p className="text-sm text-gray-500 mt-4">
            Intenta cerrar la aplicación y volver a abrirla. Si el problema persiste,
            elimina el archivo de base de datos y reinicia la app.
          </p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando base de datos...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
