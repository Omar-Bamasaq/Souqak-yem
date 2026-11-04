import Governorate from "../models/Governorate.js";
import City from "../models/City.js";

export async function ensureOtherCities() {
  const governorates = await Governorate.find({}).select("_id").lean();

  await Promise.all(
    governorates.map(async ({ _id: governorateId }) => {
      const existing = await City.findOne({ governorateId, name: "أخرى" });
      if (existing) {
        if (!existing.isDefault) {
          await City.updateOne({ _id: existing._id }, { $set: { isDefault: true } });
        }
        return;
      }

      await City.create({ name: "أخرى", governorateId, isDefault: true, isActive: true });
    })
  );
}

export function sortCitiesWithOtherLast(cities) {
  return [...cities].sort((a, b) => {
    const aIsOther = a.name === "أخرى";
    const bIsOther = b.name === "أخرى";
    if (aIsOther !== bIsOther) return aIsOther ? 1 : -1;
    return String(a.name || "").localeCompare(String(b.name || ""), "ar");
  });
}