"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export function BackToHome({ dark }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-1 text-xs transition-colors mb-1 ${
        dark
          ? "text-white/50 hover:text-white/80"
          : "text-slate-400 hover:text-slate-600"
      }`}
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      Principal
    </Link>
  )
}
