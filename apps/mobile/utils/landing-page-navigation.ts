import type { LandingPage } from "@/hooks/useUserPreferences";

export type InitialLandingRedirectDecision = "wait" | "skip" | "redirect";

type InitialLandingRedirectDecisionInput = {
  landingPage: LandingPage;
  segments: readonly string[];
};

const TABS_SEGMENT = "(tabs)";
const BOOKINGS_SEGMENT = "(bookings)";
const INDEX_SEGMENT = "index";

function isTabsRoot(segments: readonly string[]): boolean {
  return segments.length === 1 && segments[0] === TABS_SEGMENT;
}

function isDefaultBookingsIndex(segments: readonly string[]): boolean {
  return (
    segments[0] === TABS_SEGMENT &&
    segments[1] === BOOKINGS_SEGMENT &&
    (segments.length === 2 || (segments.length === 3 && segments[2] === INDEX_SEGMENT))
  );
}

export function getInitialLandingRedirectDecision({
  landingPage,
  segments,
}: InitialLandingRedirectDecisionInput): InitialLandingRedirectDecision {
  if (segments.length === 0 || segments[0] !== TABS_SEGMENT) {
    return "wait";
  }

  if (!isTabsRoot(segments) && !isDefaultBookingsIndex(segments)) {
    return "skip";
  }

  return landingPage === "bookings" ? "skip" : "redirect";
}
