import BrokerageConfig from "../models/BrokerageConfig.js";
import AuditEngine from "./AuditEngine.js";

// Default config values (fallbacks)
const DEFAULT_CONFIG = {
  // Security
  "security.min_broker_reputation": 100,
  "security.rate_limit.broker_joins_per_day": 10,
  
  // Rewards
  "rewards.min_fixed_reward": 100,
  "rewards.min_percentage_reward": 1,
  "rewards.max_percentage_reward": 30,
  
  // Campaigns
  "campaigns.default_expiry_days": 30,
  
  // Trust
  "trust.reputation_factor.deal_success": 25,
  "trust.reputation_factor.complaint_resolved_against": -100,
  "trust.reputation_factor.complaint_resolved_for": 10,
  "trust.reputation_factor.compliance": 50,
  "trust.reputation_factor.activity": 5,
  
  // Levels
  "trust.levels.BEGINNER.min_reputation": 0,
  "trust.levels.BEGINNER.min_deals": 0,
  "trust.levels.BRONZE.min_reputation": 200,
  "trust.levels.BRONZE.min_deals": 3,
  "trust.levels.SILVER.min_reputation": 400,
  "trust.levels.SILVER.min_deals": 10,
  "trust.levels.GOLD.min_reputation": 600,
  "trust.levels.GOLD.min_deals": 25,
  "trust.levels.PLATINUM.min_reputation": 800,
  "trust.levels.PLATINUM.min_deals": 50,
  "trust.levels.DIAMOND.min_reputation": 900,
  "trust.levels.DIAMOND.min_deals": 100,
  
  // Fraud
  "fraud.anomaly_detection.threshold": 0.8,
  
  // Retention
  "retention.audit_log_days": 1825, // 5 years
  "retention.archived_data_days": 365,
  
  // Notifications
  "notifications.critical.channels": ["IN_APP", "PUSH"],
  
  // Deals
  "deals.broker_confirm_timeout_hours": 48,
  "deals.buyer_confirm_timeout_hours": 48,
  "deals.min_time_after_join_hours": 4,
  
  // Reviews
  "reviews.min_length": 20,
  "reviews.max_length": 1000,
  "reviews.min_rating": 1,
  "reviews.max_rating": 5
};

export default class ConfigEngine {
  static async initializeDefaults() {
    for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
      const category = this._inferCategory(key);
      const type = this._inferType(defaultValue);
      
      const existing = await BrokerageConfig.findOne({ key });
      if (!existing) {
        await BrokerageConfig.create({
          key,
          category,
          value: defaultValue,
          type,
          description: `Default value for ${key}`,
          updatedBy: null, // TODO: Replace with system user ID
        });
      }
    }
  }

  static async get(key, defaultValue = null) {
    try {
      const config = await BrokerageConfig.findOne({ key });
      if (!config) {
        return DEFAULT_CONFIG[key] ?? defaultValue;
      }
      return config.value;
    } catch (err) {
      console.error(`Failed to get config key "${key}":`, err);
      return DEFAULT_CONFIG[key] ?? defaultValue;
    }
  }

  static async getCategory(category) {
    try {
      const configs = await BrokerageConfig.find({ category });
      const result = {};
      configs.forEach(cfg => {
        result[cfg.key] = cfg.value;
      });
      return result;
    } catch (err) {
      console.error(`Failed to get config category "${category}":`, err);
      return {};
    }
  }

  static async getAll() {
    try {
      const configs = await BrokerageConfig.find({});
      const result = {};
      configs.forEach(cfg => {
        result[cfg.key] = cfg.value;
      });
      return result;
    } catch (err) {
      console.error("Failed to get all configs:", err);
      return {};
    }
  }

  static async update(key, value, updatedBy, description = null) {
    try {
      const existing = await BrokerageConfig.findOne({ key });
      if (!existing) {
        throw new Error(`Config key "${key}" not found`);
      }

      const oldValue = existing.value;
      const oldState = { value: oldValue, version: existing.version };
      const newState = { value, version: existing.version + 1 };

      existing.value = value;
      existing.version += 1;
      existing.previousValue = oldValue;
      existing.updatedBy = updatedBy;
      existing.updatedAt = new Date();
      if (description) existing.description = description;

      await existing.save();

      await AuditEngine.log(
        updatedBy,
        "ADMIN",
        "BrokerageConfig",
        existing._id,
        "CONFIG_UPDATED",
        oldState,
        newState,
        { key }
      );

      return existing;
    } catch (err) {
      console.error(`Failed to update config key "${key}":`, err);
      throw err;
    }
  }

  static _inferCategory(key) {
    for (const prefix of Object.keys(DEFAULT_CONFIG).map(k => k.split(".")[0])) {
      if (key.startsWith(prefix)) {
        return prefix.toUpperCase();
      }
    }
    return "MISCELLANEOUS";
  }

  static _inferType(value) {
    if (typeof value === "number") return "NUMBER";
    if (typeof value === "boolean") return "BOOLEAN";
    if (typeof value === "object") return "JSON";
    return "STRING";
  }
}
