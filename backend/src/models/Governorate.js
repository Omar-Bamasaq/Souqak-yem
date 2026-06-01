import mongoose from "mongoose";

const GovernorateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

function baseSlugify(input) {
  const s = String(input || "").trim().toLowerCase();
  const replaced = s.replace(/[\s_]+/g, "-");
  const cleaned = replaced.replace(/[^a-z0-9\u0600-\u06FF\-]+/g, "");
  return cleaned.replace(/\-+/g, "-").replace(/^\-+|\-+$/g, "") || "item";
}

async function ensureUniqueSlug(model, base, excludeId) {
  let candidate = base;
  let idx = 2;
  let exists = await model.exists({ slug: candidate, _id: { $ne: excludeId } });
  if (!exists) return candidate;
  const regex = new RegExp(`^${base}(?:-(\\d+))?$`);
  const rows = await model.find({ slug: { $regex: new RegExp(`^${base}(-\\d+)?$`) }, _id: { $ne: excludeId } }).select("slug").lean();
  const nums = rows
    .map((r) => {
      const m = String(r.slug).match(regex);
      return m && m[1] ? parseInt(m[1], 10) : 1;
    })
    .filter((n) => Number.isFinite(n));
  if (nums.length > 0) idx = Math.max(...nums) + 1;
  candidate = `${base}-${idx}`;
  return candidate;
}

GovernorateSchema.pre("validate", async function (next) {
  if (!this.isModified("name") && this.slug) return next();
  const base = baseSlugify(this.name);
  this.slug = await ensureUniqueSlug(this.constructor, base, this._id);
  next();
});

GovernorateSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() || {};
  const name = update.name;
  if (!name) return next();
  const base = baseSlugify(name);
  const model = this.model;
  const id = this.getQuery()?._id;
  const unique = await ensureUniqueSlug(model, base, id);
  update.slug = unique;
  this.setUpdate(update);
  next();
});

export default mongoose.models.Governorate || mongoose.model("Governorate", GovernorateSchema);
