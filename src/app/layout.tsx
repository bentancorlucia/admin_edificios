import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { Toaster } from "@/components/ui/toaster"
import { DatabaseInitializer } from "@/components/database-initializer"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EdificioApp - Gestión de Edificios",
  description: "Sistema de administración de edificios",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <DatabaseInitializer>
          <SidebarProvider>
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto bg-slate-50 transition-all duration-300">
                {children}
              </main>
            </div>
          </SidebarProvider>
          <Toaster />
        </DatabaseInitializer>
      </body>
    </html>
  )
}
