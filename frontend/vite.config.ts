import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const apiBase = process.env.VITE_API_BASE || "http://127.0.0.1:8767";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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