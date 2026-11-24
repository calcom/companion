/**
 * Cal Event Guests Hooks
 *
 * React Query hooks for an event's guests. The Guests tab: the roster, the messages sent to its
 * guests, and the host actions (invite, message, approve or decline), each applied at once and
 * never touching the editor's Save. And the door list: its confirmed guests
 * (`/v2/events/{uuid}/bookings`), and check-in, undo and scanned-ticket check-in. Each of those
 * flips the guest in the cache, which also moves the screen's "N of M checked in" count, since the
 * screen derives it from the list.
 */

import {
  type MutationObserverOptions,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { queryKeys } from "@/config/cache.config";
import {
  type ApproveAllCalEventRegistrationsInput,
  CalComAPIService,
  type CalEvent,
  type CalEventCheckInList,
  type CalEventCheckInResult,
  type CalEventMessagesPage,
  type CalEventRegistrationDecision,
  type CalEventTicketCheckInResult,
  type InviteCalEventGuestsInput,
  type SendCalEventMessageInput,
} from "@/services/calcom";
import {
  type CalEventCheckInAvailability,
  getCalEventCheckInAvailability,
  getCalEventCheckInAvailabilityDelayMs,
  setCalEventGuestCheckedInAt,
} from "@/utils/cal-events";
import { isForbiddenError, isNetworkError, isNotFoundError } from "./useCalEvents";

const retry = (failureCount: number, error: Error) =>
  !isNetworkError(error) && !isForbiddenError(error) && failureCount < 2;

// The query client has no focus manager here, so a return to the app doesn't refetch by itself.
function useRefetchOnForeground(enabled: boolean, refetch: () => unknown) {
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refetch();
    });
    return () => subscription.remove();
  }, [enabled, refetch]);
}

/**
 * Hook to fetch every guest of an event, in each status the tab lists. Guests register outside the app, so it's never
 * fresh: it refetches each time the tab opens and when the app comes back to the foreground.
 */
export function useCalEventRoster(uuid: string, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: queryKeys.calEvents.roster(uuid),
    queryFn: () => CalComAPIService.getCalEventRoster(uuid),
    enabled: enabled && !!uuid,
    staleTime: 0,
    refetchOnMount: "always",
    retry,
  });
  useRefetchOnForeground(enabled, query.refetch);
  return query;
}

/**
 * Hook to fetch how many of an event's guests are in each status, from the server. Fresh as the
 * roster is, and refetched with it: its key sits under the roster's, so each guest action that
 * refetches the roster refetches these too.
 */
export function useCalEventRegistrationCounts(uuid: string, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: queryKeys.calEvents.registrationCounts(uuid),
    queryFn: () => CalComAPIService.getCalEventRegistrationCounts(uuid),
    enabled: enabled && !!uuid,
    staleTime: 0,
    refetchOnMount: "always",
    retry,
  });
  useRefetchOnForeground(enabled, query.refetch);
  return query;
}

/**
 * Refetches an event's roster, and the counts under its key, for a pull on the Guests tab.
 * Resolves once they're back, so the pull can stop its spinner.
 */
export function refetchCalEventRoster(queryClient: QueryClient, uuid: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.roster(uuid) });
}

/** How often the Sent list checks on a message that's still going out, as the web does. */
const SENDING_POLL_MS = 3000;

/**
 * Hook to fetch the messages sent to an event's guests, 20 at a time, newest first. While one is
 * still sending it refetches every few seconds, so its status and counts land on their own.
 */
export function useCalEventMessages(uuid: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.calEvents.messages(uuid),
    queryFn: ({ pageParam }) => CalComAPIService.getCalEventMessages(uuid, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page: CalEventMessagesPage) => page.nextCursor,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.messages.some((message) => message.status === "SENDING")
      )
        ? SENDING_POLL_MS
        : false,
    select: (data) => data.pages.flatMap((page) => page.messages),
    enabled: !!uuid,
    staleTime: 0,
    refetchOnMount: "always",
    retry,
  });
}

