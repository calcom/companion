import { useCallback, useState } from "react";
import {
  type CalVideoLink,
  type CalVideoRoomLink,
  parseCalVideoLink,
} from "@/utils/cal-video-links";
import { BookingLinkScreen } from "./BookingLinkScreen";
import { VideoCallScreen } from "./VideoCallScreen";

/**
 * Where every Cal Video link enters: a room joins straight away; a booking's meeting link is
 * resolved first and joins the room it names.
 */
export function CalVideoEntry({
  link,
  viewerName,
  viewerAvatarUrl,
  accessToken,
  onClose,
}: {
  link: CalVideoLink;
  viewerName: string | null;
  viewerAvatarUrl: string | null;
  accessToken: string | null;
  onClose: () => void;
}) {
  const [resolvedRoom, setResolvedRoom] = useState<CalVideoRoomLink | null>(null);
  const onRoom = useCallback((roomUrl: string) => {
    const room = parseCalVideoLink(roomUrl);
    if (room?.kind === "room") setResolvedRoom(room);
  }, []);

  const room = link.kind === "room" ? link : resolvedRoom;
  if (!room) {
    if (link.kind !== "booking") return null;
    return <BookingLinkScreen link={link} onRoom={onRoom} onClose={onClose} />;
  }
  return (
    <VideoCallScreen
      link={room}
      viewerName={viewerName}
      viewerAvatarUrl={viewerAvatarUrl}
      accessToken={accessToken}
      onClose={onClose}
    />
  );
}
