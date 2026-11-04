import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAtomicPrerender } from "./prerenderBuild.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, "..");
const distDirectory = path.join(frontendDirectory, "dist");
const viteEntry = path.join(frontendDirectory, "node_modules", "vite", "bin", "vite.js");
const prerenderEntry = path.join(scriptDirectory, "prerender.mjs");

if (!fs.existsSync(viteEntry)) {
  throw new Error("Vite is not installed in the frontend workspace.");
}

await runAtomicPrerender({
  distDirectory,
  generate: async (stagingDirectory) => {
    execFileSync(process.execPath, [viteEntry, "build", "--outDir", stagingDirectory], {
      cwd: frontendDirectory,
      env: process.env,
      stdio: "inherit"
    });
    execFileSync(process.execPath, [prerenderEntry], {
      cwd: frontendDirectory,
      env: { ...process.env, PRERENDER_DIST_DIR: stagingDirectory },
      stdio: "inherit"
    });
  }
});
