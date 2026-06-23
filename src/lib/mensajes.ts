import { open } from '@tauri-apps/plugin-shell';
import { formatPhoneForWhatsApp, formatCurrency } from './utils';

// Variables disponibles para plantillas
export const VARIABLES_DISPONIBLES = [
  { key: '{nombre}', label: 'Nombre', description: 'Nombre del destinatario' },
  { key: '{apellido}', label: 'Apellido', description: 'Apellido del destinatario' },
  { key: '{apartamento}', label: 'Apartamento', description: 'Número de apartamento' },
  { key: '{saldo}', label: 'Saldo', description: 'Saldo actual del apartamento' },
  { key: '{fecha}', label: 'Fecha', description: 'Fecha actual' },
  { key: '{mes}', label: 'Mes', description: 'Mes actual' },
  { key: '{anio}', label: 'Año', description: 'Año actual' },
];

// Resuelve variables en un template
export function resolveVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

// Construye las variables para un destinatario
export function buildVariablesForDestinatario(dest: {
  nombre: string;
  apellido?: string | null;
  apartamentoNumero?: string;
  saldo?: number;
}): Record<string, string> {
  const now = new Date();
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return {
    '{nombre}': dest.nombre || '',
    '{apellido}': dest.apellido || '',
    '{apartamento}': dest.apartamentoNumero || 'N/A',
    '{saldo}': dest.saldo !== undefined ? formatCurrency(dest.saldo) : 'N/A',
    '{fecha}': now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
    '{mes}': meses[now.getMonth()],
    '{anio}': now.getFullYear().toString(),
  };
}

// Construye URL de WhatsApp
export function buildWhatsAppUrl(phone: string, message: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

// Construye URL de Email (Gmail deep link)
export function buildEmailUrl(email: string, subject: string, body: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Enviar mensaje por WhatsApp
export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const url = buildWhatsAppUrl(phone, message);
  await open(url);
}

// Enviar mensaje por Email
export async function sendEmail(email: string, subject: string, body: string): Promise<void> {
  const url = buildEmailUrl(email, subject, body);
  await open(url);
}

// Enviar WhatsApp sin teléfono (link genérico)
export async function sendWhatsAppGeneric(message: string): Promise<void> {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  await open(url);
}
