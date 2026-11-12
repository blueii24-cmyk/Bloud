import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vercel serves from the domain root; GitHub Pages serves from /Bloud/.
// `vite-plugin-singlefile` was removed: Vercel serves hashed assets with
// long-lived caching, which is faster than one inlined HTML file.
const isVercel = Boolean(process.env.VERCEL);

// https://vite.dev/config/
export default defineConfig({
  base: isVercel ? "/" : "/Bloud/",
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: [".e2b.app"],
  },
  define: {
    __VERCEL__: JSON.stringify(isVercel),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
