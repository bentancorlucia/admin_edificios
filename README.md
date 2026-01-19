# Admin Edificios

Sistema de administración de edificios - Aplicación de escritorio para gestionar unidades, propietarios, inquilinos, gastos comunes y más.

## Características

- **Gestión de Unidades**: CRUD completo para departamentos (piso, número, metros cuadrados, alícuota)
- **Roles de Usuario**: Perfiles para Propietarios e Inquilinos
- **Gastos Comunes**: Sistema de ingreso mensual con distribución automática por alícuota
- **Cuentas Bancarias**: Registro de cuentas del edificio y estados de cuenta por unidad
- **Reportes PDF**: Generación de informes mensuales con jspdf
- **Comunicación**: Compartir reportes por WhatsApp y Email
- **Dashboard**: Vista principal con recaudación mensual, morosidad y tareas pendientes

## Tecnologías

- **Frontend**: Next.js (App Router) + React
- **Desktop**: Tauri 2
- **Base de Datos**: SQLite (local)
- **Estilos**: Tailwind CSS + Shadcn UI
- **Idioma**: Español

## Requisitos

- Node.js 18+
- Rust 1.77+
- npm o pnpm

## Instalación

```bash
# Clonar repositorio
git clone https://github.com/bentancorlucia/admin_edificios.git
cd admin_edificios

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run tauri dev
```

## Compilar para producción

```bash
# Compilar para el sistema operativo actual
npm run tauri build
```

Los instaladores se generan en `src-tauri/target/release/bundle/`.

## Descargar instaladores

Los instaladores para Windows y macOS están disponibles en [Releases](https://github.com/bentancorlucia/admin_edificios/releases).

## Actualizaciones automáticas

La aplicación incluye un sistema de actualizaciones automáticas. Cuando hay una nueva versión disponible, aparece un botón en la esquina inferior derecha para descargar e instalar la actualización.

## Estructura del proyecto

```
admin_edificios/
├── src/                    # Frontend Next.js
│   ├── app/               # Páginas (App Router)
│   ├── components/        # Componentes React
│   └── lib/               # Utilidades y database.ts
├── src-tauri/             # Backend Tauri (Rust)
│   ├── src/               # Código Rust
│   ├── icons/             # Iconos de la aplicación
│   └── tauri.conf.json    # Configuración Tauri
└── prisma/                # Migraciones SQL
```

## Licencia

MIT
