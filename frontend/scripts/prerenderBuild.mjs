import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { INDEXABLE_STATIC_ROUTES } from "./prerenderRoutes.mjs";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function copyDirectoryContents(source, destination) {
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    await fs.cp(
      path.join(source, entry.name),
      path.join(destination, entry.name),
      { recursive: true }
    );
  }
}

export async function validatePrerenderOutput(directory) {
  const indexPath = path.join(directory, "index.html");
  const sitemapPath = path.join(directory, "sitemap.xml");
  const robotsPath = path.join(directory, "robots.txt");
  const manifestPath = path.join(directory, "prerender-manifest.json");
  const requiredFiles = [indexPath, sitemapPath, robotsPath, manifestPath];
  for (const requiredFile of requiredFiles) {
    const stats = await fs.stat(requiredFile).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!stats?.isFile() || stats.size === 0) {
      throw new Error("Build output is missing complete index, prerender manifest, sitemap, or robots files.");
    }
  }

  const [indexHtml, sitemapXml, robotsTxt, manifestJson] = await Promise.all([
    fs.readFile(indexPath, "utf8"),
    fs.readFile(sitemapPath, "utf8"),
    fs.readFile(robotsPath, "utf8"),
    fs.readFile(manifestPath, "utf8")
  ]);
  if (!/<html(?:\s|>)/i.test(indexHtml) || !/<body(?:\s|>)/i.test(indexHtml)) {
    throw new Error("Build output index.html is incomplete.");
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestJson);
  } catch {
    throw new Error("Prerender manifest is not valid JSON.");
  }
  const requiredStaticPaths = INDEXABLE_STATIC_ROUTES.map(({ path: routePath }) => routePath);
  const resolvedDirectory = path.resolve(directory);
  if (
    manifest?.version !== 1
    || !["api", "local"].includes(manifest.source)
    || typeof manifest.siteBaseUrl !== "string"
    || !Array.isArray(manifest.staticPaths)
    || !requiredStaticPaths.every((routePath) => manifest.staticPaths.includes(routePath))
    || !Array.isArray(manifest.categoryPaths)
    || !Array.isArray(manifest.adPaths)
    || !Array.isArray(manifest.sitemapUrls)
    || manifest.sitemapUrls.length < requiredStaticPaths.length
    || new Set(manifest.sitemapUrls).size !== manifest.sitemapUrls.length
  ) {
    throw new Error("Prerender manifest does not prove that the expected SEO pages were generated.");
  }
  if (
    !sitemapXml.includes("<urlset")
    || !sitemapXml.includes("</urlset>")
    || !robotsTxt.includes("User-agent: *")
    || !robotsTxt.includes(`Sitemap: ${manifest.siteBaseUrl}/sitemap.xml`)
  ) {
    throw new Error("Build output sitemap.xml or robots.txt is incomplete.");
  }

  const sitemapUrls = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map(([, value]) => value.replace(/&amp;/g, "&"));
  if (sitemapUrls.length !== manifest.sitemapUrls.length) {
    throw new Error("Sitemap URL count does not match the prerender manifest.");
  }

  const expectedUrls = new Set(manifest.sitemapUrls);
  const expectedStaticUrls = INDEXABLE_STATIC_ROUTES.map(({ canonical }) =>
    `${manifest.siteBaseUrl}${canonical}`
  );
  if (!expectedStaticUrls.every((url) => expectedUrls.has(url))) {
    throw new Error("Sitemap does not include every required public static page.");
  }

  const resolvePagePath = (routePath) => {
    if (typeof routePath !== "string" || !routePath.startsWith("/") || routePath.includes("\\")) {
      throw new Error("Prerender manifest contains an invalid page path.");
    }
    const decodedPath = decodeURIComponent(routePath);
    const relativePath = decodedPath === "/" ? "index.html" : `${decodedPath.replace(/^\/+|\/+$/g, "")}/index.html`;
    const pagePath = path.resolve(resolvedDirectory, relativePath);
    if (pagePath !== resolvedDirectory && !pagePath.startsWith(`${resolvedDirectory}${path.sep}`)) {
      throw new Error("Prerender manifest contains a page path outside the build output.");
    }
    return pagePath;
  };

  const expectedRoutes = [
    ...manifest.staticPaths,
    ...manifest.categoryPaths,
    ...manifest.adPaths
  ];
  for (const routePath of expectedRoutes) {
    const pagePath = resolvePagePath(routePath);
    const stats = await fs.stat(pagePath).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!stats?.isFile() || stats.size === 0) {
      throw new Error("A route listed in the prerender manifest is missing.");
    }
  }

  for (const urlValue of sitemapUrls) {
    if (!expectedUrls.has(urlValue)) {
      throw new Error("Sitemap contents do not match the prerender manifest.");
    }
    const url = new URL(urlValue);
    const pagePath = resolvePagePath(url.pathname);
    const stats = await fs.stat(pagePath).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!stats?.isFile() || stats.size === 0) {
      throw new Error("A sitemap page is missing from the prerender output.");
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, directory] = process.argv.slice(2);
  if (mode !== "--validate" || !directory) {
    console.error("Usage: node prerenderBuild.mjs --validate <dist-directory>");
    process.exitCode = 2;
  } else {
    validatePrerenderOutput(path.resolve(directory)).catch((error) => {
      console.error(`Prerender output validation failed: ${error.message}`);
      process.exitCode = 1;
    });
  }
}

