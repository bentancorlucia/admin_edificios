/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Aumentar timeout de carga de chunks para evitar ChunkLoadError en dev (Windows)
  // y configurar webpack para mejor estabilidad del HMR
  webpack: (config, { dev }) => {
    if (dev) {
      config.output.chunkLoadTimeout = 120000 // 120s en lugar del default 30s
    }
    return config
  },
}

module.exports = nextConfig
