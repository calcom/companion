/**
 * Cal Events Query Hooks
 *
 * React Query hooks over `/v2/events`: the cursor-paginated listing per profile (personal, or a
 * team's via `/v2/teams/{teamId}/events`), a single event, creating a draft, editing one (with its
 * locations, cover, co-hosts and lineup photos), and the host-only lifecycle mutations
 * (publish, cancel, delete).
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
import {
  type AddCalEventLocationInput,
  CalComAPIService,
  type CalEvent,
  type CalEventImageFile,
  type CalEventLocation,
  type CalEventsListingStatus,
  type CalEventsPage,
  type CreateCalEventInput,
  type UpdateCalEventInput,
  type UpdateCalEventLocationInput,
} from "@/services/calcom";
import { ApiRequestError } from "@/services/calcom/request";

/** Offline or unreachable: retrying straight away only delays the error. */
export const isNetworkError = (error: Error | null) =>
  !!error?.message && (error.message.includes("Network") || error.message.includes("fetch"));

/** A 403 won't change on retry: a pending team membership, or a role that can't read events. */
export const isForbiddenError = (error: Error | null) =>
  error instanceof ApiRequestError && error.status === 403;

/** A 404 won't change on retry: the event was deleted, or the user no longer manages it. */
export const isNotFoundError = (error: Error | null) =>
  error instanceof ApiRequestError && error.status === 404;

/** Where a listing page starts: a group, and the cursor into it (null for its first page). */
export type CalEventsPageParam = { status: CalEventsListingStatus; cursor: string | null };

/** One profile's listing as the cache holds it: the pages loaded so far and their cursors. */
export type CalEventsListData = InfiniteData<CalEventsPage, CalEventsPageParam>;

/** The groups in the order the list shows them, and so walks them: each one's pages to its end. */
const CAL_EVENTS_LISTING_ORDER: CalEventsListingStatus[] = ["draft", "upcoming", "past"];

const FIRST_CAL_EVENTS_PAGE: CalEventsPageParam = { status: "draft", cursor: null };

function nextListingStatus(status: CalEventsListingStatus): CalEventsListingStatus | undefined {
  return CAL_EVENTS_LISTING_ORDER[CAL_EVENTS_LISTING_ORDER.indexOf(status) + 1];
}

/** The page after `page`: the rest of its group, else the next group's first page. */
export function getNextCalEventsPageParam(page: CalEventsPage): CalEventsPageParam | null {
  if (page.hasMore) return { status: page.status, cursor: page.nextCursor };
  const status = nextListingStatus(page.status);
  return status ? { status, cursor: null } : null;
}

/**
 * Fetches the page at `param`. An empty group is skipped in the same call: an empty page would
 * show as no events at all (or as an empty search) until the end of the list asked for more.
 */
export async function fetchCalEventsPage(
  teamId: number | null,
  param: CalEventsPageParam
): Promise<CalEventsPage> {
  const page = await CalComAPIService.getCalEvents(teamId, param.status, param.cursor);
  const next = page.events.length === 0 ? getNextCalEventsPageParam(page) : null;
  return next && next.cursor === null ? fetchCalEventsPage(teamId, next) : page;
}

/**
 * Every event on the loaded pages, in API order. An event that changes between two page requests
 * (its start time, or its group when it's published) can come back on both; the first copy wins
 * so the list never renders it twice.
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
 * co-hosted) when `teamId` is null, else the team's. It walks drafts, then upcoming, then past,
 * so every page lands below the ones before. Each profile has its own key, so each chip keeps
 * its own pages and cursor. `data` is the loaded pages flattened; call
 * `fetchNextPage` while `hasNextPage` for more. Deliberately no `placeholderData`: the key
 * changes with the profile, so the previous data would be another profile's events. A newly
 * selected profile shows its own loading state instead.
 */
export function useCalEvents(teamId: number | null = null, { enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.calEvents.list(teamId),
    queryFn: ({ pageParam }) => fetchCalEventsPage(teamId, pageParam),
    initialPageParam: FIRST_CAL_EVENTS_PAGE,
    getNextPageParam: getNextCalEventsPageParam,
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

/** Hook to create a draft, the user's own or a team's (`teamId`). */
export function useCreateCalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, teamId }: { input: CreateCalEventInput; teamId: number | null }) =>
      CalComAPIService.createCalEvent(input, teamId),
    // Not idempotent: a retry after a lost response would create a second draft.
    retry: false,
    onSuccess: (event) => {
      // The detail screen it opens on paints from the cache at once.
      setCalEventDetail(queryClient, event);
    },
    onError: (error) => {
      console.error("Failed to create cal event");
      if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error);
        console.debug("[useCalEvents] create failed", { message });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.lists() });
    },
  });
}

/**
 * Hook to save an edit (hosts only). The response refreshes the detail screen; the listings
 * refetch so the card changes under its own profile only.
 */
export function useUpdateCalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, input }: { uuid: string; input: UpdateCalEventInput }) =>
      CalComAPIService.updateCalEvent(uuid, input),
    retry: false,
    onSuccess: (event) => {
      setCalEventDetail(queryClient, event);
    },
    onError: (error) => {
      console.error("Failed to update cal event");
      if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error);
        console.debug("[useCalEvents] update failed", { message });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.lists() });
    },
  });
}

/**
 * Puts a saved cover in the detail cache, so it shows even when the editor's PATCH after it
 * fails. Written, not invalidated: a detail refetch racing that PATCH could land after its
 * response and bring back the old fields.
 */
