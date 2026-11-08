import ListingAttributeValue from "../models/ListingAttributeValue.js";
import CategoryAttribute from "../models/CategoryAttribute.js";
import Ad from "../models/Ad.js";

class ListingService {
  /**
   * Get attributes for a listing with their values
   */
  static async getListingAttributes(listingId, { categoryId, strictCategory = false } = {}) {
    const values = await ListingAttributeValue.find({ listingId })
      .populate("attributeId", "name label type options categoryId sortOrder")
      .lean();

    return values
      .filter((value) => !strictCategory || String(value.attributeId?.categoryId) === String(categoryId))
      .sort((first, second) => (first.attributeId?.sortOrder || 0) - (second.attributeId?.sortOrder || 0))
      .map((v) => ({
      ...v,
      attributeId: v.attributeId || { name: "", label: "" },
      }));
  }

  static async getListingAttributesForListings(listingIds) {
    const ids = Array.isArray(listingIds) ? listingIds.filter(Boolean) : [];
    if (ids.length === 0) return {};

    const values = await ListingAttributeValue.find({ listingId: { $in: ids } })
      .populate("attributeId", "name label type categoryId sortOrder")
      .lean();
    const listings = await Ad.find({ _id: { $in: ids } }).select("_id categoryId").lean();
    const categoryByListing = new Map(listings.map((listing) => [String(listing._id), String(listing.categoryId || "")]));
    const grouped = {};

    for (const value of values) {
      const listingId = String(value.listingId);
      if (String(value.attributeId?.categoryId) !== categoryByListing.get(listingId)) continue;
      if (!grouped[listingId]) grouped[listingId] = [];
      grouped[listingId].push({
        ...value,
        attributeId: value.attributeId || { name: "", label: "" }
      });
    }

    for (const listingValues of Object.values(grouped)) {
      listingValues.sort((first, second) => (first.attributeId?.sortOrder || 0) - (second.attributeId?.sortOrder || 0));
    }

    return grouped;
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
  static async saveAttributeValues(listingId, attributes, { strictCategory = false } = {}) {
    if (typeof attributes === "undefined") {
      return [];
    }
    if (!Array.isArray(attributes)) {
      attributes = [];
    }
    if (!strictCategory && attributes.length === 0) {
      return [];
    }

    const listing = await Ad.findById(listingId).lean();
    if (!listing || !listing.categoryId) {
      throw new Error("Listing or category not found");
    }

    const categoryId = listing.categoryId.toString();
    const submittedAttributes = Array.isArray(attributes) ? attributes : [];
    const attrIds = submittedAttributes.map((a) => a.attributeId).filter(Boolean);

    const Category = (await import("../models/Category.js")).default;
    const startCategory = await Category.findById(categoryId).lean();
    const chainIds = [];
    let current = startCategory;
    while (current) {
      chainIds.push(String(current._id));
      if (!current.parentId) break;
      current = await Category.findById(current.parentId).lean();
    }

    const validAttrs = await CategoryAttribute.find(strictCategory
      ? { categoryId }
      : { _id: { $in: attrIds }, categoryId: { $in: chainIds } }
    ).lean();

    const validAttrIds = new Set(validAttrs.map((a) => String(a._id)));

    if (strictCategory) {
      if (new Set(attrIds.map(String)).size !== attrIds.length || attrIds.some((id) => !validAttrIds.has(String(id)))) {
        throw new Error("An attribute does not belong to the selected category");
      }

      const submittedById = new Map(submittedAttributes.map((attribute) => [String(attribute.attributeId), attribute.value]));
      for (const attribute of validAttrs) {
        const value = submittedById.get(String(attribute._id));
        const isEmpty = value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);
        if (attribute.required && isEmpty) {
          throw new Error(`${attribute.label} is required`);
        }
        if (isEmpty) continue;

        if (attribute.type === "number") {
          const numberValue = Number(value);
          if (!Number.isFinite(numberValue)) throw new Error(`${attribute.label} must be a number`);
          if (attribute.validation?.min != null && numberValue < attribute.validation.min) throw new Error(`${attribute.label} is below the minimum`);
          if (attribute.validation?.max != null && numberValue > attribute.validation.max) throw new Error(`${attribute.label} exceeds the maximum`);
        } else if (attribute.type === "select" || attribute.type === "multiselect") {
          const values = attribute.type === "multiselect"
            ? (Array.isArray(value) ? value : String(value).split(",").map((entry) => entry.trim()).filter(Boolean))
            : [String(value)];
          if (values.some((entry) => !attribute.options?.includes(entry))) {
            throw new Error(`${attribute.label} contains an invalid option`);
          }
        } else if (attribute.type === "boolean" && ![true, false, "true", "false"].includes(value)) {
          throw new Error(`${attribute.label} must be true or false`);
        } else if (attribute.type === "text" && attribute.validation?.pattern) {
          if (!new RegExp(attribute.validation.pattern).test(String(value))) {
            throw new Error(`${attribute.label} has an invalid format`);
          }
        }
      }
    }

    // Filter only valid attributes
    const docs = submittedAttributes
      .filter(
        (a) =>
          validAttrIds.has(String(a.attributeId)) &&
          typeof a.value !== "undefined" &&
          a.value !== null &&
          a.value !== "" &&
          !(Array.isArray(a.value) && a.value.length === 0)
      )
      .map((a) => ({
        listingId,
        attributeId: a.attributeId,
        value: Array.isArray(a.value) ? a.value.join(",") : String(a.value),
      }));

    if (strictCategory) {
      await ListingAttributeValue.deleteMany({
        listingId,
        attributeId: { $in: validAttrs.map((attribute) => attribute._id) },
      });
      if (docs.length === 0) return [];
    } else if (docs.length === 0) {
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

  static async deleteAttributeValuesForCategory(listingId, categoryId) {
    const attributes = await CategoryAttribute.find({ categoryId }).select("_id").lean();
    if (attributes.length === 0) return { deletedCount: 0 };
    return ListingAttributeValue.deleteMany({
      listingId,
      attributeId: { $in: attributes.map((attribute) => attribute._id) },
    });
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

    let sortSpec = { featured: -1, publishedAt: -1, createdAt: -1 };
    if (sort === "price_asc") sortSpec = { featured: -1, price: 1, publishedAt: -1, createdAt: -1 };
    else if (sort === "price_desc") sortSpec = { featured: -1, price: -1, publishedAt: -1, createdAt: -1 };
    else if (sort === "old") sortSpec = { featured: -1, publishedAt: 1, createdAt: 1 };
    else if (sort === "views") sortSpec = { featured: -1, viewCount: -1, publishedAt: -1, createdAt: -1 };

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
