const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

console.log("=".repeat(70));
console.log("  Suqaq — JWT Diagnostics Tool (NO secrets printed, NO tokens printed)");
console.log("=".repeat(70));
console.log("");

const cwd = __dirname;
const backendEnv = path.join(cwd, ".env.local");
const rootEnv = path.join(cwd, "..", ".env.local");

const capturedAtImportTime = {
  JWT_SECRET: process.env.JWT_SECRET || undefined,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || undefined,
};

if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv, override: true });
  console.log("[dotenv] Loaded backend/.env.local");
}
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
  console.log("[dotenv] Loaded root .env.local");
}
const plainDotenv = dotenv.config({ path: path.join(cwd, ".env") });
console.log("[dotenv] Loaded backend/.env");
console.log("");

const AUTH_MIDDLEWARE_ACCESS_SECRET_FALLBACK = "access_dev_secret_12345";
const OPTIONAL_AUTH_FALLBACK = "dev_secret_key_change_this_in_production_12345";

const SECRET_ENV_AFTER_DOTENV = process.env.JWT_SECRET;
const SECRET_REFRESH_ENV_AFTER_DOTENV = process.env.REFRESH_TOKEN_SECRET;

const AUTH_MIDDLEWARE_ACCESS_SECRET_TOPLEVEL =
  capturedAtImportTime.JWT_SECRET || AUTH_MIDDLEWARE_ACCESS_SECRET_FALLBACK;
const FILES_JS_ACCESS_SECRET_TOPLEVEL =
  capturedAtImportTime.JWT_SECRET || AUTH_MIDDLEWARE_ACCESS_SECRET_FALLBACK;
const OPTIONAL_AUTH_SECRET_TOPLEVEL =
  capturedAtImportTime.JWT_SECRET || OPTIONAL_AUTH_FALLBACK;

function describeSecret(label, value) {
  const present = !!value;
  const len = present ? String(value).length : 0;
  const isFallbackAuth = value === AUTH_MIDDLEWARE_ACCESS_SECRET_FALLBACK;
  const isFallbackOpt = value === OPTIONAL_AUTH_FALLBACK;
  const isEnvActual = present && !isFallbackAuth && !isFallbackOpt;
  const tag = isFallbackAuth
    ? " — 🔴 FALLBACK auth/files.js (length=23)"
    : isFallbackOpt
    ? " — 🔴 FALLBACK optionalAuth.js (length=46)"
    : isEnvActual
    ? " — 🟢 ACTUAL process.env.JWT_SECRET from .env"
    : " — ⚫ MISSING";
  console.log(`  ${label.padEnd(42)} present=${present}  len=${String(len).padEnd(3)}${tag}`);
}

console.log("--- [PART 1] What each candidate Secret resolves to ---");
console.log("");
describeSecret(
  "SECRET_A: process.env.JWT_SECRET (AFTER dotenv)",
  SECRET_ENV_AFTER_DOTENV
);
describeSecret(
  "SECRET_B: auth.js top-level const ACCESS_SECRET",
  AUTH_MIDDLEWARE_ACCESS_SECRET_TOPLEVEL
);
describeSecret(
  "SECRET_C: fallback string (access_dev_secret_12345)",
  AUTH_MIDDLEWARE_ACCESS_SECRET_FALLBACK
);
describeSecret(
  "SECRET_D: files.js top-level const ACCESS_SECRET",
  FILES_JS_ACCESS_SECRET_TOPLEVEL
);
describeSecret(
  "SECRET_E: optionalAuth.js verify secret",
  OPTIONAL_AUTH_SECRET_TOPLEVEL
);
describeSecret(
  "SECRET_F: optionalAuth.js fallback (different!)",
  OPTIONAL_AUTH_FALLBACK
);
describeSecret(
  "SECRET_G: REFRESH_TOKEN_SECRET env (AFTER dotenv)",
  SECRET_REFRESH_ENV_AFTER_DOTENV
);
console.log("");

