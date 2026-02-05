import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('US', '')
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  // Usar UTC para evitar problemas de zona horaria
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

export function formatPhoneForWhatsApp(phone: string): string {
  // Eliminar caracteres no numéricos
  const cleaned = phone.replace(/\D/g, '')
  // Si empieza con 09 (formato Uruguay), convertir a +5989
  if (cleaned.startsWith('09')) {
    return '598' + cleaned.substring(1)
  }
  // Si ya tiene código de país 598, dejarlo
  if (cleaned.startsWith('598')) {
    return cleaned
  }
  // Para otros casos, retornar el número limpio
  return cleaned
}
