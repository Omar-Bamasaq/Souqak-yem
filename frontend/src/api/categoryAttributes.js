import { useMemo } from "react";
import { useApi } from "./axios.js";

export function useCategoryAttributeApi() {
  const api = useApi();

  return useMemo(() => ({
    // Get all attributes (admin) or by category
    getAttributes: (params = {}) => api.get("/category-attributes", { params }),
    
    // Get attributes for a specific category
    getCategoryAttributes: (categoryId, params = {}) => 
      api.get(`/category-attributes/category/${categoryId}`, { params }),
    
    // Get single attribute
    getAttribute: (id) => api.get(`/category-attributes/${id}`),
    
    // Create new attribute (admin only)
    createAttribute: (data) => api.post("/category-attributes", data),
    
    // Update attribute (admin only)
    updateAttribute: (id, data) => api.put(`/category-attributes/${id}`, data),
    
    // Delete attribute (admin only)
    deleteAttribute: (id) => api.delete(`/category-attributes/${id}`),
    
    // Reorder attributes (admin only)
    reorderAttributes: (attributes) => api.post("/category-attributes/reorder", { attributes }),
    
    // Copy attributes from one category to another (admin only)
    copyAttributes: (sourceCategoryId, targetCategoryId) => 
      api.post("/category-attributes/copy", { sourceCategoryId, targetCategoryId }),
  }), [api]);
}
