/**
 * Cal Event Guests Query Hooks
 *
 * An event's door list: its confirmed guests (`/v2/events/{uuid}/bookings`), and check-in and
 * undo. Both mutations flip the guest in the cache at once, which also moves the screen's
 * "N of M checked in" count, since the screen derives it from the list.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/cache.config";
import {
  CalComAPIService,
  type CalEventCheckInResult,
  type CalEventGuestsPage,
} from "@/services/calcom";
import { setCalEventGuestCheckedInAt } from "@/utils/cal-events";
import { isForbiddenError, isNetworkError } from "./useCalEvents";

/**
 * Hook to fetch an event's confirmed guests (the first page). Other hosts check guests in too, so
 * the list is never fresh for long: it refetches whenever the screen opens or the app comes back.
 */
export function useCalEventGuests(uuid: string | undefined) {
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
      !isNetworkError(error) && !isForbiddenError(error) && failureCount < 2,
  });
}

/**
 * Check-in and undo share this: the guest flips in the cache at once and flips back if the call
 * fails. The list refetches only once the last tap in flight settles, so a refetch that started
 * before a newer tap reached the server can't flip that guest back.
 */
function useGuestCheckInMutation<TResult>(
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
) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.calEvents.guests(uuid);
  const setCheckedInAt = (guestId: string, checkedInAt: string | null) =>
    queryClient.setQueryData<CalEventGuestsPage>(queryKey, (page) =>
      setCalEventGuestCheckedInAt(page, guestId, checkedInAt)
    );

  return useMutation({
    mutationKey: queryKey,
    mutationFn,
    // The host retries by tapping again. A retry behind their back could flip the row much later.
    retry: false,
    onMutate: async (guestId: string) => {
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
  });
}

/** Hook to check a guest in at the door (hosts only). */
export function useCheckInCalEventGuest(uuid: string) {
  return useGuestCheckInMutation(uuid, {
    mutationFn: (guestId) => CalComAPIService.checkInCalEventGuest(uuid, guestId),
    optimisticCheckedInAt: () => new Date().toISOString(),
    // An earlier check-in's time stands, and a guest who is no longer confirmed stays unchecked.
    confirmedCheckedInAt: (result: CalEventCheckInResult) =>
      result.kind === "already_checked_in"
        ? result.checkedInAt
        : result.kind === "not_confirmed"
          ? null
          : undefined,
  });
}

/** Hook to undo a guest's check-in (hosts only). */
export function useUndoCalEventGuestCheckIn(uuid: string) {
  return useGuestCheckInMutation(uuid, {
    mutationFn: (guestId) => CalComAPIService.undoCalEventGuestCheckIn(uuid, guestId),
    optimisticCheckedInAt: () => null,
  });
}