function sha256Trunc(s) {
  if (!s) return "N/A";
  return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 12);
}
console.log("--- [PART 1b] Fingerprint comparison (first 12 chars of SHA-256) ---");
console.log("");
console.log(`  SECRET_A (process.env.JWT_SECRET)     fingerprint: ${sha256Trunc(SECRET_ENV_AFTER_DOTENV)}`);
console.log(`  SECRET_B (auth.js ACCESS_SECRET)      fingerprint: ${sha256Trunc(AUTH_MIDDLEWARE_ACCESS_SECRET_TOPLEVEL)}`);
console.log(`  SECRET_C (fallback auth)              fingerprint: ${sha256Trunc(AUTH_MIDDLEWARE_ACCESS_SECRET_FALLBACK)}`);
console.log(`  SECRET_D (files.js ACCESS_SECRET)     fingerprint: ${sha256Trunc(FILES_JS_ACCESS_SECRET_TOPLEVEL)}`);
console.log(`  SECRET_E (optionalAuth.js)            fingerprint: ${sha256Trunc(OPTIONAL_AUTH_SECRET_TOPLEVEL)}`);
console.log(`  SECRET_F (fallback optionalAuth)      fingerprint: ${sha256Trunc(OPTIONAL_AUTH_FALLBACK)}`);
console.log("");

const envMatchesFbAuth =
  SECRET_ENV_AFTER_DOTENV &&
  sha256Trunc(SECRET_ENV_AFTER_DOTENV) === sha256Trunc(AUTH_MIDDLEWARE_ACCESS_SECRET_TOPLEVEL);
console.log(`  SECRET_A == SECRET_B ?  ${envMatchesFbAuth ? "✅ YES" : "❌ NO — MISMATCH → invalid signature inevitable"}`);
console.log(`  SECRET_B == SECRET_C ?  ${AUTH_MIDDLEWARE_ACCESS_SECRET_TOPLEVEL === AUTH_MIDDLEWARE_ACCESS_SECRET_FALLBACK ? "✅ YES (top-level caught fallback before dotenv!)" : "NO"}`);
console.log(`  SECRET_B == SECRET_D ?  ${AUTH_MIDDLEWARE_ACCESS_SECRET_TOPLEVEL === FILES_JS_ACCESS_SECRET_TOPLEVEL ? "✅ YES (both top-level consts, same fallback)" : "NO"}`);
console.log(`  SECRET_E == SECRET_F ?  ${OPTIONAL_AUTH_SECRET_TOPLEVEL === OPTIONAL_AUTH_FALLBACK ? "✅ YES (different fallback, length 46)" : "NO"}`);
console.log("");

function b64UrlDecode(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

function inspectJwt(rawToken) {
  console.log("=".repeat(70));
  console.log("  --- [PART 2] JWT Structure Inspection (WITHOUT signature verification) ---");
  console.log("=".repeat(70));
  console.log("");
  const trimmed = String(rawToken || "").trim();
  if (!trimmed) {
    console.log("  ❌ Token is empty.");
    return null;
  }
  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    console.log(`  ❌ INVALID STRUCTURE: expected 3 base64 segments, got ${parts.length}`);
    return null;
  }
  let header, payload;
  try {
    header = b64UrlDecode(parts[0]);
    payload = b64UrlDecode(parts[1]);
  } catch (e) {
    console.log(`  ❌ INVALID STRUCTURE: base64 decode failed — ${e.message}`);
    return null;
  }
  console.log("  Current token:");
  console.log("    VALID STRUCTURE ✅ (3 base64url segments separated by dots)");
  console.log("");
  console.log("  JWT algorithm:");
  console.log(`    alg = ${header?.alg || "N/A"}    typ = ${header?.typ || "N/A"}`);
  console.log("");
  const id = payload?.userId || payload?.id || payload?.sub || "N/A";
  const role = payload?.role || "N/A";
  const iat = payload?.iat;
  const exp = payload?.exp;
  const now = Math.floor(Date.now() / 1000);
  let validity = "UNKNOWN";
  let validityMs = 0;
  if (typeof exp === "number") {
    const diff = exp - now;
    validityMs = diff * 1000;
    if (diff <= 0) validity = "EXPIRED ❌";
    else {
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      validity = `VALID ✅ (remaining: ${days}d ${hours}h ${mins}m — ${diff}s)`;
    }
  }
  const iatStr = typeof iat === "number" ? new Date(iat * 1000).toISOString() : "N/A";
  const expStr = typeof exp === "number" ? new Date(exp * 1000).toISOString() : "N/A";
  console.log("  JWT user/id:");
  console.log(`    id/userId = ${id}`);
  console.log("");
  console.log("  JWT role:");
  console.log(`    role = ${role}`);
  console.log("");
  console.log("  JWT timestamps:");
  console.log(`    iat (issued at) = ${typeof iat === "number" ? iat : "N/A"}  →  ${iatStr}`);
  console.log(`    exp (expires at) = ${typeof exp === "number" ? exp : "N/A"}  →  ${expStr}`);
  console.log("");
  console.log("  JWT expiration:");
  console.log(`    ${validity}`);
  console.log("");
  const claims = Object.keys(payload).join(", ");
  console.log(`  All payload claims: ${claims}`);
  console.log("");
  return { header, payload, trimmed };
}

