/** Mirrors NextCallPayload in ios/NextCallLiveActivityModule.swift. */
export interface NextCallLiveActivityPayload {
  uid: string;
  title: string;
  /** ISO 8601 */
  startTime: string;
  /** ISO 8601 */
  endTime: string;
  attendeeName: string | null;
  attendeeCount: number;
  locationLabel: string | null;
  isVideo: boolean;
  deepLinkUrl: string;
}