export async function runAtomicPrerender({ distDirectory, generate }) {
  if (typeof generate !== "function") {
    throw new TypeError("A prerender generation function is required.");
  }

  const resolvedDist = path.resolve(distDirectory);
  const parentDirectory = path.dirname(resolvedDist);
  const directoryName = path.basename(resolvedDist);
  const stagingDirectory = await fs.mkdtemp(
    path.join(parentDirectory, `.${directoryName}-prerender-`)
  );
  const backupDirectory = `${resolvedDist}.backup-${randomUUID()}`;
  let oldDistMoved = false;
  let stagingPromoted = false;

  try {
    if (await pathExists(resolvedDist)) {
      await copyDirectoryContents(resolvedDist, stagingDirectory);
    }
    await Promise.all(["sitemap.xml", "robots.txt", "prerender-manifest.json"].map((file) =>
      fs.rm(path.join(stagingDirectory, file), { force: true })
    ));
    const result = await generate(stagingDirectory);
    await validatePrerenderOutput(stagingDirectory);

    if (await pathExists(resolvedDist)) {
      await fs.rename(resolvedDist, backupDirectory);
      oldDistMoved = true;
    }
    try {
      await fs.rename(stagingDirectory, resolvedDist);
      stagingPromoted = true;
    } catch (error) {
      await fs.rename(backupDirectory, resolvedDist);
      oldDistMoved = false;
      throw error;
    }

    try {
      await fs.rm(backupDirectory, { recursive: true, force: true });
      oldDistMoved = false;
    } catch (error) {
      console.error("New prerender output committed, but the previous dist backup could not be removed.", {
        message: error.message
      });
    }

    return result;
  } catch (error) {
    if (oldDistMoved && !(await pathExists(resolvedDist))) {
      try {
        await fs.rename(backupDirectory, resolvedDist);
        oldDistMoved = false;
      } catch (restoreError) {
        error.restoreError = restoreError.message;
        console.error("Failed to restore the previous dist after prerender failed.", {
          message: restoreError.message
        });
      }
    }

    if (!stagingPromoted) {
      try {
        await fs.rm(stagingDirectory, { recursive: true, force: true });
      } catch (cleanupError) {
        error.cleanupError = cleanupError.message;
        console.error("Failed to remove the temporary prerender directory.", {
          message: cleanupError.message
        });
      }
    }
    throw error;
  }
}
