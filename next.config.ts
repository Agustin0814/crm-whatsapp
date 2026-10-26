import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Rutas antiguas: Etiquetas, Respuestas rápidas y Ajustes viven ahora como
  // pestañas de /configuracion. Temporales (307) por si se reorganiza de nuevo.
  async redirects() {
    return [
      { source: "/ajustes", destination: "/configuracion", permanent: false },
      { source: "/etiquetas", destination: "/configuracion?tab=etiquetas", permanent: false },
      { source: "/respuestas-rapidas", destination: "/configuracion?tab=respuestas-rapidas", permanent: false },
      // Las fichas completas se retiraron: todo se ve en el panel lateral.
      { source: "/contactos/persona/:id", destination: "/contactos", permanent: false },
      { source: "/contactos/empresa/:id", destination: "/contactos", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
