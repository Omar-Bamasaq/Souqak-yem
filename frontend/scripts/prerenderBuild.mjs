import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
    await fs.rm(path.join(stagingDirectory, "sitemap.xml"), { force: true });
    const result = await generate(stagingDirectory);
    const indexPath = path.join(stagingDirectory, "index.html");
    const sitemapPath = path.join(stagingDirectory, "sitemap.xml");
    if (!(await pathExists(indexPath)) || !(await pathExists(sitemapPath))) {
      throw new Error("Build output is missing a complete index.html or sitemap.xml.");
    }
    const indexStats = await fs.stat(indexPath);
    const sitemapStats = await fs.stat(sitemapPath);
    if (!indexStats.isFile() || indexStats.size === 0 || !sitemapStats.isFile() || sitemapStats.size === 0) {
      throw new Error("Build output is missing a complete index.html or sitemap.xml.");
    }

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
