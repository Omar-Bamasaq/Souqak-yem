import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.PUBLIC_SITE_URL": JSON.stringify(
      process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || ""
    )
  },
  optimizeDeps: {
    include: ["@hello-pangea/dnd"]
  },
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        index: path.resolve(frontendRoot, "index.html"),
        storePwa: path.resolve(frontendRoot, "src/storePwaEntry.jsx")
      },
      output: {
        entryFileNames: (chunk) => chunk.name === "storePwa"
          ? "assets/store-pwa-entry.js"
          : "assets/[name]-[hash].js",
        assetFileNames: (asset) => asset.name?.endsWith(".css")
          ? "assets/store-pwa.css"
          : "assets/[name]-[hash][extname]"
      }
    }
  },
  server: {
    port: 5173
  }
});