function verifyAgainstAllCandidates(tokenObj) {
  if (!tokenObj) return;
  const { trimmed } = tokenObj;
  console.log("=".repeat(70));
  console.log("  --- [PART 3] jwt.verify() against every candidate Secret ---");
  console.log("=".repeat(70));
  console.log("");

  const candidates = [
    ["SECRET_A: process.env.JWT_SECRET (from .env)", SECRET_ENV_AFTER_DOTENV],
    ["SECRET_B: auth.js ACCESS_SECRET (top-level captured)", AUTH_MIDDLEWARE_ACCESS_SECRET_TOPLEVEL],
    ["SECRET_C: auth fallback string (hardcoded 23 chars)", AUTH_MIDDLEWARE_ACCESS_SECRET_FALLBACK],
    ["SECRET_D: files.js ACCESS_SECRET (top-level captured)", FILES_JS_ACCESS_SECRET_TOPLEVEL],
    ["SECRET_E: optionalAuth.js secret", OPTIONAL_AUTH_SECRET_TOPLEVEL],
    ["SECRET_F: optionalAuth fallback string", OPTIONAL_AUTH_FALLBACK],
  ];

  const results = [];
  for (const [label, secret] of candidates) {
    try {
      const decoded = jwt.verify(trimmed, secret);
      results.push({ label, ok: true, decoded });
      const short = label.substring(0, 42).padEnd(42);
      console.log(`  ${short}: verify SUCCESS ✅`);
    } catch (e) {
      results.push({ label, ok: false, err: e.message });
      const short = label.substring(0, 42).padEnd(42);
      console.log(`  ${short}: verify FAILED ❌  (${e.message})`);
    }
  }
  console.log("");
  const successes = results.filter((r) => r.ok);
  if (successes.length === 0) {
    console.log("  ⚠️  NO candidate Secret was able to verify the token.");
    console.log("     → Possible causes:");
    console.log("       • Token was signed with a SECRET THAT NO LONGER EXISTS");
    console.log("       • Token was tampered with or corrupted");
    console.log("       • Token is NOT an Access Token (maybe it's a Refresh Token?)");
    console.log("");
    console.log("  Recommendation: Log out, clear cookies/localStorage, re-login to get a fresh token");
    console.log("                  that matches the currently-running backend's signing secret.");
  } else if (successes.length === 1) {
    const [s] = successes;
    console.log("  ✅ ONE unique signing Secret identified:");
    console.log(`     Exact Secret source that signed the current token:`);
    console.log(`     →  ${s.label}`);
    const idOnly = s.decoded?.userId || s.decoded?.id || "?";
    const roleOnly = s.decoded?.role || "?";
    console.log(`     →  decoded user id=${idOnly}  role=${roleOnly}`);
    console.log("");
    if (s.label.startsWith("SECRET_A")) {
      console.log("     💡 Interpretation: The token was signed WITH process.env.JWT_SECRET (length=46).");
      console.log("        But files.js/auth.js captured ACCESS_SECRET at import as the 23-char FALLBACK.");
      console.log("        → This is the root cause of 'invalid signature' in files.js today.");
    }
    if (s.label.startsWith("SECRET_B") || s.label.startsWith("SECRET_C") || s.label.startsWith("SECRET_D")) {
      console.log("     💡 Interpretation: Token was signed with the 23-char FALLBACK secret.");
      console.log("        This should match files.js/auth middleware, so signature SHOULD be valid there.");
      console.log("        If you still see invalid signature in files.js then check optionalAuth.js routes.");
    }
  } else {
    console.log("  ⚠️  Multiple candidate Secrets verified the token (they have the SAME value):");
    successes.forEach((s) => console.log(`     • ${s.label}`));
  }
  console.log("");
  console.log("=".repeat(70));
  console.log("  --- [PART 4] Final Diagnosis Summary ---");
  console.log("=".repeat(70));
  console.log("");
  const matchesEnv = successes.some((s) => s.label.startsWith("SECRET_A"));
  const matchesFb = successes.some(
    (s) => s.label.startsWith("SECRET_B") || s.label.startsWith("SECRET_C") || s.label.startsWith("SECRET_D")
  );
  if (matchesEnv && !matchesFb) {
    console.log("  ROOT CAUSE IDENTIFIED 🎯:");
    console.log("  ┌─────────────────────────────────────────────────────────────────────┐");
    console.log("  │  Current token was signed using:  process.env.JWT_SECRET  (46 chars) │");
    console.log("  │  But files.js verifies using:     ACCESS_SECRET fallback  (23 chars) │");
    console.log("  │  Because top-level const runs BEFORE dotenv.config() → mismatch.   │");
    console.log("  └─────────────────────────────────────────────────────────────────────┘");
  } else if (matchesFb && !matchesEnv) {
    console.log("  ROOT CAUSE IDENTIFIED 🎯:");
    console.log("  ┌─────────────────────────────────────────────────────────────────────┐");
    console.log("  │  Current token was signed using the 23-char fallback secret.        │");
    console.log("  │  This matches auth.js/files.js, so signature SHOULD be OK there.   │");
    console.log("  │  If you still see invalid signature in optionalAuth routes,        │");
    console.log("  │  that's because optionalAuth uses a DIFFERENT 46-char fallback.    │");
    console.log("  └─────────────────────────────────────────────────────────────────────┘");
  } else if (matchesEnv && matchesFb) {
    console.log("  ℹ️  Both the .env value AND the fallback value have IDENTICAL content,");
    console.log("     so signature is consistent everywhere. Good.");
  }
  console.log("");
}

