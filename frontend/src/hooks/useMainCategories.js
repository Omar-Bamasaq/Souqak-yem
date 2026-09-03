import { useQuery } from "@tanstack/react-query";
import { useApi } from "../api/axios.js";

const MAIN_CATEGORIES_STALE_TIME = 1000 * 60 * 5;

export function useMainCategories(adType = null, options = {}) {
  const api = useApi();

  return useQuery({
    queryKey: ["main-categories", adType],
    queryFn: async () => {
      const res = await api.get("/categories/main", {
        params: adType ? { adType } : undefined
      });
      return res.data || [];
    },
    staleTime: MAIN_CATEGORIES_STALE_TIME,
    ...options,
  });
}