/** Hook to email invitations to register. */
export function useInviteCalEventGuests() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, input }: { uuid: string; input: InviteCalEventGuestsInput }) =>
      CalComAPIService.inviteCalEventGuests(uuid, input),
    // Not idempotent: a retry after a lost response would send the invitations twice.
    retry: false,
    onSettled: (_result, _error, { uuid }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.roster(uuid) });
    },
  });
}

/** Hook to email one group of an event's guests. */
export function useSendCalEventMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, input }: { uuid: string; input: SendCalEventMessageInput }) =>
      CalComAPIService.sendCalEventMessage(uuid, input),
    // Not idempotent: a retry after a lost response would email everyone twice.
    retry: false,
    onSettled: (_result, _error, { uuid }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.messages(uuid) });
    },
  });
}

/** Hook to approve every guest waiting for approval. Approved guests join the roster. */
export function useApproveAllCalEventRegistrations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, input }: { uuid: string; input?: ApproveAllCalEventRegistrationsInput }) =>
      CalComAPIService.approveAllCalEventRegistrations(uuid, input),
    retry: false,
    onSettled: (_result, _error, { uuid }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.roster(uuid) });
      // The listing's registered count changes with it.
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.lists() });
    },
  });
}

/** Hook to approve or decline one guest. Either moves them to another chip. */
export function useDecideCalEventRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      uuid,
      registrationId,
      decision,
    }: {
      uuid: string;
      registrationId: string;
      decision: "approve" | "decline";
    }): Promise<CalEventRegistrationDecision> =>
      decision === "approve"
        ? CalComAPIService.approveCalEventRegistration(uuid, registrationId)
        : CalComAPIService.declineCalEventRegistration(uuid, registrationId),
    retry: false,
    onSettled: (_result, _error, { uuid }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.roster(uuid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.lists() });
    },
  });
}

/**
 * Hook to fetch an event's confirmed guests, every page of them. Other hosts check guests in too, so
 * the list is never fresh for long: it refetches whenever the screen opens or the app comes back.
 */
export function useCalEventGuests(uuid: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!uuid) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refetchCalEventGuestsIfIdle(queryClient, uuid);
    });
    return () => subscription.remove();
  }, [queryClient, uuid]);

  return useQuery({
    queryKey: queryKeys.calEvents.guests(uuid ?? ""),
    queryFn: () => {
      if (!uuid) throw new Error("uuid is required");
      return CalComAPIService.getCalEventGuests(uuid);
    },
    enabled: !!uuid,
    staleTime: 0,
    refetchOnMount: true,
    retry: (failureCount, error) =>
      !isNetworkError(error) &&
      !isForbiddenError(error) &&
      !isNotFoundError(error) &&
      failureCount < 2,
  });
}

/**
 * Skipped while a tap is in flight: its onSettled refetches, and a refetch now could flip its guest
 * back. Resolves once the refetch is done, or at once when skipped, so a pull can stop its spinner.
 */
export function refetchCalEventGuestsIfIdle(queryClient: QueryClient, uuid: string): Promise<void> {
  const queryKey = queryKeys.calEvents.guests(uuid);
  if (queryClient.isMutating({ mutationKey: queryKey }) > 0) return Promise.resolve();
  return queryClient.invalidateQueries({ queryKey });
}

/** What the guest showed before the tap, put back if the call fails. */
type GuestCheckInContext = { previous: string | null };

/**
 * In-flight check-ins and undos of one event's guest list. Both mutations share the list's key;
 * `exact` leaves out scanned tickets, whose key extends it and whose variables are tokens.
 */
const pendingGuestMutations = (uuid: string) =>
  ({ mutationKey: queryKeys.calEvents.guests(uuid), exact: true, status: "pending" }) as const;

/**
 * Whether a check-in or undo for this guest is still in flight. Read straight from the mutation
 * cache, so a second tap is caught even before the screen re-renders with the row disabled.
 */
