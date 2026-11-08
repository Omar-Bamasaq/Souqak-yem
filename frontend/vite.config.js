import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
  server: {
    port: 5173
  }
});
