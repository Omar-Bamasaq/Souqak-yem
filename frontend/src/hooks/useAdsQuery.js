
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API = (import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:5000/api";

export function useAdsQuery() {
  const queryClient = useQueryClient();

  const fetchAds = async (params) => {
    const res = await axios.get(`${API}/ads`, { params });
    // Normalize response to { items, total, page, pages }
    return res.data && res.data.items ? res.data : { items: res.data, page: 1, pages: 1 };
  };

  const fetchAdDetails = async (id) => {
    const res = await axios.get(`${API}/ads/${id}`);
    return res.data;
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
      });
    },

    // Prefetch single ad details
    prefetchAdDetails: (adId) => {
      queryClient.prefetchQuery({
        queryKey: ["ad", adId],
        queryFn: () => fetchAdDetails(adId),
      });
      // Prefetch similar ads when hovering
      queryClient.prefetchQuery({
        queryKey: ["similar-ads", adId],
        queryFn: async () => {
          const res = await axios.get(`${API}/ads/${adId}/similar?limit=8`);
          return res.data;
        },
      });
    },

    // Hook for similar ads
    useSimilarAds: (adId) => {
      return useQuery({
        queryKey: ["similar-ads", adId],
        queryFn: async () => {
          if (!adId || adId === "undefined") return [];
          const res = await axios.get(`${API}/ads/${adId}/similar?limit=8`);
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
        });
      }
    }
  }), [queryClient]);
}