export function isCalEventGuestPending(
  queryClient: QueryClient,
  uuid: string,
  guestId: string
): boolean {
  return (
    queryClient.isMutating({
      ...pendingGuestMutations(uuid),
      predicate: (mutation) => mutation.state.variables === guestId,
    }) > 0
  );
}

/** Hook returning the guests whose check-in or undo is still in flight, to disable their rows. */
export function usePendingCalEventGuestIds(uuid: string): ReadonlySet<string> {
  const guestIds = useMutationState({
    filters: pendingGuestMutations(uuid),
    select: (mutation) => mutation.state.variables as string,
  });
  return useMemo(() => new Set(guestIds), [guestIds]);
}

/**
 * Check-in and undo share this: the guest flips in the cache at once and flips back if the call
 * fails. The list refetches only once the last tap in flight settles, so a refetch that started
 * before a newer tap reached the server can't flip that guest back.
 */
function guestCheckInMutationOptions<TResult>(
  queryClient: QueryClient,
  uuid: string,
  {
    mutationFn,
    optimisticCheckedInAt,
    confirmedCheckedInAt,
  }: {
    mutationFn: (guestId: string) => Promise<TResult>;
    optimisticCheckedInAt: () => string | null;
    /** Where the response disagrees with the optimistic flip: the guest's actual check-in. */
    confirmedCheckedInAt?: (result: TResult) => string | null | undefined;
  }
): MutationObserverOptions<TResult, Error, string, GuestCheckInContext> {
  const queryKey = queryKeys.calEvents.guests(uuid);
  const setCheckedInAt = (guestId: string, checkedInAt: string | null) =>
    queryClient.setQueryData<CalEventCheckInList>(queryKey, (list) =>
      setCalEventGuestCheckedInAt(list, guestId, checkedInAt)
    );

  return {
    mutationKey: queryKey,
    mutationFn,
    // The host retries by tapping again. A retry behind their back could flip the row much later.
    retry: false,
    onMutate: async (guestId) => {
      await queryClient.cancelQueries({ queryKey });
      const list = queryClient.getQueryData<CalEventCheckInList>(queryKey);
      const previous = list?.guests.find((guest) => guest.id === guestId)?.checkedInAt ?? null;
      setCheckedInAt(guestId, optimisticCheckedInAt());
      return { previous };
    },
    onSuccess: (result, guestId) => {
      const checkedInAt = confirmedCheckedInAt?.(result);
      if (checkedInAt !== undefined) setCheckedInAt(guestId, checkedInAt);
    },
    onError: (error, guestId, context) => {
      if (context) setCheckedInAt(guestId, context.previous);
      console.error("Failed to update a guest's check-in");
      if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error);
        console.debug("[useCalEventGuests] check-in failed", { message });
      }
    },
    onSettled: () => {
      // This mutation still counts as in flight here: 1 means no other tap is pending.
      if (queryClient.isMutating({ mutationKey: queryKey }) === 1) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  };
}

/** Check-in's mutation options, apart from the hook so tests can run them on a bare QueryClient. */
export function checkInCalEventGuestMutationOptions(queryClient: QueryClient, uuid: string) {
  return guestCheckInMutationOptions(queryClient, uuid, {
    mutationFn: (guestId) => CalComAPIService.checkInCalEventGuest(uuid, guestId),
    optimisticCheckedInAt: () => new Date().toISOString(),
    // The server's time wins when present; an earlier check-in stands, and an unconfirmed guest stays unchecked.
    confirmedCheckedInAt: (result: CalEventCheckInResult) =>
      result.kind === "already_checked_in"
        ? result.checkedInAt
        : result.kind === "checked_in"
          ? result.checkedInAt
          : null,
  });
}

/** Undo's mutation options, apart from the hook so tests can run them on a bare QueryClient. */
export function undoCalEventGuestCheckInMutationOptions(queryClient: QueryClient, uuid: string) {
  return guestCheckInMutationOptions(queryClient, uuid, {
    mutationFn: (guestId) => CalComAPIService.undoCalEventGuestCheckIn(uuid, guestId),
    optimisticCheckedInAt: () => null,
  });
}

