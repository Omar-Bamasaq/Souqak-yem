import Category from "../models/Category.js";
import {
  AUCTION_CATEGORY_SLUGS,
  getCategoryAuctionRequirements,
  publicCategoryAuctionRequirements
} from "../config/auctionCategoryRequirements.js";

export function getAuctionCategoryRequirementsForCategory(category) {
  if (!category || category.status !== "active" || !category.slug) return null;
  return {
    category,
    requirements: getCategoryAuctionRequirements([category.slug])
  };
}

export async function resolveAuctionCategoryRequirements(categoryId, {
  maxTimeMS
} = {}) {
  let query = Category.findOne({ _id: categoryId, status: "active" });
  if (Number.isSafeInteger(maxTimeMS) && maxTimeMS > 0) {
    query = query.setOptions({ maxTimeMS, timeoutMS: maxTimeMS });
  }
  const category = await query
    .select("_id slug status")
    .lean();
  return getAuctionCategoryRequirementsForCategory(category);
}

export async function listAuctionCategories() {
  const categories = await Category.find({
    status: "active",
    slug: { $in: AUCTION_CATEGORY_SLUGS }
  })
    .select("_id name slug parentId")
    .lean();
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));
  return AUCTION_CATEGORY_SLUGS
    .map((slug) => categoriesBySlug.get(slug))
    .filter(Boolean)
    .map((category) => ({
      ...category,
      id: category._id,
      requirements: publicCategoryAuctionRequirements(
        getCategoryAuctionRequirements([category.slug])
      )
    }));
}

export { publicCategoryAuctionRequirements };
