import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { Toaster } from "@/components/ui/toaster"
import { DatabaseInitializer } from "@/components/database-initializer"
import { DevBanner } from "@/components/dev-banner"

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
          <div className="flex flex-col h-screen">
            <DevBanner />
            <SidebarProvider>
              <div className="flex flex-1 min-h-0">
                <Sidebar />
                <main className="flex-1 overflow-auto bg-slate-50 transition-all duration-300">
                  {children}
                </main>
              </div>
            </SidebarProvider>
          </div>
          <Toaster />
        </DatabaseInitializer>
      </body>
    </html>
  )
}
