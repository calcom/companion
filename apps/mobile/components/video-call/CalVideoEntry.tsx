import { useCallback, useState } from "react";
import type { CalVideoBookingCall } from "@/services/cal-video/booking-link";
import {
  type CalVideoLink,
  type CalVideoRoomLink,
  parseCalVideoLink,
} from "@/utils/cal-video-links";
import { BookingLinkScreen } from "./BookingLinkScreen";
import { VideoCallScreen } from "./VideoCallScreen";

/**
 * Where every Cal Video link enters: a room joins straight away; a booking's meeting link is
 * resolved first, then joins the room it names or, for a Cal Video 2.0 booking, its call.
 */
export function CalVideoEntry({
  link,
  viewerName,
  viewerAvatarUrl,
  accessToken,
  getAccessToken,
  onClose,
}: {
  link: CalVideoLink;
  viewerName: string | null;
  viewerAvatarUrl: string | null;
  accessToken: string | null;
  getAccessToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [resolved, setResolved] = useState<CalVideoRoomLink | CalVideoBookingCall | null>(null);
  const onRoom = useCallback((roomUrl: string) => {
    const room = parseCalVideoLink(roomUrl);
    if (room?.kind === "room") setResolved(room);
  }, []);

  const target = link.kind === "room" ? link : resolved;
  if (!target) {
    if (link.kind !== "booking") return null;
    return (
      <BookingLinkScreen
        link={link}
        onRoom={onRoom}
        onBookingCall={setResolved}
        onClose={onClose}
      />
    );
  }
  return (
    <VideoCallScreen
      link={target}
      viewerName={viewerName}
      viewerAvatarUrl={viewerAvatarUrl}
      accessToken={accessToken}
      getAccessToken={getAccessToken}
      onClose={onClose}
    />
  );
}
