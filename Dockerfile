# Dockerfile para Next.js con Prisma
FROM node:18-alpine AS base

# Instalar dependencias necesarias para Prisma
RUN apk add --no-cache libc6-compat openssl

# Etapa de dependencias
FROM base AS deps
WORKDIR /app

# Copiar archivos de configuración de paquetes
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm ci

# Generar cliente de Prisma
RUN npx prisma generate

# Etapa de construcción
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables de entorno para build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Construir la aplicación
RUN npm run build

# Etapa de producción
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos necesarios
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Copiar archivos de Next.js standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar node_modules para Prisma CLI (necesario para migraciones)
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
