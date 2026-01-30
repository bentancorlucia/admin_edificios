"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSidebar } from "./sidebar-context"
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
  HardDrive,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Apartamentos", href: "/apartamentos", icon: Building2 },
  { name: "Servicios", href: "/servicios", icon: Wrench },
  { name: "Transacciones", href: "/transacciones", icon: ArrowUpDown },
  { name: "Bancos", href: "/bancos", icon: Landmark },
  { name: "Bitácora", href: "/bitacora", icon: ClipboardList },
  { name: "Informes", href: "/informes", icon: FileBarChart },
  { name: "Análisis", href: "/analisis", icon: PieChart },
  { name: "Respaldos", href: "/respaldos", icon: HardDrive },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar } = useSidebar()

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "relative flex h-full flex-col bg-slate-900 text-white transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Botón de colapsar */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {/* Logo */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-slate-800 transition-all duration-300",
            isCollapsed ? "justify-center px-2" : "gap-2 px-6"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
            <Building className="h-6 w-6" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-semibold whitespace-nowrap">EdificioApp</h1>
              <p className="text-xs text-slate-400 whitespace-nowrap">Gestión de edificios</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 space-y-1 py-4", isCollapsed ? "px-2" : "px-3")}>
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const linkContent = (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  isCollapsed
                    ? "justify-center p-2.5"
                    : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
              </Link>
            )

            if (isCollapsed) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return linkContent
          })}
        </nav>

        {/* Version */}
        <div
          className={cn(
            "border-t border-slate-800 p-4 transition-all duration-300",
            isCollapsed && "flex flex-col items-center"
          )}
        >
          {!isCollapsed && <p className="text-xs text-slate-500">Versión</p>}
          <p className={cn("font-medium text-slate-300", isCollapsed ? "text-xs" : "text-sm")}>
            {isCollapsed ? "v1.0" : "1.0.0"}
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}
