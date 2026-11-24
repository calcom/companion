import { type Href, useRouter } from "expo-router";
import { useCallback } from "react";
import { Linking, Platform } from "react-native";
import { showErrorAlert } from "@/utils/alerts";
import { buildVideoCallHref, parseCalVideoLink } from "@/utils/cal-video-links";

/** Opens a booking's meeting link: Cal Video in the app's call screen, anything else outside it. */
export function useOpenMeetingLink() {
  const router = useRouter();
  return useCallback(
    (url: string) => {
      const calVideoLink = Platform.OS === "web" ? null : parseCalVideoLink(url);
      if (calVideoLink) {
        router.push(buildVideoCallHref(calVideoLink) as Href);
        return;
      }
      Linking.openURL(url).catch(() => {
        showErrorAlert("Error", "Failed to open meeting link. Please try again.");
      });
    },
    [router]
  );
}
