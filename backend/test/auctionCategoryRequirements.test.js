import test from "node:test";
import assert from "node:assert/strict";
import Category from "../src/models/Category.js";
import { evaluateAuctionPublication } from "../src/services/auctionPublicationEligibility.js";
import {
  getAuctionCategoryRequirementsForCategory,
  resolveAuctionCategoryRequirements
} from "../src/services/auctionCategoryRequirements.js";

const CATEGORY_ID = "111111111111111111111111";

function categoryQuery(category) {
  let projection = "";
  const query = {
    setOptions() {
      return this;
    },
    select(value) {
      projection = value;
      return this;
    },
    async lean() {
      if (!category) return null;
      return Object.fromEntries(
        projection.split(/\s+/).filter(Boolean)
          .map((field) => [field, category[field]])
          .filter(([, value]) => value !== undefined)
      );
    }
  };
  return {
    query,
    get projection() {
      return projection;
    }
  };
}

test("category requirements require an existing active category with a slug", () => {
  const supported = getAuctionCategoryRequirementsForCategory({
    _id: CATEGORY_ID,
    slug: "mobiles",
    status: "active"
  });
  assert.equal(supported.category.slug, "mobiles");
  assert.equal(supported.requirements.supported, true);

  assert.equal(getAuctionCategoryRequirementsForCategory({
    _id: CATEGORY_ID,
    slug: "mobiles",
    status: "inactive"
  }), null);
  assert.equal(getAuctionCategoryRequirementsForCategory(null), null);
  assert.equal(getAuctionCategoryRequirementsForCategory({
    _id: CATEGORY_ID,
    slug: "mobiles"
  }), null);
});

test("category resolver projects status and eligible auctions remain publishable", async () => {
  const now = new Date("2026-11-26T12:00:00.000Z");
  const category = { _id: CATEGORY_ID, slug: "mobiles", status: "active" };
  const builtQuery = categoryQuery(category);
  const originalFindOne = Category.findOne;
  Category.findOne = (filter) => {
    assert.deepEqual(filter, { _id: CATEGORY_ID, status: "active" });
    return builtQuery.query;
  };

  try {
    const resolved = await resolveAuctionCategoryRequirements(CATEGORY_ID);
    assert.equal(builtQuery.projection, "_id slug status");
    assert.equal(resolved.category.status, "active");
    assert.equal(resolved.requirements.supported, true);

    const result = await evaluateAuctionPublication({
      reviewStatus: "approved",
      approvedAt: new Date(now.getTime() - 60_000),
      approvedBy: "synthetic-admin",
      status: "live",
      startAt: new Date(now.getTime() - 60_000),
      endAt: new Date(now.getTime() + 60_000),
      durationDays: 4,
      ownerId: "synthetic-owner",
      categoryId: CATEGORY_ID,
      categoryDetails: {
        manufacturer: "Synthetic",
        model: "Phone",
        storage: "128 GB",
        deviceCondition: "Good"
      },
      imageLabels: ["actual_item"],
      categoryDocuments: []
    }, now, {
      loadOwner: async () => ({
        verificationStatus: "verified",
        verificationExpiryDate: new Date(now.getTime() + 60_000),
        isDisabled: false,
        isDeleted: false
      })
    });

    assert.deepEqual(result, { eligible: true, reasons: [] });
  } finally {
    Category.findOne = originalFindOne;
  }
});

test("a missing category is not resolved as eligible", async () => {
  const originalFindOne = Category.findOne;
  Category.findOne = () => categoryQuery(null).query;
  try {
    assert.equal(await resolveAuctionCategoryRequirements(CATEGORY_ID), null);
  } finally {
    Category.findOne = originalFindOne;
  }
});
