import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connectPrelaunchDatabase, resolvePrelaunchTarget, safeErrorSummary } from "../lib/prelaunchDatabase.js";
import { loadApplicationModels, buildIndexPlan } from "./prelaunchIndexes.js";
import { verifyIndexPlan } from "./prelaunchIndexVerification.js";

export async function runVerification({
  env = process.env,
  connect = connectPrelaunchDatabase,
  loadModels = loadApplicationModels,
  verify = verifyIndexPlan
} = {}) {
  if (env.PRELAUNCH_INDEXES_VERIFY_APPROVED !== "YES") {
    throw new Error("PRELAUNCH_INDEXES_VERIFY_APPROVED=YES is required to verify prelaunch indexes.");
  }
  const target = resolvePrelaunchTarget(env);
  const plan = buildIndexPlan(await loadModels());
  let connected = false;
  try {
    await connect(env);
    connected = true;
    if (mongoose.connection.name !== target.databaseName) {
      throw new Error("Connected database does not match the approved prelaunch target.");
    }
    const result = await verify(plan, mongoose.connection.db);
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
    return result;
  } finally {
    if (connected) await mongoose.disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runVerification().catch((error) => {
    console.error("Prelaunch index verification failed.", safeErrorSummary(error));
    process.exitCode = 1;
  });
}
