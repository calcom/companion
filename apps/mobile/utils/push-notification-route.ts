type PushNotificationRoute =
  | { kind: "booking"; uid: string }
  | { kind: "cal-event"; uuid: string }
  | { kind: "web"; url: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Cal's short-uuid editor links use the default Flickr base58 alphabet, padded to 22 digits.
const SHORT_UUID_ALPHABET = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

function eventUuid(id: string): string | null {
  if (UUID.test(id)) return id.toLowerCase();
  if (id.length !== 22) return null;
  let value = 0n;
  for (const digit of id) {
    const index = SHORT_UUID_ALPHABET.indexOf(digit);
    if (index < 0) return null;
    value = value * 58n + BigInt(index);
  }
  const hex = value.toString(16).padStart(32, "0");
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getPushNotificationRoute(
  url: string,
  trustedHostnames: ReadonlySet<string>
): PushNotificationRoute | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Keep Expo Linking.parse's decoding and last-uid-wins behavior for existing booking links.
  let uid: string | undefined;
  try {
    parsed.searchParams.forEach((value, key) => {
      const decoded = decodeURIComponent(value);
      if (key === "uid") uid = decoded;
    });
  } catch {
    // Linking.parse retains query parameters read before a malformed escape.
  }
  if (uid) return { kind: "booking", uid };
  if (
    parsed.protocol !== "https:" ||
    !trustedHostnames.has(parsed.hostname) ||
    parsed.port ||
    parsed.username ||
    parsed.password
  )
    return null;
  const eventPath = /^\/events\/([^/]+)\/?$/.exec(parsed.pathname);
  const uuid = eventPath ? eventUuid(eventPath[1]) : null;
  return uuid ? { kind: "cal-event", uuid } : { kind: "web", url };
}