const TEST_USER_ID = "650000000000000000000001";
console.log("=".repeat(70));
console.log("  --- [PART 0] Sanity check — signing+verifying with each secret ---");
console.log("=".repeat(70));
console.log("");
const allSecrets = [
  ["SECRET_A (.env)", SECRET_ENV_AFTER_DOTENV],
  ["SECRET_B (auth top-level)", AUTH_MIDDLEWARE_ACCESS_SECRET_TOPLEVEL],
  ["SECRET_C (auth fallback)", AUTH_MIDDLEWARE_ACCESS_SECRET_FALLBACK],
  ["SECRET_D (files top-level)", FILES_JS_ACCESS_SECRET_TOPLEVEL],
  ["SECRET_E (optionalAuth)", OPTIONAL_AUTH_SECRET_TOPLEVEL],
];
console.log("  Signing a test JWT { id, role: 'admin' } with each secret, then verifying cross-matrix:");
console.log("");
const testTokens = [];
for (const [signLabel, signSecret] of allSecrets) {
  if (!signSecret) continue;
  const tok = jwt.sign(
    { id: TEST_USER_ID, role: "admin" },
    signSecret,
    { expiresIn: "1h" }
  );
  testTokens.push({ signLabel, tok });
  process.stdout.write(`  Signed with ${signLabel.substring(0, 28).padEnd(28)} → verify against: `);
  const row = allSecrets
    .map(([vLabel, vSecret]) => {
      if (!vSecret) return "·";
      try {
        jwt.verify(tok, vSecret);
        return "✅";
      } catch {
        return "❌";
      }
    })
    .join(" ");
  const headers = allSecrets
    .map(([l]) => (l === signLabel ? "[" + l.substring(8, 16).padStart(8, " ") + "]" : " " + l.substring(8, 16).padStart(8, " ") + " "))
    .join(" ");
  if (signLabel === allSecrets[0][0]) {
    console.log("(columns: " + allSecrets.map((s) => s[0].substring(0, 8)).join(" | ") + ")");
  }
  console.log(row);
}
console.log("");

const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("");
console.log("=".repeat(70));
console.log("  Now inspecting YOUR actual token.");
console.log("=".repeat(70));
console.log("");
console.log("  ℹ️  INSTRUCTIONS:");
console.log("     1. Open Chrome DevTools → Application → Local Storage → localhost:5173");
console.log("     2. Copy the VALUE of key \"token\" (DO NOT paste it into chat/print it here).");
console.log("     3. Paste it below when prompted. This script runs LOCALLY only.");
console.log("     4. To skip: just press Enter.");
console.log("");

rl.question("  Paste your localStorage \"token\" value here (or Enter to skip):  ", (answer) => {
  const userToken = (answer || "").trim();
  console.log("");
  if (!userToken) {
    console.log("  ⏭️  Skipping user token. Continuing with the test-token signed with SECRET_A.");
    if (SECRET_ENV_AFTER_DOTENV) {
      const demo = jwt.sign(
        { id: TEST_USER_ID, role: "admin" },
        SECRET_ENV_AFTER_DOTENV,
        { expiresIn: "7d" }
      );
      console.log("     (Using DEMO token signed with SECRET_A to demonstrate the mismatch.)");
      const t = inspectJwt(demo);
      verifyAgainstAllCandidates(t);
    } else {
      console.log("     (No .env value available to sign demo token.)");
    }
  } else {
    const t = inspectJwt(userToken);
    verifyAgainstAllCandidates(t);
  }
  rl.close();
});
