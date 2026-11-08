import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import {
  buildDryRunReport,
  inspectImages,
  loadBundle,
  readReferenceCollections,
  renderMarkdownReport,
  validateDryRunTarget
} from "./lib/productionDataDryRun.js";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_BUNDLE_DIRECTORY = path.join(BACKEND_DIRECTORY, "exports", "production-data");
const DEFAULT_REPORT_DIRECTORY = path.join(BACKEND_DIRECTORY, "exports", "import-preview");

export function parseArguments(argv) {
  const options = {
    bundleDirectory: DEFAULT_BUNDLE_DIRECTORY,
    reportDirectory: DEFAULT_REPORT_DIRECTORY,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--apply" || argument === "--write") {
      throw new Error("Write/import modes are not implemented or available in this phase.");
    }
    const option = {
      "--bundle-dir": "bundleDirectory",
      "--report-dir": "reportDirectory"
    }[argument];
    if (!option || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      throw new Error(`Unknown or incomplete option: ${argument}`);
    }
    options[option] = path.resolve(argv[index + 1]);
    index += 1;
  }
  return options;
}

function assertReportDirectoryIsOutsideBundle(bundleDirectory, reportDirectory) {
  const relative = path.relative(bundleDirectory, reportDirectory);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error("Report directory must be outside the source bundle directory.");
  }
}

function hasAnyTargetSetting(env) {
  return Boolean(env.IMPORT_DRY_RUN_MONGODB_URI || env.IMPORT_DRY_RUN_DATABASE_NAME
    || env.IMPORT_DRY_RUN_LOCAL_TARGET_APPROVED);
}

function getTargetFromEnvironment(env) {
  if (!hasAnyTargetSetting(env)) return null;
  return validateDryRunTarget({
    uri: env.IMPORT_DRY_RUN_MONGODB_URI,
    databaseName: env.IMPORT_DRY_RUN_DATABASE_NAME,
    approval: env.IMPORT_DRY_RUN_LOCAL_TARGET_APPROVED,
    nodeEnv: env.NODE_ENV
  });
}

function reportFileStem(generatedAt) {
  return generatedAt.replace(/[:.]/g, "-");
}

async function writeReports(reportDirectory, report) {
  await fs.mkdir(reportDirectory, { recursive: true });
  const stem = `dry-run-${reportFileStem(report.generatedAt)}`;
  const jsonPath = path.join(reportDirectory, `${stem}.json`);
  const markdownPath = path.join(reportDirectory, `${stem}.md`);
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx"
  });
  await fs.writeFile(markdownPath, renderMarkdownReport(report), {
    encoding: "utf8",
    flag: "wx"
  });
  return { jsonPath, markdownPath };
}

export async function runDryRun({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log
} = {}) {
  const options = parseArguments(argv);
  if (options.help) {
    log([
      "Production data importer — dry-run only",
      "",
      "Usage: node scripts/importProductionData.mjs [--bundle-dir PATH] [--report-dir PATH]",
      "",
      "Optional local target comparison requires all of:",
      "  IMPORT_DRY_RUN_MONGODB_URI",
      "  IMPORT_DRY_RUN_DATABASE_NAME=souqak_prelaunch_<name>",
      "  IMPORT_DRY_RUN_LOCAL_TARGET_APPROVED=YES",
      "",
      "Only one direct local MongoDB endpoint on a non-default port is accepted.",
      "Production/remote targets and all write modes are rejected."
    ].join("\n"));
    return null;
  }

  assertReportDirectoryIsOutsideBundle(options.bundleDirectory, options.reportDirectory);
  const bundle = await loadBundle(options.bundleDirectory);
  const images = await inspectImages(bundle, BACKEND_DIRECTORY);
  const target = getTargetFromEnvironment(env);
  let report;

  if (target && bundle.validation.errors.length === 0) {
    try {
      await mongoose.connect(target.uri, {
        dbName: target.databaseName,
        directConnection: true,
        autoIndex: false,
        autoCreate: false,
        bufferCommands: false,
        readPreference: "primary",
        serverSelectionTimeoutMS: 5000,
      });
      if (mongoose.connection.name !== target.databaseName
        || !["127.0.0.1", "localhost", "::1"].includes(mongoose.connection.host)) {
        throw new Error("Connected database failed the local target safety check.");
      }
      const existing = await readReferenceCollections(mongoose.connection.db);
      report = buildDryRunReport(bundle, existing, {
        target: { databaseName: target.databaseName, host: target.hostname, port: target.port },
        images
      });
    } catch {
      throw new Error("Local dry-run database comparison failed; connection details were omitted.");
    } finally {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    }
  } else {
    report = buildDryRunReport(bundle, null, {
      images,
      warnings: target
        ? ["لم تتم مطابقة قاعدة الهدف لأن ملفات الحزمة اجتازت الفحص مع أخطاء."]
        : undefined
    });
  }

  const paths = await writeReports(options.reportDirectory, report);
  log(JSON.stringify({
    mode: report.mode,
    databaseConnected: report.databaseConnected,
    target: report.target,
    bundleStatus: report.bundle.validation.status,
    fingerprint: report.bundle.fingerprint?.bundle,
    totalCounts: report.totalCounts,
    unresolvedRelations: report.unresolvedRelations.length,
    images: {
      checked: report.images.checked,
      present: report.images.present,
      missing: report.images.missing.length,
      invalid: report.images.invalid.length,
      external: report.images.external.length
    },
    writeOperations: report.writeOperations,
    readyForImport: report.readyForImport,
    reports: paths
  }, null, 2));
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runDryRun().catch((error) => {
    console.error(`Production data dry run failed: ${error.message}`);
    process.exitCode = 1;
  });
}
