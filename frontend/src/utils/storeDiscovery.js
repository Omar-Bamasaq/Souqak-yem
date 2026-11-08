export function filterStoreAds(ads = [], selectedCategory = 'all', searchText = '') {
  const normalizedCategory = String(selectedCategory || 'all');
  const query = String(searchText || '').trim().toLowerCase();

  return ads.filter((ad) => {
    const categoryValue = ad?.categoryId?._id || ad?.categoryId?.id || ad?.categoryId || null;
    const matchesCategory = normalizedCategory === 'all' || String(categoryValue) === String(normalizedCategory);
    if (!matchesCategory) return false;

    if (!query) return true;

    const title = String(ad?.title || '').toLowerCase();
    return title.includes(query);
  });
}
