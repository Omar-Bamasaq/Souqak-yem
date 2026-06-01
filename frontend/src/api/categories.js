import { useMemo } from "react";
import { useApi } from "./axios.js";

export function useCategoryApi() {
  const api = useApi();

  return useMemo(() => ({
    getCategories: (params = {}) => api.get("/categories", { params }),
    getMainCategories: (adType = null) => api.get("/categories/main", { params: { adType } }),
    getCategoryChildren: (id, adType = null) => api.get(`/categories/${id}/children`, { params: { adType } }),
    getCategoryTree: () => api.get("/categories/tree"),
    getCategoryStats: () => api.get("/categories/stats"),
    getCategoryBySlug: (slug, adType = null) => api.get(`/categories/${slug}`, { params: { adType } }),
    getBreadcrumbs: (id) => api.get(`/categories/breadcrumbs/${id}`),
    createCategory: (data) => {
      if (data instanceof FormData) {
        return api.post("/categories", data);
      }
      return api.post("/categories", data);
    },
    updateCategory: (id, data) => {
      if (data instanceof FormData) {
        return api.put(`/categories/${id}`, data);
      }
      return api.put(`/categories/${id}`, data);
    },
    deleteCategory: (id, data) => api.delete(`/categories/${id}`, { data }),
    moveAds: (id, targetCategoryId) => api.post(`/categories/${id}/move-ads`, { targetCategoryId }),
    reorderCategories: (categories) => api.post("/categories/reorder", { categories }),
    refreshStats: () => api.post("/categories/refresh-stats"),
  }), [api]);
}
