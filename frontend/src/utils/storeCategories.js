export function getStoreActivityCategoryOptions(categories, activity, selectedCategories = []) {
  const flattened = [];
  const visit = (items) => {
    for (const item of items || []) {
      flattened.push(item);
      if (Array.isArray(item.children)) visit(item.children);
    }
  };
  visit(categories);

  const selectedIds = new Set((selectedCategories || []).map((category) =>
    String(category?._id || category?.id || category)
  ));
  const allowedSlugs = new Set(activity?.allowedCategorySlugs || []);
  return flattened.filter((category) =>
    allowedSlugs.has(category.slug) || selectedIds.has(String(category._id || category.id))
  );
}

export function getStoreCategoriesForActivity(store, activities) {
  const selectedCategories = Array.isArray(store?.selectedCategories) ? store.selectedCategories : [];
  const activity = Array.isArray(activities)
    ? activities.find((item) => item.activityKey === store?.activityKey)
    : null;
  if (!activity) return selectedCategories;

  const allowedSlugs = new Set(activity.allowedCategorySlugs || []);
  return selectedCategories.filter((category) => allowedSlugs.has(category?.slug));
}