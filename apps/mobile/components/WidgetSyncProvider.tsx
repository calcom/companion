import { useEffect } from "react";
import { useWidgetSync } from "@/hooks/useWidgetSync";
import { syncNextCallLiveActivity } from "@/services/nextCallLiveActivity";

// Dev-only: `EXPO_PUBLIC_DEMO_LIVE_ACTIVITY=1 expo start` fakes a booking four minutes out so
// the iOS Live Activity can be exercised on a simulator, where signing in is not possible.
const DEMO_LIVE_ACTIVITY = __DEV__ && process.env.EXPO_PUBLIC_DEMO_LIVE_ACTIVITY === "1";

export function WidgetSyncProvider({ children }: { children: React.ReactNode }) {
  useWidgetSync();
  useEffect(() => {
    if (!DEMO_LIVE_ACTIVITY) return;
    const start = new Date(Date.now() + 4 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    syncNextCallLiveActivity([
      {
        id: 1,
        uid: "demo-live-activity",
        title: "Product Review",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: "accepted",
        location: "https://app.cal.com/video/demo",
        attendees: [
          { name: "Jane Smith", email: "jane@example.com", timeZone: "UTC" },
          { name: "John Doe", email: "john@example.com", timeZone: "UTC" },
          { name: "Ada Lovelace", email: "ada@example.com", timeZone: "UTC" },
        ],
      },
    ]).catch((error) => console.warn("Demo Live Activity failed:", error));
  }, []);
  return <>{children}</>;
}
