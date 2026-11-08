import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Ad from "../src/models/Ad.js";
import Category from "../src/models/Category.js";
import CategoryAttribute from "../src/models/CategoryAttribute.js";
import ListingAttributeValue from "../src/models/ListingAttributeValue.js";
import categoryAttributesRouter from "../src/routes/categoryAttributes.js";
import ListingService from "../src/services/listingService.js";

test("listing attribute batch lookup groups populated values by listing", async () => {
  const originalFind = ListingAttributeValue.find;
  const originalAdFind = Ad.find;
  let capturedFilter;
  const rows = [
    { listingId: "car-one", attributeId: { name: "brand", label: "الماركة", categoryId: "cars" }, value: "Toyota" },
    { listingId: "car-one", attributeId: { name: "year", label: "سنة الصنع", categoryId: "cars" }, value: 2020 },
    { listingId: "car-two", attributeId: null, value: "legacy value" }
  ];
  ListingAttributeValue.find = (filter) => {
    capturedFilter = filter;
    return {
      populate() { return this; },
      lean: async () => rows
    };
  };
  Ad.find = () => ({ select() { return this; }, lean: async () => [
    { _id: "car-one", categoryId: "cars" },
    { _id: "car-two", categoryId: "electronics" }
  ] });

  try {
    const grouped = await ListingService.getListingAttributesForListings(["car-one", "car-two"]);
    assert.deepEqual(capturedFilter, { listingId: { $in: ["car-one", "car-two"] } });
    assert.equal(grouped["car-one"].length, 2);
    assert.equal(grouped["car-one"][0].attributeId.name, "brand");
    assert.equal(grouped["car-two"], undefined);
    assert.deepEqual(await ListingService.getListingAttributesForListings([]), {});
  } finally {
    ListingAttributeValue.find = originalFind;
    Ad.find = originalAdFind;
  }
});

test("strict store attribute saves accept only attributes owned by the selected category", async () => {
  const originals = {
    adFindById: Ad.findById,
    categoryFindById: Category.findById,
    categoryAttributeFind: CategoryAttribute.find,
    valueDeleteMany: ListingAttributeValue.deleteMany,
    valueInsertMany: ListingAttributeValue.insertMany
  };
  const currentCategoryAttributes = [
    { _id: "brand-id", categoryId: "current-category", name: "brand", label: "الماركة", type: "text", required: true },
    { _id: "model-id", categoryId: "current-category", name: "model", label: "الموديل", type: "text", required: true },
    { _id: "year-id", categoryId: "current-category", name: "year", label: "السنة", type: "number", required: true, validation: { min: 1950, max: 2026 } },
    { _id: "mileage-id", categoryId: "current-category", name: "mileage", label: "العداد", type: "number", required: true },
    { _id: "fuel-id", categoryId: "current-category", name: "fuel", label: "الوقود", type: "select", options: ["بنزين", "ديزل"], required: true }
  ];
  const insertedDocuments = [];
  const deletedFilters = [];
  Ad.findById = () => ({ lean: async () => ({ categoryId: "current-category" }) });
  Category.findById = () => ({ lean: async () => ({ _id: "current-category", parentId: null }) });
  CategoryAttribute.find = (filter) => ({
    lean: async () => filter.categoryId === "current-category" ? currentCategoryAttributes : []
  });
  ListingAttributeValue.deleteMany = async (filter) => { deletedFilters.push(filter); return { deletedCount: 0 }; };
  ListingAttributeValue.insertMany = async (documents) => { insertedDocuments.push(...documents); return documents; };

  try {
    const carValues = [
      { attributeId: "brand-id", value: "Toyota" },
      { attributeId: "model-id", value: "Corolla" },
      { attributeId: "year-id", value: "2020" },
      { attributeId: "mileage-id", value: "45000" },
      { attributeId: "fuel-id", value: "بنزين" }
    ];
    await ListingService.saveAttributeValues("listing-id", carValues, { strictCategory: true });
    assert.deepEqual(insertedDocuments.map(({ attributeId, value }) => [attributeId, value]), [
      ["brand-id", "Toyota"], ["model-id", "Corolla"], ["year-id", "2020"], ["mileage-id", "45000"], ["fuel-id", "بنزين"]
    ]);
    await ListingService.saveAttributeValues("listing-id", carValues.map((entry) => entry.attributeId === "brand-id" ? { ...entry, value: "Nissan" } : entry), { strictCategory: true });
    assert.equal(insertedDocuments[5].value, "Nissan");
    assert.ok(deletedFilters.some((filter) => filter.attributeId.$in.includes("brand-id")));
    await assert.rejects(
      ListingService.saveAttributeValues("listing-id", [{ attributeId: "other-category-attribute", value: "value" }], { strictCategory: true }),
      /does not belong to the selected category/
    );
    await assert.rejects(
      ListingService.saveAttributeValues("listing-id", [], { strictCategory: true }),
      /is required/
    );
  } finally {
    Ad.findById = originals.adFindById;
    Category.findById = originals.categoryFindById;
    CategoryAttribute.find = originals.categoryAttributeFind;
    ListingAttributeValue.deleteMany = originals.valueDeleteMany;
    ListingAttributeValue.insertMany = originals.valueInsertMany;
  }
});

