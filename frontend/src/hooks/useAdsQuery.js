
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../api/axios.js";

export function useAdsQuery() {
  const queryClient = useQueryClient();
  const api = useApi();

  const fetchAds = async (params) => {
    const res = await api.get("/ads", { params });
    // Normalize response to { items, total, page, pages }
    return res.data && res.data.items ? res.data : { items: res.data, page: 1, pages: 1 };
  };

  const fetchAdDetails = async (id) => {
    const res = await api.get(`/ads/${id}`);
    return res.data;
  };

  const prefetchOptions = { staleTime: 1000 * 60 * 5 };
  const hasFreshData = (queryKey) => {
    const state = queryClient.getQueryState(queryKey);
    return state?.dataUpdatedAt && Date.now() - state.dataUpdatedAt < prefetchOptions.staleTime;
  };

  return useMemo(() => ({
    // Hook for fetching ads with filters
    useAds: (params) => {
      return useQuery({
        queryKey: ["ads", params],
        queryFn: () => fetchAds(params),
        keepPreviousData: true,
      });
    },

    // Prefetch specific category ads
    prefetchCategoryAds: (categorySlug) => {
      queryClient.prefetchQuery({
        queryKey: ["ads", { q: categorySlug, limit: 12 }],
        queryFn: () => fetchAds({ q: categorySlug, limit: 12 }),
        ...prefetchOptions,
      });
    },

    // Prefetch single ad details
    prefetchAdDetails: (adId) => {
      const adQueryKey = ["ad", adId];
      if (!hasFreshData(adQueryKey)) {
        queryClient.prefetchQuery({
          queryKey: adQueryKey,
          queryFn: () => fetchAdDetails(adId),
          ...prefetchOptions,
        });
      }
      // Prefetch similar ads when hovering
      const similarQueryKey = ["similar-ads", adId];
      if (!hasFreshData(similarQueryKey)) {
        queryClient.prefetchQuery({
          queryKey: similarQueryKey,
          queryFn: async () => {
            const res = await api.get(`/ads/${adId}/similar?limit=8`);
            return res.data;
          },
          ...prefetchOptions,
        });
      }
    },

    // Hook for similar ads
    useSimilarAds: (adId) => {
      return useQuery({
        queryKey: ["similar-ads", adId],
        queryFn: async () => {
          if (!adId || adId === "undefined") return [];
          const res = await api.get(`/ads/${adId}/similar?limit=8`);
          return res.data;
        },
        enabled: !!adId && adId !== "undefined",
        staleTime: 1000 * 60 * 5, // 5 minutes
      });
    },

    // Prefetch next page
    prefetchNextPage: (currentParams, currentPage, totalPages) => {
      if (currentPage < totalPages) {
        const nextParams = { ...currentParams, page: currentPage + 1 };
        queryClient.prefetchQuery({
          queryKey: ["ads", nextParams],
          queryFn: () => fetchAds(nextParams),
          ...prefetchOptions,
        });
      }
    }
  }), [queryClient, api]);
}
