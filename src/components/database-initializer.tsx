"use client";

import { useEffect, useState } from "react";
import { initDatabase } from "@/lib/database";

interface DatabaseInitializerProps {
  children: React.ReactNode;
}

export function DatabaseInitializer({ children }: DatabaseInitializerProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        setIsReady(true);
      } catch (err) {
        console.error("Error inicializando base de datos:", err);
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    };

    init();
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg bg-white p-8 shadow-lg max-w-md">
          <h2 className="text-xl font-semibold text-red-600 mb-4">
            Error de Base de Datos
          </h2>
          <p className="text-gray-600 mb-4">
            No se pudo inicializar la base de datos local.
          </p>
          <p className="text-sm text-gray-500 bg-gray-100 p-3 rounded font-mono">
            {error}
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
