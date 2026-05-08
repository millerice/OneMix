import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const apiBase = process.env.VITE_API_BASE || "http://127.0.0.1:8767";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/pages": path.resolve(__dirname, "./src/pages"),
      "@/types": path.resolve(__dirname, "./src/types"),
      "@/constants": path.resolve(__dirname, "./src/constants"),
      "@/hooks": path.resolve(__dirname, "./src/hooks"),
      "@/utils": path.resolve(__dirname, "./src/utils"),
      "@/services": path.resolve(__dirname, "./src/services"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: apiBase, changeOrigin: true },
      "/health": { target: apiBase, changeOrigin: true },
    },
  },
});