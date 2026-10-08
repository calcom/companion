/**
 * Cal Events Query Hooks
 *
 * React Query hooks over `/v2/events`: the listing per profile (personal, or a team's
 * via `/v2/teams/{teamId}/events`), a single event, and the host-only lifecycle
 * mutations (publish, cancel, delete). The app has no event editor — editing happens
 * on the web — so there is no update mutation here.
 */

import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CACHE_CONFIG, queryKeys } from "@/config/cache.config";
import { CalComAPIService, type CalEvent } from "@/services/calcom";
import { ApiRequestError } from "@/services/calcom/request";

const isNetworkError = (error: Error | null) =>
  !!error?.message && (error.message.includes("Network") || error.message.includes("fetch"));

/** A 403 won't change on retry: a pending team membership, or a role that can't read events. */
export const isForbiddenError = (error: Error | null) =>
  error instanceof ApiRequestError && error.status === 403;

/**
 * Hook to fetch the cal events of one profile: the user's own (plus co-hosted) when
 * `teamId` is null, else the team's. Deliberately no `placeholderData`: the key changes
 * with the profile, so the previous data would be another profile's events. A newly
 * selected profile shows its own loading state instead.
 */
export function useCalEvents(teamId: number | null = null, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.calEvents.list(teamId),
    queryFn: () => CalComAPIService.getCalEvents(teamId),
    enabled,
    staleTime: CACHE_CONFIG.calEvents.staleTime,
    retry: (failureCount, error) =>
      !isNetworkError(error) && !isForbiddenError(error) && failureCount < 2,
    refetchOnReconnect: true,
  });
}

/**
 * Hook to fetch a single cal event. Seeds from whichever listing already holds it so the
 * detail screen paints instantly; the single-event response carries no `confirmedCount`,
 * so the listing's count is kept when the fresh copy has none.
 */
export function useCalEvent(uuid: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.calEvents.detail(uuid ?? ""),
    queryFn: async () => {
      if (!uuid) throw new Error("uuid is required");
      const fresh = await CalComAPIService.getCalEvent(uuid);
      if (!fresh) return null;
      const listed = findInLists(queryClient, uuid);
      return fresh.confirmedCount === undefined && listed
        ? { ...fresh, confirmedCount: listed.confirmedCount }
        : fresh;
    },
    enabled: !!uuid,
    staleTime: CACHE_CONFIG.calEvents.staleTime,
    retry: (failureCount, error) =>
      !isNetworkError(error) && !isForbiddenError(error) && failureCount < 2,
    placeholderData: () => (uuid ? findInLists(queryClient, uuid) : undefined),
  });
}

function findInLists(
  queryClient: ReturnType<typeof useQueryClient>,
  uuid: string
): CalEvent | undefined {
  for (const [, data] of queryClient.getQueriesData<CalEvent[]>({
    queryKey: queryKeys.calEvents.lists(),
  })) {
    const match = data?.find((event) => event.uuid === uuid);
    if (match) return match;
  }
  return undefined;
}

/**
 * Puts a publish/cancel response in the detail cache. Like the single-event GET, it carries no
 * `confirmedCount`, so the listing's count is kept and the attendance row doesn't drop out.
 */
export function setCalEventDetail(queryClient: ReturnType<typeof useQueryClient>, event: CalEvent) {
  const listed =
    event.confirmedCount === undefined ? findInLists(queryClient, event.uuid) : undefined;
  queryClient.setQueryData(
    queryKeys.calEvents.detail(event.uuid),
    listed ? { ...event, confirmedCount: listed.confirmedCount } : event
  );
}

/** Hook to publish a draft (hosts only). */
export function usePublishCalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => CalComAPIService.publishCalEvent(uuid),
    onSuccess: (event) => {
      setCalEventDetail(queryClient, event);
    },
    onError: (error) => {
      console.error("Failed to publish cal event");
      if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error);
        console.debug("[useCalEvents] publish failed", { message });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.all });
    },
  });
}

/** Hook to cancel an event, notifying its guests (hosts only). */
export function useCancelCalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, reason }: { uuid: string; reason?: string }) =>
      CalComAPIService.cancelCalEvent(uuid, reason),
    onSuccess: (event) => {
      setCalEventDetail(queryClient, event);
    },
    onError: (error) => {
      console.error("Failed to cancel cal event");
      if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error);
        console.debug("[useCalEvents] cancel failed", { message });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.all });
    },
  });
}

/** The listings a delete took the event out of, and the auth session they belong to. */
type CalEventListsSnapshot = {
  previous: [QueryKey, CalEvent[] | undefined][];
  authGeneration: number;
};

/**
 * Puts back the listings a failed delete took the event out of, unless the user logged out or
 * switched accounts meanwhile: that cleared the cache, and the list keys don't name the account,
 * so the previous account's events would show under the next one.
 */
export function restoreCalEventLists(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: CalEventListsSnapshot | undefined
) {
  if (snapshot?.authGeneration !== CalComAPIService.getAuthGeneration()) return;
  for (const [key, data] of snapshot.previous) {
    queryClient.setQueryData(key, data);
  }
}

/** Hook to delete an event (hosts only). Removes it from every cached listing at once. */
export function useDeleteCalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => CalComAPIService.deleteCalEvent(uuid),
    onMutate: async (uuid): Promise<CalEventListsSnapshot> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calEvents.lists() });
      const previous = queryClient.getQueriesData<CalEvent[]>({
        queryKey: queryKeys.calEvents.lists(),
      });
      for (const [key, data] of previous) {
        if (data) {
          queryClient.setQueryData(
            key,
            data.filter((event) => event.uuid !== uuid)
          );
        }
      }
      return { previous, authGeneration: CalComAPIService.getAuthGeneration() };
    },
    onError: (error, _uuid, context) => {
      restoreCalEventLists(queryClient, context);
      console.error("Failed to delete cal event");
      if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error);
        console.debug("[useCalEvents] delete failed", { message });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.all });
    },
  });
}

/** Hook returning a function that invalidates every cal events query. */
export function useInvalidateCalEvents() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.all });
  };
}

export type { CalEvent };