test("category attributes API returns only the selected category's definitions", async () => {
  const originalCategoryFindById = Category.findById;
  const originalAttributeFind = CategoryAttribute.find;
  const categories = {
    "cars-id": [{ _id: "car-brand", categoryId: "cars-id", name: "brand", label: "الماركة", type: "text" }],
    "electronics-id": [{ _id: "phone-screen", categoryId: "electronics-id", name: "screen_size", label: "حجم الشاشة", type: "number" }],
    "furniture-id": []
  };
  let capturedFilter;
  Category.findById = (id) => ({ lean: async () => ({ _id: String(id) }) });
  CategoryAttribute.find = (filter) => {
    capturedFilter = filter;
    return { sort() { return this; }, lean: async () => categories[filter.categoryId] || [] };
  };

  try {
    const route = categoryAttributesRouter.stack.find((layer) => layer.route?.path === "/category/:categoryId" && layer.route.methods.get);
    const handler = route.route.stack.at(-1).handle;
    const response = { statusCode: 200, body: null };
    const res = { status(code) { response.statusCode = code; return this; }, json(body) { response.body = body; return this; } };
    for (const categoryId of Object.keys(categories)) {
      await handler({ params: { categoryId }, query: {} }, res);
      assert.deepEqual(capturedFilter, { categoryId });
      assert.deepEqual(response.body.map((attribute) => attribute.name), categories[categoryId].map((attribute) => attribute.name));
    }
    assert.deepEqual(response.body, []);
  } finally {
    Category.findById = originalCategoryFindById;
    CategoryAttribute.find = originalAttributeFind;
  }
});

test("store detail reads exclude previous-category attributes while public ad writes retain legacy rules", async () => {
  const originalValueFind = ListingAttributeValue.find;
  const originalAttributeFind = CategoryAttribute.find;
  const originalAdFindById = Ad.findById;
  const originalCategoryFindById = Category.findById;
  const originalValueDeleteMany = ListingAttributeValue.deleteMany;
  const originalValueInsertMany = ListingAttributeValue.insertMany;
  const rows = [
    { listingId: "listing-id", attributeId: { _id: "cars-brand", categoryId: "cars", label: "الماركة", sortOrder: 1 }, value: "Toyota" },
    { listingId: "listing-id", attributeId: { _id: "old-size", categoryId: "furniture", label: "الحجم", sortOrder: 1 }, value: "كبير" }
  ];
  ListingAttributeValue.find = () => ({ populate() { return this; }, lean: async () => rows });

  try {
    const details = await ListingService.getListingAttributes("listing-id", { categoryId: "cars", strictCategory: true });
    assert.deepEqual(details.map((entry) => entry.value), ["Toyota"]);

    Ad.findById = () => ({ lean: async () => ({ categoryId: "cars" }) });
    Category.findById = () => ({ lean: async () => ({ _id: "cars", parentId: null }) });
    CategoryAttribute.find = () => ({ lean: async () => [{ _id: "marketplace-attribute", categoryId: "cars", name: "brand", label: "الماركة", type: "text" }] });
    ListingAttributeValue.deleteMany = async () => ({ deletedCount: 0 });
    ListingAttributeValue.insertMany = async (documents) => documents;
    const publicSaved = await ListingService.saveAttributeValues("listing-id", [{ attributeId: "marketplace-attribute", value: "Honda" }]);
    assert.equal(publicSaved[0].value, "Honda");
  } finally {
    ListingAttributeValue.find = originalValueFind;
    CategoryAttribute.find = originalAttributeFind;
    Ad.findById = originalAdFindById;
    Category.findById = originalCategoryFindById;
    ListingAttributeValue.deleteMany = originalValueDeleteMany;
    ListingAttributeValue.insertMany = originalValueInsertMany;
  }
});

test("store product patch only rewrites attributes when the client sends the attributes field explicitly", () => {
  const source = fs.readFileSync("src/routes/ads.js", "utf8");
  assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(req\.body\s*\|\|\s*\{\}\s*,\s*["']attributes["']\)|hasOwnProperty\.call\(req\.body.*attributes/i);
  assert.match(source, /saveAttributeValues\(ad\._id,\s*Array\.isArray\(attributes\)\s*\?\s*attributes\s*:\s*\[\]\s*,\s*\{\s*strictCategory:\s*true\s*\}\)/i);
});