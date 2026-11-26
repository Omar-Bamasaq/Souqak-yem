import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAtomicPrerender } from "./prerenderBuild.mjs";
import { createDynamicAdRendererTemplate } from "./rendererTemplate.mjs";
import { resolvePrerenderDataSource } from "./prerenderData.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, "..");
const distDirectory = path.resolve(
  process.env.SOUQAK_BUILD_DIST_DIR || path.join(frontendDirectory, "dist")
);
const viteEntry = path.join(frontendDirectory, "node_modules", "vite", "bin", "vite.js");
const prerenderEntry = path.join(scriptDirectory, "prerender.mjs");
const viteMode = process.env.SOUQAK_VITE_MODE || "production";

resolvePrerenderDataSource(process.env);

if (!fs.existsSync(viteEntry)) {
  throw new Error("Vite is not installed in the frontend workspace.");
}

await runAtomicPrerender({
  distDirectory,
  generate: async (stagingDirectory) => {
    execFileSync(process.execPath, [viteEntry, "build", "--mode", viteMode, "--outDir", stagingDirectory], {
      cwd: frontendDirectory,
      env: process.env,
      stdio: "inherit"
    });
    const builtTemplatePath = path.join(stagingDirectory, "index.html");
    const builtTemplate = await fs.promises.readFile(builtTemplatePath, "utf8");
    await fs.promises.writeFile(
      path.join(stagingDirectory, "dynamic-ad-renderer-template.html"),
      createDynamicAdRendererTemplate(builtTemplate),
      "utf8"
    );
    execFileSync(process.execPath, [prerenderEntry], {
      cwd: frontendDirectory,
      env: { ...process.env, PRERENDER_DIST_DIR: stagingDirectory },
      stdio: "inherit"
    });
  }
});
