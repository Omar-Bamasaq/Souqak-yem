import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import path from "node:path";
import walletServicesRouter from "../src/routes/walletServices.js";
import DigitalServiceCategory from "../src/models/DigitalServiceCategory.js";
import DraftAction from "../src/models/DraftAction.js";
import WalletService from "../src/models/WalletService.js";
import WalletServiceOrder from "../src/models/WalletServiceOrder.js";

const admin = { id: new mongoose.Types.ObjectId().toString(), role: "admin" };

function routeHandler(method, routePath) {
  const route = walletServicesRouter.stack.find((layer) =>
    layer.route?.path === routePath && layer.route.methods[method]
  );
  assert.ok(route, `Expected ${method.toUpperCase()} ${routePath} to exist`);
  return route.route.stack.at(-1).handle;
}

async function invoke(handler, request) {
  const result = { statusCode: 200, body: null };
  const response = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };
  await handler(request, response);
  return result;
}

test("admin category creation normalizes slugs and rejects duplicate slugs", async () => {
  const originalCreate = DigitalServiceCategory.create;
  const categories = new Map();
  DigitalServiceCategory.create = async (data) => {
    if (categories.has(data.slug)) throw Object.assign(new Error("duplicate slug"), { code: 11000 });
    const category = { _id: new mongoose.Types.ObjectId().toString(), ...data };
    categories.set(data.slug, category);
    return category;
  };
  try {
    const create = routeHandler("post", "/admin/categories");
    const first = await invoke(create, {
      user: admin,
      body: { name: "أدوات الذكاء الاصطناعي", slug: " AI-TOOLS " }
    });
    assert.equal(first.statusCode, 201);
    assert.equal(first.body.slug, "ai-tools");

    const duplicate = await invoke(create, {
      user: admin,
      body: { name: "أدوات أخرى", slug: "ai-tools" }
    });
    assert.equal(duplicate.statusCode, 409);

    const injected = await invoke(create, {
      user: admin,
      body: { name: "خدمة", slug: "other", isArchived: true }
    });
    assert.equal(injected.statusCode, 400);
  } finally {
    DigitalServiceCategory.create = originalCreate;
  }
});

