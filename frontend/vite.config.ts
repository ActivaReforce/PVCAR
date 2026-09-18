import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Cada pantalla ya es su propio trozo (React.lazy en App.tsx). Esto separa
    // ademas las librerias, que cambian mucho menos que el codigo propio: un
    // despliegue que solo toca una pantalla no obliga a rebajar React ni
    // Recharts otra vez.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          datos: ["@tanstack/react-query"],
          // El mas grande con diferencia, y solo lo necesitan el Tablero, el
          // detalle de un reporte y los resultados de una encuesta.
          graficas: ["recharts"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
    // Con los trozos separados, un aviso a 600 KB solo seria ruido: el umbral
    // util ahora es el del trozo mas gordo que aun asi deberia bajar.
    chunkSizeWarningLimit: 400,
  },
}));
