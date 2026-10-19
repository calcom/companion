/**
 * Cal Event Guests Hooks
 *
 * React Query hooks for an event's Guests tab: the roster of confirmed guests, the messages sent
 * to them, and the host actions (invite, message, approve all). Each action applies at once and
 * never touches the editor's Save.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { queryKeys } from "@/config/cache.config";
import {
  type ApproveAllCalEventRegistrationsInput,
  CalComAPIService,
  type CalEventMessagesPage,
  type InviteCalEventGuestsInput,
  type SendCalEventMessageInput,
} from "@/services/calcom";
import { isForbiddenError, isNetworkError } from "./useCalEvents";

const retry = (failureCount: number, error: Error) =>
  !isNetworkError(error) && !isForbiddenError(error) && failureCount < 2;

/**
 * Hook to fetch every confirmed guest of an event. Guests register outside the app, so it's never
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
  const { refetch } = query;
  // The query client has no focus manager here, so a return to the app doesn't refetch by itself.
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refetch();
    });
    return () => subscription.remove();
  }, [enabled, refetch]);
  return query;
}

/** Hook to fetch the messages sent to an event's guests, 20 at a time, newest first. */
export function useCalEventMessages(uuid: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.calEvents.messages(uuid),
    queryFn: ({ pageParam }) => CalComAPIService.getCalEventMessages(uuid, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page: CalEventMessagesPage) => page.nextCursor,
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
