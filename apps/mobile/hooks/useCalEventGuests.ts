/**
 * Cal Event Guests Query Hooks
 *
 * An event's door list: its confirmed guests (`/v2/events/{uuid}/bookings`), and check-in, undo
 * and scanned-ticket check-in. Each one flips the guest in the cache, which also moves the
 * screen's "N of M checked in" count, since the screen derives it from the list.
 */

import {
  type MutationObserverOptions,
  type QueryClient,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { queryKeys } from "@/config/cache.config";
import {
  CalComAPIService,
  type CalEvent,
  type CalEventCheckInResult,
  type CalEventGuestsPage,
  type CalEventTicketCheckInResult,
} from "@/services/calcom";
import {
  type CalEventCheckInAvailability,
  getCalEventCheckInAvailability,
  getCalEventCheckInAvailabilityDelayMs,
  setCalEventGuestCheckedInAt,
} from "@/utils/cal-events";
import { isForbiddenError, isNetworkError, isNotFoundError } from "./useCalEvents";

/**
 * Hook to fetch an event's confirmed guests (the first page). Other hosts check guests in too, so
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

/** Skipped while a tap is in flight: its onSettled refetches, and a refetch now could flip its guest back. */
export function refetchCalEventGuestsIfIdle(queryClient: QueryClient, uuid: string) {
  const queryKey = queryKeys.calEvents.guests(uuid);
  if (queryClient.isMutating({ mutationKey: queryKey }) === 0) {
    queryClient.invalidateQueries({ queryKey });
  }
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
    queryClient.setQueryData<CalEventGuestsPage>(queryKey, (page) =>
      setCalEventGuestCheckedInAt(page, guestId, checkedInAt)
    );

  return {
    mutationKey: queryKey,
    mutationFn,
    // The host retries by tapping again. A retry behind their back could flip the row much later.
    retry: false,
    onMutate: async (guestId) => {
      await queryClient.cancelQueries({ queryKey });
      const page = queryClient.getQueryData<CalEventGuestsPage>(queryKey);
      const previous = page?.guests.find((guest) => guest.id === guestId)?.checkedInAt ?? null;
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
      queryClient.setQueryData<CalEventGuestsPage>(queryKey, (page) =>
        setCalEventGuestCheckedInAt(page, result.guest.id, checkedInAt)
      );
    },
    onError: (error) => {
      console.error("Failed to check a guest in from a ticket");
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
 * Hook to check a guest in at the door (hosts only). Use `mutateAsync`, one call per tap: callbacks
 * passed to `mutate` only fire for the latest call, so an earlier tap's failure would go unreported.
 */
export function useCheckInCalEventGuest(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation(checkInCalEventGuestMutationOptions(queryClient, uuid));
}

/** Hook to undo a guest's check-in (hosts only). Use `mutateAsync`, as for check-in. */
export function useUndoCalEventGuestCheckIn(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation(undoCalEventGuestCheckInMutationOptions(queryClient, uuid));
}

/** Hook to check a guest in from a scanned QR ticket (hosts only). Use `mutateAsync`, one call per scan. */
export function useCheckInCalEventGuestByTicket(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation(checkInCalEventGuestByTicketMutationOptions(queryClient, uuid));
}

/**
 * Hook returning whether the event's door takes check-ins, kept current while the screen stays
 * open: it reads the clock again when the window opens or closes. The clock is state rather than
 * read during render, since the React Compiler would cache the answer for as long as the event
 * object stays the same.
 */
export function useCalEventCheckInAvailability(
  event: Pick<CalEvent, "startTime" | "endTime"> | null | undefined
): CalEventCheckInAvailability | null {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!event) return;
    const delayMs = getCalEventCheckInAvailabilityDelayMs(
      getCalEventCheckInAvailability(event, now),
      now
    );
    if (delayMs === null) return;
    const timer = setTimeout(() => setNow(new Date()), delayMs);
    return () => clearTimeout(timer);
  }, [event, now]);
  return event ? getCalEventCheckInAvailability(event, now) : null;
}
