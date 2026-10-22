/**
 * Which live stream links an event accepts, ported from the web's check
 * (`packages/features/cal-events/lib/live-stream-input-validation-adapter.ts` and
 * `live-stream-thumbnail.ts`): YouTube, Twitch, X and Restream links only, so the form says so
 * before Save, as the web does, rather than the API turning the save down.
 *
 * Parsed with a pattern rather than `new URL`: React Native's URL accepts almost anything.
 */

export const CAL_EVENT_LIVE_STREAM_URL_MAX_LENGTH = 2048;

export const CAL_EVENT_LIVE_STREAM_INVALID =
  "Enter a valid YouTube, Twitch, X, or Restream stream URL";
export const CAL_EVENT_LIVE_STREAM_TOO_LONG = "Enter a stream URL under 2,048 characters";

const HTTP_URL =
  /^https?:\/\/(?:[^@/?#\s]*@)?([^:/?#\s]+)(?::(\d*))?(\/[^?#\s]*)?(\?[^#\s]*)?(#\S*)?$/i;
/** The highest port, past which the browser's URL turns a link down. */
const MAX_PORT = 65535;
const YOUTUBE_VIDEO_ID = /^[\w-]{1,64}$/;
const TWITCH_CHANNEL = /^[a-z0-9_]{1,25}$/i;
const NUMERIC_ID = /^\d+$/;
const X_HANDLE = /^[a-z0-9_]{1,15}$/i;
const RESTREAM_WEBINAR_ID = /^[a-z0-9-]{1,64}$/i;

interface ParsedUrl {
  host: string;
  path: string;
  segments: string[];
  query: string;
}

function parseHttpUrl(input: string): ParsedUrl | null {
  const match = HTTP_URL.exec(input);
  if (!match) return null;
  const [, host, port, pathname, query] = match;
  // An empty port (`host:/path`) is fine, as in the browser.
  if (port && Number(port) > MAX_PORT) return null;
  const path = pathname || "/";
  return {
    host: host.toLowerCase(),
    path,
    segments: path.split("/").filter(Boolean),
    query: query ?? "",
  };
}

function decodeQueryPart(part: string): string | null {
  try {
    return decodeURIComponent(part.replace(/\+/g, " "));
  } catch {
    // A malformed escape. The browser keeps it as typed, and no id has a "%" either way.
    return null;
  }
}

/** The first value of `name`, read as URLSearchParams.get reads it. */
function queryParam(query: string, name: string): string | null {
  for (const pair of query.replace(/^\?/, "").split("&")) {
    // Only the first "=" splits: the value is everything after it, other "=" included.
    const split = pair.indexOf("=");
    const key = split === -1 ? pair : pair.slice(0, split);
    if (decodeQueryPart(key) !== name) continue;
    return decodeQueryPart(split === -1 ? "" : pair.slice(split + 1));
  }
  return null;
}

function isYouTube({ host, path, segments, query }: ParsedUrl): boolean {
  let videoId: string | null = null;
  if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") {
    if (path === "/watch") videoId = queryParam(query, "v");
    else if (segments.length === 2 && (segments[0] === "embed" || segments[0] === "live")) {
      videoId = segments[1];
    }
  } else if ((host === "youtu.be" || host === "www.youtu.be") && segments.length === 1) {
    videoId = segments[0];
  }
  return !!videoId && YOUTUBE_VIDEO_ID.test(videoId);
}

function isTwitch({ host, segments }: ParsedUrl): boolean {
  if (host !== "twitch.tv" && host !== "www.twitch.tv") return false;
  if (segments.length === 1) return TWITCH_CHANNEL.test(segments[0]);
  return segments.length === 2 && segments[0] === "videos" && NUMERIC_ID.test(segments[1]);
}

function isXPost({ host, segments }: ParsedUrl): boolean {
  if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(host)) return false;
  return (
    segments.length === 3 &&
    segments[1] === "status" &&
    X_HANDLE.test(segments[0]) &&
    NUMERIC_ID.test(segments[2])
  );
}

function isRestreamWebinar({ host, segments }: ParsedUrl): boolean {
  return (
    host === "studio.restream.io" &&
    segments.length === 2 &&
    segments[0] === "webinar" &&
    RESTREAM_WEBINAR_ID.test(segments[1])
  );
}

/** What's wrong with one live stream link, or null when it's fine (or still empty). */
export function getCalEventLiveStreamError(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.length > CAL_EVENT_LIVE_STREAM_URL_MAX_LENGTH) return CAL_EVENT_LIVE_STREAM_TOO_LONG;
  const parsed = parseHttpUrl(trimmed);
  const supported =
    !!parsed &&
    (isYouTube(parsed) || isTwitch(parsed) || isXPost(parsed) || isRestreamWebinar(parsed));
  return supported ? null : CAL_EVENT_LIVE_STREAM_INVALID;
}
