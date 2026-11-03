import * as Linking from "expo-linking";
import { useEffect, useState } from "react";

export interface IncomingLink {
  url: string;
  /** Bumps on every arrival, so the same link tapped twice is two arrivals, not one. */
  seq: number;
}

/**
 * The URL that opened or was sent to the app, with a sequence number. `useLinkingURL` alone
 * cannot tell a second tap on the same link from the first, so a meeting dismissed once could
 * never be opened from that link again.
 */
export function useIncomingLink(): IncomingLink | null {
  const initial = Linking.useLinkingURL();
  const [arrival, setArrival] = useState<IncomingLink | null>(null);
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      setArrival((current) => ({ url, seq: (current?.seq ?? 0) + 1 }));
    });
    return () => subscription.remove();
  }, []);
  if (arrival) return arrival;
  return initial ? { url: initial, seq: 0 } : null;
}
