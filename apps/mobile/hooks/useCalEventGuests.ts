/**
 * Cal Event Guests Hooks
 *
 * React Query hooks for an event's Guests tab: the roster, the messages sent to its guests, and
 * the host actions (invite, message, approve or decline). Each action applies at once and never
 * touches the editor's Save.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { queryKeys } from "@/config/cache.config";
import {
  type ApproveAllCalEventRegistrationsInput,
  CalComAPIService,
  type CalEventMessagesPage,
  type CalEventRegistrationDecision,
  type InviteCalEventGuestsInput,
  type SendCalEventMessageInput,
} from "@/services/calcom";
import { isForbiddenError, isNetworkError } from "./useCalEvents";

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
