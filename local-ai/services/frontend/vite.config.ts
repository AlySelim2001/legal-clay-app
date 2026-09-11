import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Frontend service for the local Zero-Trust stack. Served by nginx (see
// ./nginx.conf) which also proxies /api/* to legal-backend-api with the
// INTERNAL_API_KEY injected SERVER-SIDE — the browser never sees the key.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