export function setCalEventCover(
  queryClient: ReturnType<typeof useQueryClient>,
  uuid: string,
  coverImageUrl: string | null
) {
  queryClient.setQueryData<CalEvent | null>(queryKeys.calEvents.detail(uuid), (cached) =>
    cached ? { ...cached, coverImageUrl } : cached
  );
}

/** Hook to replace or remove an event's cover. The editor saves its other fields after it. */
export function useCalEventCoverImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, file }: { uuid: string; file: CalEventImageFile | null }) =>
      file
        ? CalComAPIService.uploadCalEventCoverImage(uuid, file)
        : CalComAPIService.deleteCalEventCoverImage(uuid).then(() => null),
    retry: false,
    onSuccess: (coverImageUrl, { uuid }) => {
      setCalEventCover(queryClient, uuid, coverImageUrl);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.lists() });
    },
  });
}

/** Hook to upload a lineup or schedule person's photo; resolves to the URL to save. */
export function useUploadCalEventPersonAvatar() {
  return useMutation({
    mutationFn: ({ uuid, file }: { uuid: string; file: CalEventImageFile }) =>
      CalComAPIService.uploadCalEventPersonAvatar(uuid, file),
    retry: false,
  });
}

/** Hook to fetch an event's locations with their ids. */
export function useCalEventLocations(uuid: string | undefined) {
  return useQuery({
    queryKey: queryKeys.calEvents.locations(uuid ?? ""),
    queryFn: () => CalComAPIService.getCalEventLocations(uuid ?? ""),
    enabled: !!uuid,
    staleTime: CACHE_CONFIG.calEvents.staleTime,
    retry: (failureCount, error) =>
      !isNetworkError(error) && !isForbiddenError(error) && failureCount < 2,
  });
}

/** Hook to add a location. It applies at once (and emails the guests of a published event). */
export function useAddCalEventLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, location }: { uuid: string; location: AddCalEventLocationInput }) =>
      CalComAPIService.addCalEventLocation(uuid, location),
    // Not idempotent: a retry after a lost response would add it twice.
    retry: false,
    // Unlike a change or removal, the response isn't written to the list, so the add waits for
    // the refetch: the next add's address check and the removal lock read that list.
    onSettled: (_location, _error, { uuid }) => invalidateCalEventLocations(queryClient, uuid),
  });
}

/** Hook to change a location. It applies at once (and emails the guests of a published event). */
export function useUpdateCalEventLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      uuid,
      locationId,
      patch,
    }: {
      uuid: string;
      locationId: string;
      patch: UpdateCalEventLocationInput;
    }) => CalComAPIService.updateCalEventLocation(uuid, locationId, patch),
    retry: false,
    onSuccess: (location, { uuid, locationId }) => {
      queryClient.setQueryData<CalEventLocation[]>(queryKeys.calEvents.locations(uuid), (current) =>
        current?.map((existing) => (existing.id === locationId ? location : existing))
      );
    },
    onSettled: (_location, _error, { uuid }) => {
      invalidateCalEventLocations(queryClient, uuid);
    },
  });
}

/** Hook to remove a location. It applies at once (and emails the guests of a published event). */
export function useRemoveCalEventLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, locationId }: { uuid: string; locationId: string }) =>
      CalComAPIService.removeCalEventLocation(uuid, locationId),
    // A retry after a lost response would 404 on the location it already removed.
    retry: false,
    onSuccess: (remaining, { uuid }) => {
      queryClient.setQueryData(queryKeys.calEvents.locations(uuid), remaining);
    },
    onSettled: (_remaining, _error, { uuid }) => {
      invalidateCalEventLocations(queryClient, uuid);
    },
  });
}

/**
 * A location change shows on the event's detail and in the listings too. Resolves once the
 * locations list has refetched.
 */
function invalidateCalEventLocations(queryClient: ReturnType<typeof useQueryClient>, uuid: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.detail(uuid) });
  queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.lists() });
  return queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.locations(uuid) });
}

/** Hook to fetch an event's external co-hosts. */
export function useCalEventCoHosts(uuid: string | undefined) {
  return useQuery({
    queryKey: queryKeys.calEvents.coHosts(uuid ?? ""),
    queryFn: () => CalComAPIService.getCalEventCoHosts(uuid ?? ""),
    enabled: !!uuid,
    staleTime: CACHE_CONFIG.calEvents.staleTime,
    retry: (failureCount, error) =>
      !isNetworkError(error) && !isForbiddenError(error) && failureCount < 2,
  });
}

type CoHostChange =
  | { kind: "invite"; email: string }
  | { kind: "remove"; coHostId: string }
  | { kind: "reorder"; coHostIds: string[] };

/** Hook to invite, remove or reorder co-hosts. Each change applies at once. */
export function useChangeCalEventCoHosts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, change }: { uuid: string; change: CoHostChange }) => {
      switch (change.kind) {
        case "invite":
          return CalComAPIService.inviteCalEventCoHost(uuid, change.email);
        case "remove":
          return CalComAPIService.removeCalEventCoHost(uuid, change.coHostId);
        case "reorder":
          return CalComAPIService.reorderCalEventCoHosts(uuid, change.coHostIds);
      }
    },
    retry: false,
    // Returned so isPending stays on until the list refetches: a reorder from the old list would
    // undo this change, or be rejected as stale.
    onSettled: (_result, _error, { uuid }) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.coHosts(uuid) }),
  });
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
