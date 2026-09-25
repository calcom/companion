/**
 * Teams Query Hook
 *
 * The teams the user belongs to, for the profile chips on screens that list
 * per-profile resources (Events). Rarely changes: refreshed on manual reload only.
 */

import { useQuery } from "@tanstack/react-query";
import { CACHE_CONFIG, queryKeys } from "@/config/cache.config";
import { CalComAPIService, type Team } from "@/services/calcom";

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams.lists(),
    queryFn: () => CalComAPIService.getTeams(),
    staleTime: CACHE_CONFIG.userProfile.staleTime,
    placeholderData: (previousData) => previousData,
    retry: (failureCount, error) => {
      if (error?.message?.includes("Network") || error?.message?.includes("fetch")) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export type { Team };
