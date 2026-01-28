"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Building2,
  ArrowUpDown,
  Building,
  Wrench,
  Landmark,
  FileBarChart,
  ClipboardList,
  PieChart,
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Apartamentos", href: "/apartamentos", icon: Building2 },
  { name: "Servicios", href: "/servicios", icon: Wrench },
  { name: "Transacciones", href: "/transacciones", icon: ArrowUpDown },
  { name: "Bancos", href: "/bancos", icon: Landmark },
  { name: "Bitácora", href: "/bitacora", icon: ClipboardList },
  { name: "Informes", href: "/informes", icon: FileBarChart },
  { name: "Análisis", href: "/analisis", icon: PieChart },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
          <Building className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">EdificioApp</h1>
          <p className="text-xs text-slate-400">Gestión de edificios</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Version */}
      <div className="border-t border-slate-800 p-4">
        <p className="text-xs text-slate-500">Versión</p>
        <p className="text-sm font-medium text-slate-300">1.0.0</p>
      </div>
    </div>
  )
}
