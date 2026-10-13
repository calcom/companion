/**
 * Cal Events Query Hooks
 *
 * React Query hooks over `/v2/events`: the cursor-paginated listing per profile (personal, or
 * a team's via `/v2/teams/{teamId}/events`), a single event, and the host-only lifecycle
 * mutations (publish, cancel, delete). The app has no event editor — editing happens
 * on the web — so there is no update mutation here.
 */

import {
  type InfiniteData,
  type QueryClient,
  type QueryKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CACHE_CONFIG, queryKeys } from "@/config/cache.config";
import { CalComAPIService, type CalEvent, type CalEventsPage } from "@/services/calcom";
import { ApiRequestError } from "@/services/calcom/request";

const isNetworkError = (error: Error | null) =>
  !!error?.message && (error.message.includes("Network") || error.message.includes("fetch"));

/** A 403 won't change on retry: a pending team membership, or a role that can't read events. */
export const isForbiddenError = (error: Error | null) =>
  error instanceof ApiRequestError && error.status === 403;

/** One profile's listing as the cache holds it: the pages loaded so far and their cursors. */
export type CalEventsListData = InfiniteData<CalEventsPage, string | null>;

/**
 * Every event on the loaded pages, in API order. An event whose start time changes between two
 * page requests can come back on both; the first copy wins so the list never renders it twice.
 */
export function flattenCalEventsPages(data: CalEventsListData): CalEvent[] {
  const seen = new Set<string>();
  const events: CalEvent[] = [];
  for (const page of data.pages) {
    for (const event of page.events) {
      if (seen.has(event.uuid)) continue;
      seen.add(event.uuid);
      events.push(event);
    }
  }
  return events;
}

/**
 * Hook to fetch the cal events of one profile, a page at a time: the user's own (plus
 * co-hosted) when `teamId` is null, else the team's. Each profile has its own key, so each
 * chip keeps its own pages and cursor. `data` is the loaded pages flattened; call
 * `fetchNextPage` while `hasNextPage` for more. Deliberately no `placeholderData`: the key
 * changes with the profile, so the previous data would be another profile's events. A newly
 * selected profile shows its own loading state instead.
 */
export function useCalEvents(teamId: number | null = null, { enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.calEvents.list(teamId),
    queryFn: ({ pageParam }) => CalComAPIService.getCalEvents(teamId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
    select: flattenCalEventsPages,
    enabled,
    staleTime: CACHE_CONFIG.calEvents.staleTime,
    retry: (failureCount, error) =>
      !isNetworkError(error) && !isForbiddenError(error) && failureCount < 2,
    refetchOnReconnect: true,
  });
}

/**
 * Starts a profile's listing over from its first page. A plain refetch re-walks every loaded
 * page one request at a time; pull-to-refresh drops all but the first page and refetches that.
 * Any page load in flight is cancelled first, since cancelling puts back the pages it started from.
 */
export async function restartCalEvents(queryClient: QueryClient, teamId: number | null) {
  const queryKey = queryKeys.calEvents.list(teamId);
  await queryClient.cancelQueries({ queryKey, exact: true });
  queryClient.setQueryData<CalEventsListData>(queryKey, (data) =>
    data && data.pages.length > 1
      ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) }
      : data
  );
  await queryClient.refetchQueries({ queryKey, exact: true });
}

/** Hook returning pull-to-refresh for a profile's listing: see restartCalEvents. */
export function useRestartCalEvents(teamId: number | null) {
  const queryClient = useQueryClient();
  return () => restartCalEvents(queryClient, teamId);
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

function findInLists(queryClient: QueryClient, uuid: string): CalEvent | undefined {
  for (const [, data] of queryClient.getQueriesData<CalEventsListData>({
    queryKey: queryKeys.calEvents.lists(),
  })) {
    for (const page of data?.pages ?? []) {
      const match = page.events.find((event) => event.uuid === uuid);
      if (match) return match;
    }
  }
  return undefined;
}

/** The listing with `update` applied to every event on every loaded page. */
function mapCalEventsPages(
  data: CalEventsListData,
  update: (events: CalEvent[]) => CalEvent[]
): CalEventsListData {
  return { ...data, pages: data.pages.map((page) => ({ ...page, events: update(page.events) })) };
}

/** The listing without the event, on whichever loaded page held it. */
export function removeCalEventFromPages(data: CalEventsListData, uuid: string): CalEventsListData {
  return mapCalEventsPages(data, (events) => events.filter((event) => event.uuid !== uuid));
}

/**
 * The listing with a publish/cancel response in place of the listed copy. The response carries
 * no `confirmedCount`, so the listed count is kept.
 */
export function replaceCalEventInPages(
  data: CalEventsListData,
  event: CalEvent
): CalEventsListData {
  return mapCalEventsPages(data, (events) =>
    events.map((listed) =>
      listed.uuid === event.uuid
        ? { ...event, confirmedCount: event.confirmedCount ?? listed.confirmedCount }
        : listed
    )
  );
}

/**
 * Shows a publish/cancel on every cached listing at once. The invalidation that follows
 * re-walks each listing's loaded pages one request at a time, so it can take a while to land.
 */
function setCalEventInLists(queryClient: QueryClient, event: CalEvent) {
  queryClient.setQueriesData<CalEventsListData>(
    { queryKey: queryKeys.calEvents.lists() },
    (data) => data && replaceCalEventInPages(data, event)
  );
}

/**
 * Puts a publish/cancel response in the detail cache. Like the single-event GET, it carries no
 * `confirmedCount`, so the listing's count is kept and the attendance row doesn't drop out.
 */
export function setCalEventDetail(queryClient: QueryClient, event: CalEvent) {
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
      setCalEventInLists(queryClient, event);
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
      setCalEventInLists(queryClient, event);
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
  previous: [QueryKey, CalEventsListData | undefined][];
  authGeneration: number;
};

/**
 * Puts back the listings a failed delete took the event out of, unless the user logged out or
 * switched accounts meanwhile: that cleared the cache, and the list keys don't name the account,
 * so the previous account's events would show under the next one.
 */
export function restoreCalEventLists(
  queryClient: QueryClient,
  snapshot: CalEventListsSnapshot | undefined
) {
  if (snapshot?.authGeneration !== CalComAPIService.getAuthGeneration()) return;
  for (const [key, data] of snapshot.previous) {
    queryClient.setQueryData(key, data);
  }
}

/** Hook to delete an event (hosts only). Removes it from every loaded page of every listing at once. */
export function useDeleteCalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => CalComAPIService.deleteCalEvent(uuid),
    onMutate: async (uuid): Promise<CalEventListsSnapshot> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calEvents.lists() });
      const previous = queryClient.getQueriesData<CalEventsListData>({
        queryKey: queryKeys.calEvents.lists(),
      });
      for (const [key, data] of previous) {
        if (data) {
          queryClient.setQueryData(key, removeCalEventFromPages(data, uuid));
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
