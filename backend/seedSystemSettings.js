import { fileURLToPath } from "url";
import path from "path";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import SystemSettings from "./src/models/SystemSettings.js";
import {
  connectPrelaunchDatabase,
  resolvePrelaunchTarget,
  safeErrorSummary
} from "./src/lib/prelaunchDatabase.js";

const REQUIRED_RATE_CODES = ["USD", "SAR", "YER", "YER_SANAA", "YER_ADEN"];
const REQUIRED_PAIR_CODES = ["SAR", "YER_SANAA", "YER_ADEN"];
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const OWNER_APPROVED_SETTING_FIELDS = [
  "adReviewMode",
  "adReviewDelayMinutes",
  "prohibitedKeywords",
  "withdrawalIdentityThresholdUsd",
  "exchangeRates",
  "exchangeRatePairs",
  "exchangeRatesUpdatedAt",
  "welcomePromotion.enabled",
  "welcomePromotion.durationHours",
  "welcomePromotion.maxBeneficiaries",
  "brokerageEnabled",
  "referralProgram"
];

export const TECHNICAL_SETTINGS_FIELDS = [
  "singletonKey",
  "welcomePromotion.usedCount",
  "welcomePromotion.endDate",
  "welcomePromotion.stats",
  "updatedBy"
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireFiniteNumber(value, field, { min = 0, max = Infinity } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} must be a finite number in the approved range.`);
  }
}

export function validateApprovedSystemSettings(input) {
  if (!isRecord(input)) throw new Error("Approved system settings must be a JSON object.");

  if (!["manual", "auto"].includes(input.adReviewMode)) {
    throw new Error("adReviewMode must be explicitly set to manual or auto.");
  }
  if (![0, 5, 10, 15, -1].includes(input.adReviewDelayMinutes)) {
    throw new Error("adReviewDelayMinutes must be explicitly set to an allowed value.");
  }
  if (!Array.isArray(input.prohibitedKeywords) ||
      input.prohibitedKeywords.some((keyword) => typeof keyword !== "string" || !keyword.trim())) {
    throw new Error("prohibitedKeywords must be an explicitly approved array of non-empty strings.");
  }
  requireFiniteNumber(input.withdrawalIdentityThresholdUsd, "withdrawalIdentityThresholdUsd", { min: 0.01 });

  if (!isRecord(input.exchangeRates)) throw new Error("All exchangeRates must be explicitly approved.");
  for (const currency of REQUIRED_RATE_CODES) {
    requireFiniteNumber(input.exchangeRates[currency], `exchangeRates.${currency}`, { min: 0.000001 });
  }

  if (!isRecord(input.exchangeRatePairs)) throw new Error("All exchangeRatePairs must be explicitly approved.");
  for (const currency of REQUIRED_PAIR_CODES) {
    const pair = input.exchangeRatePairs[currency];
    if (!isRecord(pair)) throw new Error(`exchangeRatePairs.${currency} must include buy and sell rates.`);
    requireFiniteNumber(pair.buy, `exchangeRatePairs.${currency}.buy`, { min: 0.000001 });
    requireFiniteNumber(pair.sell, `exchangeRatePairs.${currency}.sell`, { min: 0.000001 });
  }
  if (input.exchangeRatesUpdatedAt !== null &&
      (typeof input.exchangeRatesUpdatedAt !== "string" || Number.isNaN(Date.parse(input.exchangeRatesUpdatedAt)))) {
    throw new Error("exchangeRatesUpdatedAt must be an approved ISO date or null.");
  }

  const promotion = input.welcomePromotion;
  if (!isRecord(promotion) || typeof promotion.enabled !== "boolean") {
    throw new Error("welcomePromotion.enabled must be explicitly approved.");
  }
  requireFiniteNumber(promotion.durationHours, "welcomePromotion.durationHours", { min: 0.01 });
  requireFiniteNumber(promotion.maxBeneficiaries, "welcomePromotion.maxBeneficiaries", { min: 0 });
  if (!Number.isInteger(promotion.maxBeneficiaries)) {
    throw new Error("welcomePromotion.maxBeneficiaries must be an integer.");
  }

  if (typeof input.brokerageEnabled !== "boolean") {
    throw new Error("brokerageEnabled must be explicitly approved.");
  }
  const referral = input.referralProgram;
  if (!isRecord(referral) || typeof referral.programEnabled !== "boolean" ||
      typeof referral.fraudReviewEnabled !== "boolean") {
    throw new Error("referralProgram enablement and fraud-review settings must be explicitly approved.");
  }
  for (const field of [
    "defaultReferralRate",
    "saleReferralRate",
    "safePurchaseReferralRate",
    "promotionReferralRate"
  ]) {
    requireFiniteNumber(referral[field], `referralProgram.${field}`, { min: 0, max: 100 });
  }
  if (!isRecord(referral.minimumWithdrawal)) {
    throw new Error("referralProgram.minimumWithdrawal must be explicitly approved.");
  }
  for (const currency of ["YER", "YER_ADEN", "YER_SANAA", "SAR", "USD"]) {
    requireFiniteNumber(referral.minimumWithdrawal[currency], `referralProgram.minimumWithdrawal.${currency}`);
  }
  for (const field of ["pendingPeriod", "maxDailyReferralRewards", "maxDailyWithdrawals"]) {
    requireFiniteNumber(referral[field], `referralProgram.${field}`);
  }
  if (!Number.isInteger(referral.pendingPeriod) ||
      !Number.isInteger(referral.maxDailyReferralRewards) ||
      !Number.isInteger(referral.maxDailyWithdrawals)) {
    throw new Error("Referral periods and daily limits must be approved integers.");
  }

  return {
    singletonKey: "global",
    adReviewMode: input.adReviewMode,
    adReviewDelayMinutes: input.adReviewDelayMinutes,
    prohibitedKeywords: [...input.prohibitedKeywords],
    withdrawalIdentityThresholdUsd: input.withdrawalIdentityThresholdUsd,
    exchangeRates: Object.fromEntries(REQUIRED_RATE_CODES.map((currency) => [currency, input.exchangeRates[currency]])),
    exchangeRatePairs: Object.fromEntries(
      REQUIRED_PAIR_CODES.map((currency) => [currency, { buy: input.exchangeRatePairs[currency].buy, sell: input.exchangeRatePairs[currency].sell }])
    ),
    exchangeRatesUpdatedAt: input.exchangeRatesUpdatedAt === null
      ? null
      : new Date(input.exchangeRatesUpdatedAt),
    welcomePromotion: {
      enabled: promotion.enabled,
      durationHours: promotion.durationHours,
      maxBeneficiaries: promotion.maxBeneficiaries,
      usedCount: 0,
      endDate: null,
      stats: {
        summaryShownCount: 0,
        promoteClickCount: 0,
        totalConversions: 0,
        purchasedAfterTrialCount: 0
      }
    },
    brokerageEnabled: input.brokerageEnabled,
    referralProgram: {
      programEnabled: referral.programEnabled,
      defaultReferralRate: referral.defaultReferralRate,
      saleReferralRate: referral.saleReferralRate,
      safePurchaseReferralRate: referral.safePurchaseReferralRate,
      promotionReferralRate: referral.promotionReferralRate,
      minimumWithdrawal: { ...referral.minimumWithdrawal },
      pendingPeriod: referral.pendingPeriod,
      maxDailyReferralRewards: referral.maxDailyReferralRewards,
      maxDailyWithdrawals: referral.maxDailyWithdrawals,
      fraudReviewEnabled: referral.fraudReviewEnabled
    }
  };
}

export async function initializeApprovedSystemSettings({
  SettingsModel = SystemSettings,
  approvedSettings,
  env = process.env
} = {}) {
  resolvePrelaunchTarget(env);
  if (env.PRELAUNCH_SYSTEM_SETTINGS_APPROVED !== "YES") {
    throw new Error("PRELAUNCH_SYSTEM_SETTINGS_APPROVED=YES is required.");
  }
  const settings = validateApprovedSystemSettings(approvedSettings);
  const existing = await SettingsModel.findOne({});
  if (existing) {
    throw new Error("System settings already exist; refusing to modify an existing settings document.");
  }

  await SettingsModel.createIndexes();
  let result;
  try {
    result = await SettingsModel.updateOne(
      { singletonKey: "global" },
      { $setOnInsert: settings },
      { upsert: true, setDefaultsOnInsert: false, runValidators: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    throw new Error("Concurrent system-settings initialization won; no settings were changed.");
  }

  if (result.upsertedCount !== 1) {
    throw new Error("System settings were initialized concurrently; refusing to modify the existing document.");
  }
  return SettingsModel.findOne({ singletonKey: "global" });
}

async function readApprovedSettingsFile(env) {
  const requestedPath = typeof env.PRELAUNCH_SYSTEM_SETTINGS_FILE === "string"
    ? env.PRELAUNCH_SYSTEM_SETTINGS_FILE.trim()
    : "";
  if (!requestedPath) throw new Error("PRELAUNCH_SYSTEM_SETTINGS_FILE is required.");

  const settingsPath = path.resolve(requestedPath);
  const relativeToProject = path.relative(PROJECT_ROOT, settingsPath);
  if (relativeToProject === "" || (!relativeToProject.startsWith(`..${path.sep}`) && relativeToProject !== ".." && !path.isAbsolute(relativeToProject))) {
    throw new Error("Approved settings file must be stored outside the project.");
  }

  let contents;
  try {
    contents = await fs.readFile(settingsPath, "utf8");
  } catch {
    throw new Error("Approved settings file could not be read.");
  }
  try {
    return JSON.parse(contents);
  } catch {
    throw new Error("Approved settings file is not valid JSON.");
  }
}

export async function run(env = process.env) {
  resolvePrelaunchTarget(env);
  if (env.PRELAUNCH_SYSTEM_SETTINGS_APPROVED !== "YES") {
    throw new Error("PRELAUNCH_SYSTEM_SETTINGS_APPROVED=YES is required.");
  }
  const approvedSettings = await readApprovedSettingsFile(env);
  await connectPrelaunchDatabase(env);
  try {
    const settings = await initializeApprovedSystemSettings({ approvedSettings, env });
    console.log(`Approved system settings initialized for ${settings.singletonKey}.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().catch((error) => {
    console.error("System-settings initialization failed.", safeErrorSummary(error));
    process.exitCode = 1;
  });
}
