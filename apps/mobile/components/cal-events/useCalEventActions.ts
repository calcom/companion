import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert, Platform, Share } from "react-native";
import type { CalEventActions } from "@/components/cal-event-list-item/CalEventListItem";
import { useCancelCalEvent, useDeleteCalEvent, usePublishCalEvent } from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import { ApiRequestError } from "@/services/calcom/request";
import { showErrorAlert, showSilentSuccessAlert, showSuccessAlert } from "@/utils/alerts";
import { openInAppBrowser } from "@/utils/browser";
import { getCalEventEditorUrl } from "@/utils/cal-events";

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A 4xx reason from the Events API is written for users ("Cancel the event … before deleting"). */
const getUserFacingApiReason = (error: unknown) =>
  error instanceof ApiRequestError && error.status < 500
    ? error.message.replace(/^API Error: \d+ /, "")
    : null;

/**
 * The actions an event row and the detail screen share: open, edit on web, copy, share,
 * and the host-only lifecycle changes behind a native confirmation.
 */
export function useCalEventActions(options: { afterDelete?: () => void } = {}): CalEventActions {
  const router = useRouter();
  const { mutate: publish } = usePublishCalEvent();
  const { mutate: cancel } = useCancelCalEvent();
  const { mutate: remove } = useDeleteCalEvent();
  const { afterDelete } = options;

  const onPress = useCallback(
    (event: CalEvent) => {
      router.push({
        pathname: "/event-detail",
        params: { uuid: event.uuid, title: event.title },
      });
    },
    [router]
  );

  const onOpenPage = useCallback(async (event: CalEvent) => {
    try {
      await openInAppBrowser(event.publicUrl, "event page");
    } catch {
      showErrorAlert("Error", "Failed to open the event page. Please try again.");
    }
  }, []);

  const onEditOnWeb = useCallback(async (event: CalEvent) => {
    try {
      await openInAppBrowser(getCalEventEditorUrl(event.uuid), "event editor");
    } catch {
      showErrorAlert("Error", "Failed to open the event editor. Please try again.");
    }
  }, []);

  const onCopyLink = useCallback(async (event: CalEvent) => {
    try {
      await Clipboard.setStringAsync(event.publicUrl);
      showSuccessAlert("Link Copied", "Event link copied!");
    } catch {
      showErrorAlert("Error", "Failed to copy link. Please try again.");
    }
  }, []);

  const onShare = useCallback(async (event: CalEvent) => {
    try {
      await Share.share({ message: `${event.title}: ${event.publicUrl}`, url: event.publicUrl });
    } catch {
      showErrorAlert("Error", "Failed to share the event. Please try again.");
    }
  }, []);

  const onPublish = useCallback(
    (event: CalEvent) => {
      Alert.alert(
        "Publish event",
        `"${event.title}" goes live: its page becomes reachable and guests can RSVP.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Publish",
            onPress: () =>
              publish(event.uuid, {
                onSuccess: () => showSilentSuccessAlert("Published", "Your event is live"),
                onError: (error) => {
                  console.error("Failed to publish cal event", describeError(error));
                  showErrorAlert("Error", "Failed to publish the event. Please try again.");
                },
              }),
          },
        ]
      );
    },
    [publish]
  );

  const runCancel = useCallback(
    (event: CalEvent, reason?: string) =>
      cancel(
        { uuid: event.uuid, reason },
        {
          onSuccess: () => showSilentSuccessAlert("Cancelled", "Your guests have been notified"),
          onError: (error) => {
            console.error("Failed to cancel cal event", describeError(error));
            showErrorAlert("Error", "Failed to cancel the event. Please try again.");
          },
        }
      ),
    [cancel]
  );

  const onCancel = useCallback(
    (event: CalEvent) => {
      const title = "Cancel event";
      const message = `Every registered guest of "${event.title}" is notified. This cannot be undone.`;
      if (Platform.OS === "ios") {
        // The reason goes into the cancellation email; optional.
        Alert.prompt(
          title,
          `${message}\n\nOptionally tell your guests why:`,
          [
            { text: "Keep event", style: "cancel" },
            {
              text: "Cancel event",
              style: "destructive",
              onPress: (reason?: string) => runCancel(event, reason),
            },
          ],
          "plain-text"
        );
        return;
      }
      Alert.alert(title, message, [
        { text: "Keep event", style: "cancel" },
        { text: "Cancel event", style: "destructive", onPress: () => runCancel(event) },
      ]);
    },
    [runCancel]
  );

  const onDelete = useCallback(
    (event: CalEvent) => {
      Alert.alert(
        "Delete event",
        `Are you sure you want to delete "${event.title}"? This action cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () =>
              remove(event.uuid, {
                onSuccess: () => {
                  showSuccessAlert("Success", "Event deleted");
                  afterDelete?.();
                },
                onError: (error) => {
                  console.error("Failed to delete cal event", describeError(error));
                  showErrorAlert(
                    "Error",
                    getUserFacingApiReason(error) ?? "Failed to delete the event. Please try again."
                  );
                },
              }),
          },
        ]
      );
    },
    [remove, afterDelete]
  );

  return { onPress, onOpenPage, onEditOnWeb, onCopyLink, onShare, onPublish, onCancel, onDelete };
}
