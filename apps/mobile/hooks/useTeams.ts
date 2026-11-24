/**
 * Teams Query Hook
 *
 * The teams the user belongs to, for the profile chips on screens that list
 * per-profile resources (Events). Rarely changes, so never stale: the Events
 * pull-to-refresh refetches it.
 */

import { useQuery } from "@tanstack/react-query";
import { CACHE_CONFIG, queryKeys } from "@/config/cache.config";
import { isForbiddenError, isNetworkError } from "@/hooks/useCalEvents";
import { CalComAPIService, type Team } from "@/services/calcom";

export function useTeams({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.teams.lists(),
    queryFn: () => CalComAPIService.getTeams(),
    enabled,
    staleTime: CACHE_CONFIG.userProfile.staleTime,
    placeholderData: (previousData) => previousData,
    // A 403 is a token without TEAM_PROFILE_READ: retrying can't grant it.
    retry: (failureCount, error) =>
      !isNetworkError(error) && !isForbiddenError(error) && failureCount < 2,
  });
}

export type { Team };
