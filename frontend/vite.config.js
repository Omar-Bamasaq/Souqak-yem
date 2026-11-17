import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const buildId = (
  process.env.SOUQAK_BUILD_ID
  || process.env.VERCEL_GIT_COMMIT_SHA
  || execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: frontendRoot,
    encoding: "utf8"
  }).trim()
).toLowerCase();

if (!/^[a-f0-9]{40}$/.test(buildId)) {
  throw new Error("PWA builds require the full 40-character release commit SHA.");
}

function versionServiceWorker() {
  let outputDirectory;
  return {
    name: "version-service-worker-per-build",
    apply: "build",
    configResolved(config) {
      outputDirectory = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const serviceWorkerPath = path.join(outputDirectory, "sw.js");
      const source = await fs.readFile(serviceWorkerPath, "utf8");
      const marker = "__SOUQAK_BUILD_ID__";
      if (!source.includes(marker)) {
        throw new Error("The generated service worker is missing its build ID marker.");
      }
      await fs.writeFile(serviceWorkerPath, source.replaceAll(marker, buildId));
    }
  };
}

export default defineConfig({
  plugins: [react(), versionServiceWorker()],
  define: {
    __SOUQAK_BUILD_ID__: JSON.stringify(buildId),
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