/**
 * Scanned-ticket check-in's mutation options, apart from the hook so tests can run them on a bare
 * QueryClient. Only the server knows whose ticket it is, so nothing flips until it answers. The
 * key extends the list's, so the list's "refetch once the last call settles" rule covers scans too.
 */
export function checkInCalEventGuestByTicketMutationOptions(
  queryClient: QueryClient,
  uuid: string
): MutationObserverOptions<CalEventTicketCheckInResult, Error, string> {
  const queryKey = queryKeys.calEvents.guests(uuid);
  return {
    mutationKey: [...queryKey, "ticket"],
    mutationFn: (checkInToken) => CalComAPIService.checkInCalEventGuestByTicket(uuid, checkInToken),
    // A code held in front of the camera is sent again after a pause; that's the retry.
    retry: false,
    // A refetch that started before this check-in landed would flip the guest back.
    onMutate: () => queryClient.cancelQueries({ queryKey }),
    onSuccess: (result) => {
      if (result.kind === "not_confirmed") return;
      const checkedInAt =
        result.kind === "already_checked_in"
          ? result.checkedInAt
          : (result.guest.checkedInAt ?? new Date().toISOString());
      queryClient.setQueryData<CalEventCheckInList>(queryKey, (list) =>
        setCalEventGuestCheckedInAt(list, result.guest.id, checkedInAt)
      );
    },
    onError: (error) => {
      // A 404 is a ticket that isn't for this event, which the scanner says itself: not an error.
      if (!isNotFoundError(error)) console.error("Failed to check a guest in from a ticket");
      if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error);
        console.debug("[useCalEventGuests] ticket check-in failed", { message });
      }
    },
    onSettled: () => {
      // As for a tap: 1 is this scan, so no other call is pending.
      if (queryClient.isMutating({ mutationKey: queryKey }) === 1) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  };
}

/**
 * Hook to check a guest in at the door (hosts and co-hosts). Use `mutateAsync`, one call per tap:
 * callbacks passed to `mutate` only fire for the latest call, so an earlier tap's failure would go
 * unreported.
 */
export function useCheckInCalEventGuest(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation(checkInCalEventGuestMutationOptions(queryClient, uuid));
}

/** Hook to undo a guest's check-in (hosts and co-hosts). Use `mutateAsync`, as for check-in. */
export function useUndoCalEventGuestCheckIn(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation(undoCalEventGuestCheckInMutationOptions(queryClient, uuid));
}

/**
 * Hook to check a guest in from a scanned QR ticket (hosts and co-hosts). Use `mutateAsync`, one
 * call per scan.
 */
export function useCheckInCalEventGuestByTicket(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation(checkInCalEventGuestByTicketMutationOptions(queryClient, uuid));
}

/**
 * Hook returning whether the event's door takes check-ins, kept current while the screen stays
 * open: it reads the clock again when the window opens or closes, and when the event changes. The
 * clock is state rather than read during render, since the React Compiler would cache the answer
 * for as long as the event object stays the same.
 */
export function useCalEventCheckInAvailability(
  event: Pick<CalEvent, "checkInOpensAt" | "checkInClosesAt"> | null | undefined
): CalEventCheckInAvailability | null {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!event) return;
    // `now` is the last tick, which can be hours old when a refetch brings a rescheduled event.
    const current = new Date();
    const availability = getCalEventCheckInAvailability(event, current);
    if (availability.kind !== getCalEventCheckInAvailability(event, now).kind) {
      setNow(current);
      return;
    }
    const delayMs = getCalEventCheckInAvailabilityDelayMs(availability, current);
    if (delayMs === null) return;
    const timer = setTimeout(() => setNow(new Date()), delayMs);
    return () => clearTimeout(timer);
  }, [event, now]);
  return event ? getCalEventCheckInAvailability(event, now) : null;
}