test("admin category image uploads store WebP paths and metadata-only edits retain the image", async () => {
  const originals = {
    categoryCreate: DigitalServiceCategory.create,
    categoryFindById: DigitalServiceCategory.findById
  };
  const savedCategories = [];
  const categoryId = new mongoose.Types.ObjectId().toString();
  const category = {
    _id: categoryId,
    name: "تصنيف",
    slug: "category",
    description: "",
    image: "/uploads/logos/previous.webp",
    sortOrder: 0,
    isActive: true,
    isArchived: false,
    toObject() {
      return {
        name: this.name,
        slug: this.slug,
        description: this.description,
        image: this.image,
        sortOrder: this.sortOrder,
        isActive: this.isActive,
        isArchived: this.isArchived
      };
    },
    async save() {
      savedCategories.push(this.image);
    }
  };
  DigitalServiceCategory.create = async (data) => ({ _id: categoryId, ...data });
  DigitalServiceCategory.findById = async () => category;

  try {
    const createRoute = walletServicesRouter.stack.find((layer) =>
      layer.route?.path === "/admin/categories" && layer.route.methods.post
    );
    const uploadMiddleware = createRoute.route.stack.at(-2).handle;
    assert.equal(uploadMiddleware.uploadMethod, "single");
    assert.equal(uploadMiddleware.uploadField, "image");
    assert.equal(uploadMiddleware.producesPublicVariants, true);

    const created = await invoke(routeHandler("post", "/admin/categories"), {
      user: admin,
      body: { name: "تصنيف جديد", slug: "new-category", image: "/uploads/not-a-webp.jpg" },
      file: {
        filename: "public-category-test.webp",
        path: path.join(process.cwd(), "uploads", "logos", "public-category-test.webp")
      }
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.image, "/uploads/logos/public-category-test.webp");

    const update = routeHandler("patch", "/admin/categories/:id");
    const replaced = await invoke(update, {
      user: admin,
      params: { id: categoryId },
      body: { name: "تصنيف محدث", slug: "category" },
      file: {
        filename: "public-category-updated.webp",
        path: path.join(process.cwd(), "uploads", "logos", "public-category-updated.webp")
      }
    });
    assert.equal(replaced.body.image, "/uploads/logos/public-category-updated.webp");

    const metadataOnly = await invoke(update, {
      user: admin,
      params: { id: categoryId },
      body: { name: "تصنيف محدث مرة أخرى" }
    });
    assert.equal(metadataOnly.body.image, "/uploads/logos/public-category-updated.webp");
    assert.deepEqual(savedCategories, [
      "/uploads/logos/public-category-updated.webp",
      "/uploads/logos/public-category-updated.webp"
    ]);
  } finally {
    DigitalServiceCategory.create = originals.categoryCreate;
    DigitalServiceCategory.findById = originals.categoryFindById;
  }
});

test("admin category deletion requires archival and blocks categories referenced by services or orders", async () => {
  const originals = {
    findById: DigitalServiceCategory.findById,
    findOneAndDelete: DigitalServiceCategory.findOneAndDelete,
    serviceCount: WalletService.countDocuments,
    orderCount: WalletServiceOrder.countDocuments
  };
  const categoryId = new mongoose.Types.ObjectId().toString();
  const category = { _id: categoryId, isArchived: false, isActive: false };
  let serviceCount = 1;
  let orderCount = 0;
  let deleted = false;
  DigitalServiceCategory.findById = async () => category;
  DigitalServiceCategory.findOneAndDelete = async () => {
    deleted = true;
    return category;
  };
  WalletService.countDocuments = async () => serviceCount;
  WalletServiceOrder.countDocuments = async () => orderCount;

  try {
    const remove = routeHandler("delete", "/admin/categories/:id");
    const request = { user: admin, params: { id: categoryId } };
    assert.equal((await invoke(remove, request)).statusCode, 409);

    category.isArchived = true;
    assert.equal((await invoke(remove, request)).statusCode, 409);
    assert.equal(deleted, false);

    serviceCount = 0;
    orderCount = 1;
    assert.equal((await invoke(remove, request)).statusCode, 409);
    assert.equal(deleted, false);

    orderCount = 0;
    const result = await invoke(remove, request);
    assert.equal(result.statusCode, 200);
    assert.equal(deleted, true);
  } finally {
    DigitalServiceCategory.findById = originals.findById;
    DigitalServiceCategory.findOneAndDelete = originals.findOneAndDelete;
    WalletService.countDocuments = originals.serviceCount;
    WalletServiceOrder.countDocuments = originals.orderCount;
  }
});

test("admin service deletion requires archival and preserves services referenced by orders or drafts", async () => {
  const originals = {
    findById: WalletService.findById,
    findOneAndDelete: WalletService.findOneAndDelete,
    orderCount: WalletServiceOrder.countDocuments,
    draftCount: DraftAction.countDocuments
  };
  const serviceId = new mongoose.Types.ObjectId().toString();
  const service = { _id: serviceId, isArchived: false, isActive: false };
  let orderCount = 1;
  let draftCount = 0;
  let deleted = false;
  WalletService.findById = async () => service;
  WalletService.findOneAndDelete = async () => {
    deleted = true;
    return service;
  };
  WalletServiceOrder.countDocuments = async () => orderCount;
  DraftAction.countDocuments = async () => draftCount;

  try {
    const remove = routeHandler("delete", "/admin/services/:id");
    const request = { user: admin, params: { id: serviceId } };
    assert.equal((await invoke(remove, request)).statusCode, 409);

    service.isArchived = true;
    assert.equal((await invoke(remove, request)).statusCode, 409);
    assert.equal(deleted, false);

    orderCount = 0;
    draftCount = 1;
    assert.equal((await invoke(remove, request)).statusCode, 409);
    assert.equal(deleted, false);

    draftCount = 0;
    const result = await invoke(remove, request);
    assert.equal(result.statusCode, 200);
    assert.equal(deleted, true);
  } finally {
    WalletService.findById = originals.findById;
    WalletService.findOneAndDelete = originals.findOneAndDelete;
    WalletServiceOrder.countDocuments = originals.orderCount;
    DraftAction.countDocuments = originals.draftCount;
  }
});

test("admin service creation validates and returns category, packages, and dynamic form definitions", async () => {
  const originals = {
    categoryFindOne: DigitalServiceCategory.findOne,
    serviceCreate: WalletService.create
  };
  const categoryId = new mongoose.Types.ObjectId().toString();
  DigitalServiceCategory.findOne = (query) => ({
    lean: async () => query._id === categoryId && query.isActive
      ? { _id: categoryId, name: "أدوات الذكاء الاصطناعي" }
      : null
  });
  WalletService.create = async (data) => ({
    _id: new mongoose.Types.ObjectId().toString(),
    ...data,
    toObject() { return { ...data, _id: this._id }; }
  });

  try {
    const result = await invoke(routeHandler("post", "/admin/services"), {
      user: admin,
      body: {
        name: "اشتراك مساعد ذكي",
        categoryId,
        serviceType: "AI_TOOL",
        pricingType: "PACKAGE",
        currency: "USD",
        unitLabel: "اشتراك",
        sections: [],
        packages: [{ id: "monthly", name: "شهري", price: 8, currency: "USD" }],
        formSchema: [{ id: "email", label: "البريد", type: "EMAIL", required: true }]
      }
    });
    assert.equal(result.statusCode, 201);
    assert.equal(result.body.serviceVersion, 1);
    assert.equal(result.body.categoryId, categoryId);
    assert.equal(result.body.formSchema[0].type, "EMAIL");
    assert.equal(result.body.packages[0].id, "monthly");
    assert.deepEqual(result.body.versionHistory, []);
  } finally {
    DigitalServiceCategory.findOne = originals.categoryFindOne;
    WalletService.create = originals.serviceCreate;
  }
});
