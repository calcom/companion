import { joinGrantSchema } from "../join-grant-schema";
import {
  type CallDriver,
  type CallDriverOptions,
  CalVideoError,
  type VideoProvider,
} from "../types";

/**
 * Builds the driver a grant asks for.
 *
 * Transport first, provider second: not every way of carrying media has a vendor behind it. Each
 * provider's SDK is required lazily inside its arm, so the module graph of a call never loads a
 * vendor the grant did not name. The `default` stays even though the parsed type makes it
 * unreachable: a build older than the server must fail legibly, not with `undefined.join()`.
 */
export async function createCallDriver(
  rawGrant: unknown,
  options: CallDriverOptions = {}
): Promise<CallDriver> {
  const grant = joinGrantSchema.parse(rawGrant);

  switch (grant.transport) {
    case "loopback": {
      const { LoopbackCallDriver } = await import("./loopback-call-driver");
      return new LoopbackCallDriver(grant);
    }
    case "sfu":
      switch (grant.provider) {
        case "realtimekit": {
          const { RealtimeKitCallDriver } = await import("./realtimekit-call-driver");
          return new RealtimeKitCallDriver(grant, options);
        }
        case "daily": {
          const { createDailyCallDriver } = await import("./daily-call-driver");
          return createDailyCallDriver(grant);
        }
      }
      break;
  }

  throw new CalVideoError(
    "unsupported-provider",
    "This meeting needs a newer version of the app. Update to continue."
  );
}

/** Which providers this build can actually dial. The UI uses it to word an outcome, nothing more. */
export const SUPPORTED_PROVIDERS: ReadonlySet<VideoProvider> = new Set<VideoProvider>([
  "realtimekit",
]);
