import ListingAttributeValue from "../models/ListingAttributeValue.js";
import CategoryAttribute from "../models/CategoryAttribute.js";
import Ad from "../models/Ad.js";

class ListingService {
  /**
   * Get attributes for a listing with their values
   */
  static async getListingAttributes(listingId) {
    const values = await ListingAttributeValue.find({ listingId })
      .populate("attributeId", "name label type options")
      .lean();

    return values.map((v) => ({
      ...v,
      attributeId: v.attributeId || { name: "", label: "" },
    }));
  }

  /**
   * Get attributes for a category (for listing creation form)
   */
  static async getCategoryAttributes(categoryId) {
    return CategoryAttribute.find({ categoryId })
      .sort({ sortOrder: 1 })
      .lean();
  }

  /**
   * Save attribute values for a listing
   * This replaces existing values for the given attributes
   */
  static async saveAttributeValues(listingId, attributes) {
    if (!Array.isArray(attributes) || attributes.length === 0) {
      return [];
    }

    const listing = await Ad.findById(listingId).lean();
    if (!listing || !listing.categoryId) {
      throw new Error("Listing or category not found");
    }

    const categoryId = listing.categoryId.toString();
    const attrIds = attributes.map((a) => a.attributeId).filter(Boolean);

    const Category = (await import("../models/Category.js")).default;
    const startCategory = await Category.findById(categoryId).lean();
    const chainIds = [];
    let current = startCategory;
    while (current) {
      chainIds.push(String(current._id));
      if (!current.parentId) break;
      current = await Category.findById(current.parentId).lean();
    }

    const validAttrs = await CategoryAttribute.find({
      _id: { $in: attrIds },
      categoryId: { $in: chainIds },
    }).lean();

    const validAttrIds = new Set(validAttrs.map((a) => String(a._id)));

    // Filter only valid attributes
    const docs = attributes
      .filter(
        (a) =>
          validAttrIds.has(String(a.attributeId)) &&
          typeof a.value !== "undefined" &&
          a.value !== null &&
          a.value !== ""
      )
      .map((a) => ({
        listingId,
        attributeId: a.attributeId,
        value: Array.isArray(a.value) ? a.value.join(",") : String(a.value),
      }));

    if (docs.length === 0) {
      return [];
    }

    // Delete existing values for these attributes
    await ListingAttributeValue.deleteMany({
      listingId,
      attributeId: { $in: docs.map((d) => d.attributeId) },
    });

    // Insert new values
    const result = await ListingAttributeValue.insertMany(docs);
    return result;
  }

  /**
   * Delete all attribute values for a listing
   */
  static async deleteAttributeValues(listingId) {
    await ListingAttributeValue.deleteMany({ listingId });
  }

  /**
   * Copy attribute values when listing is moved to new category
   * (Only copies attributes that exist in both categories)
   */
  static async copyAttributesOnCategoryChange(
    listingId,
    oldCategoryId,
    newCategoryId
  ) {
    // Get old values
    const oldValues = await ListingAttributeValue.find({ listingId }).lean();

    if (oldValues.length === 0) return;

    // Get attributes in new category with matching names
    const newCategoryAttrs = await CategoryAttribute.find({
      categoryId: newCategoryId,
    }).lean();

    const newAttrMap = new Map(
      newCategoryAttrs.map((a) => [a.name, a._id.toString()])
    );

    // Find matching attributes by name
    const valuesToKeep = [];
    for (const oldValue of oldValues) {
      const oldAttr = await CategoryAttribute.findById(oldValue.attributeId).lean();
      if (oldAttr && newAttrMap.has(oldAttr.name)) {
        valuesToKeep.push({
          listingId,
          attributeId: newAttrMap.get(oldAttr.name),
          value: oldValue.value,
        });
      }
    }

    // Delete old values and insert new ones
    await ListingAttributeValue.deleteMany({ listingId });
    if (valuesToKeep.length > 0) {
      await ListingAttributeValue.insertMany(valuesToKeep);
    }
  }

  /**
   * Get listings by category (includes subcategories)
   */
  static async getListingsByCategory(categoryId, options = {}) {
    const { status = "approved", page = 1, limit = 20, sort = "new" } = options;

    // Get child category IDs
    const Category = (await import("../models/Category.js")).default;
    const childIds = await Category.find({ parentId: categoryId })
      .select("_id")
      .lean();
    const allCategoryIds = [categoryId, ...childIds.map((c) => String(c._id))];

    const filter = {
      categoryId: { $in: allCategoryIds },
      status,
      isArchived: { $ne: true },
      sold: { $ne: true },
    };

    let sortSpec = { featured: -1, createdAt: -1 };
    if (sort === "price_asc") sortSpec = { price: 1, createdAt: -1 };
    else if (sort === "price_desc") sortSpec = { price: -1, createdAt: -1 };
    else if (sort === "old") sortSpec = { featured: -1, createdAt: 1 };
    else if (sort === "views") sortSpec = { viewCount: -1, createdAt: -1 };

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [list, total] = await Promise.all([
      Ad.find(filter)
        .populate("governorateId", "name")
        .populate("cityId", "name")
        .sort(sortSpec)
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      Ad.countDocuments(filter),
    ]);

    return {
      items: list,
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l),
    };
  }
}

export default ListingService;
