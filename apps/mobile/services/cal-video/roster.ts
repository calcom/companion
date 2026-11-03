import type { CallParticipant } from "./types";

export type RosterPerson = {
  /** The connection: what pinning acts on. */
  id: string;
  displayName: string;
  /** Only ever a Cal-hosted avatar; anything else is initials. */
  avatarUrl: string | null;
  isYou: boolean;
  isHost: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  handRaisedAt: number | null;
  /** What a remove acts on, or `null` where there is nothing safe to target: this driver cannot
   *  name the person behind the connection, or the person is you. */
  removalId: string | null;
};

/** Only an avatar our own servers host is rendered; a peer publishes anything else. */
export function trustedAvatarUrl(
  value: string | null,
  calOrigins: readonly string[]
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return calOrigins.some((origin) => url.origin === origin || url.hostname.endsWith(".cal.com"))
      ? value
      : null;
  } catch {
    return null;
  }
}

/**
 * The people in the call, in the order a host should read them: you first, because the one
 * person a host must never be offered a remove control for is themselves.
 */
export function rosterHere(
  participants: readonly CallParticipant[],
  calOrigins: readonly string[] = []
): RosterPerson[] {
  const yours = participants.find((participant) => participant.isLocal)?.identityId ?? null;
  const people = participants.map((participant) => ({
    id: participant.id,
    displayName: participant.displayName,
    avatarUrl: trustedAvatarUrl(participant.avatarUrl, calOrigins),
    isYou: participant.isLocal,
    isHost: participant.role === "host",
    hasAudio: participant.hasAudio,
    hasVideo: participant.hasVideo,
    isScreenSharing: participant.isScreenSharing,
    handRaisedAt: participant.handRaisedAt,
    // Withheld for your own identity, not merely your own tile: two connections behind one
    // identity are ejected together, so a control on the other is a control to remove yourself.
    removalId: participant.identityId === yours ? null : participant.identityId,
  }));
  return [...people].sort((left, right) => Number(right.isYou) - Number(left.isYou));
}

/** Everyone whose hand is up, first raised first. */
export function raisedHands(here: readonly RosterPerson[]): RosterPerson[] {
  return here
    .filter((person) => person.handRaisedAt !== null)
    .sort(
      (left, right) =>
        (left.handRaisedAt ?? 0) - (right.handRaisedAt ?? 0) || (left.id < right.id ? -1 : 1)
    );
}

export type ParticipantMark = "hand-raised" | "pinned" | "sharing" | "camera-off" | "muted";

/** The marks on one person's row, in the order they are read. `video: false` in an audio room. */
export function participantMarks(input: {
  person: RosterPerson;
  pinned: boolean;
  video?: boolean;
}): ParticipantMark[] {
  const { person } = input;
  const marks: ParticipantMark[] = [];
  if (person.handRaisedAt !== null) marks.push("hand-raised");
  if (input.pinned) marks.push("pinned");
  if (person.isScreenSharing) marks.push("sharing");
  if (input.video !== false && !person.hasVideo) marks.push("camera-off");
  if (!person.hasAudio) marks.push("muted");
  return marks;
}

export type ParticipantAction =
  | "lower-hand"
  | "pin-for-everyone"
  | "unpin-for-everyone"
  | "pin-for-me"
  | "unpin-for-me"
  | "mute"
  | "stop-screen-share"
  | "chat-mute"
  | "chat-unmute"
  | "remove";

/**
 * What the menu on one person offers, in order. Pinning is a view choice anyone can make for
 * themselves. Everything that reaches another person's screen or media needs `canModerate`, and
 * only ever switches something off.
 */
export function participantActions(input: {
  person: RosterPerson;
  canModerate: boolean;
  canRemove: boolean;
  sharedPinIds: readonly string[];
  localPinIds: readonly string[];
  /** False in an audio room, whose faces are all the same size and have no stage to pin to. */
  canPin?: boolean;
  /** Identities muted in durable chat; absent where durable chat is off or the viewer may not mute. */
  chatMutedIds?: ReadonlySet<string> | null;
}): ParticipantAction[] {
  const { person, canModerate } = input;
  const canPin = input.canPin !== false;
  const actions: ParticipantAction[] = [];
  if (canModerate && !person.isYou && person.handRaisedAt !== null) actions.push("lower-hand");
  if (canPin && canModerate) {
    actions.push(
      input.sharedPinIds.includes(person.id) ? "unpin-for-everyone" : "pin-for-everyone"
    );
  }
  if (canPin && !(canModerate && input.sharedPinIds.includes(person.id))) {
    actions.push(input.localPinIds.includes(person.id) ? "unpin-for-me" : "pin-for-me");
  }
  if (canModerate && !person.isYou && person.hasAudio) actions.push("mute");
  if (canModerate && !person.isYou && person.isScreenSharing) actions.push("stop-screen-share");
  // Chat mute targets the identity, which durable chat also keys on; hosts are never muted.
  if (input.chatMutedIds && person.removalId !== null && !person.isHost) {
    actions.push(input.chatMutedIds.has(person.removalId) ? "chat-unmute" : "chat-mute");
  }
  if (input.canRemove && person.removalId !== null && !person.isHost) actions.push("remove");
  return actions;
}

/** Case- and accent-insensitive, anywhere in the name: "ren" finds "Renée". */
export function filterRoster<T extends { displayName: string }>(
  people: readonly T[],
  query: string
): T[] {
  const fold = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase();
  const needle = fold(query.trim());
  if (!needle) return [...people];
  return people.filter((person) => fold(person.displayName).includes(needle));
}
