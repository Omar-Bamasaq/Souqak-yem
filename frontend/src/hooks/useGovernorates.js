import { useQuery } from "@tanstack/react-query";
import { useApi } from "../api/axios.js";

const GOVERNORATES_STALE_TIME = 1000 * 60 * 5;

export function useGovernorates() {
  const api = useApi();

  return useQuery({
    queryKey: ["governorates", { active: true }],
    queryFn: async () => {
      const res = await api.get("/governorates", { params: { active: true } });
      return res.data || [];
    },
    staleTime: GOVERNORATES_STALE_TIME,
  });
}
