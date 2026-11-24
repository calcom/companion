/**
 * Whether this build can publish the screen.
 *
 * Android captures through RealtimeKit's foreground service, so the SDK alone suffices. iOS can
 * capture only from a Broadcast Upload Extension; the main app names it in Info.plist under
 * `RTCAppScreenSharingExtension`, which is also what the system picker is pointed at. A build
 * without that key would open a picker that finds no broadcaster and time out, so the control is
 * hidden instead.
 */
export function canPublishScreen(input: {
  platform: string;
  infoPlist: Record<string, unknown> | null | undefined;
}): boolean {
  if (input.platform === "android") return true;
  if (input.platform !== "ios") return false;
  const extension = input.infoPlist?.RTCAppScreenSharingExtension;
  return typeof extension === "string" && extension.length > 0;
}
