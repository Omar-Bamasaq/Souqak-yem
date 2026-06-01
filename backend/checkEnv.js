
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
const backendEnv = path.join(process.cwd(), "backend", ".env.local");
const rootEnv = path.join(process.cwd(), ".env.local");
if (fs.existsSync(backendEnv)) {
  console.log("Found backend env at:", backendEnv);
  dotenv.config({ path: backendEnv, override: true });
}
if (fs.existsSync(rootEnv)) {
  console.log("Found root env at:", rootEnv);
  dotenv.config({ path: rootEnv });
}
dotenv.config();

console.log("Using backend MONGODB_URI preference logic...");
console.log("Current MONGODB_URI:", process.env.MONGODB_URI);
