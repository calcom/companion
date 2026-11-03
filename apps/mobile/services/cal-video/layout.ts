import type { CallParticipant } from "./types";

/** What the person chose: a grid of everyone, or whoever matters most on a stage. */
export type LayoutChoice = "auto" | "speaker";

/** What holds the stage, in precedence order: a shared screen, a pin, the followed speaker. */
export type Staged =
  | { kind: "screen"; participant: CallParticipant }
  | { kind: "pin"; participant: CallParticipant }
  | { kind: "speaker"; participant: CallParticipant };

export interface StageLayout {
  staged: Staged | null;
  /** Everyone else, in a stable order: the staged person first when they have a tile, then the rest. */
  strip: CallParticipant[];
}

/** Newest share first: of two sharers, the newest holds the stage. */
export function sharerOrder(participants: readonly CallParticipant[]): CallParticipant[] {
  return participants
    .filter((participant) => participant.isScreenSharing)
    .sort(
      (left, right) =>
        (right.screenShareStartedAt ?? 0) - (left.screenShareStartedAt ?? 0) ||
        (left.id < right.id ? -1 : 1)
    );
}

/**
 * The view, decided once, so the grid, the people list and the tile menus agree on who holds the
 * stage. A share beats a pin beats the speaker, as on the web. In `auto` nobody is followed: the
 * grid stays a grid however long one person talks, and only a share or a pin makes a stage.
 */
export function resolveStage(input: {
  choice: LayoutChoice;
  participants: readonly CallParticipant[];
  /** The pins for everyone first, then your own, in the order they were made. */
  pinnedIds: readonly string[];
  /** Whoever the SFU nominates, or `null`. */
  dominantSpeakerId: string | null;
  /** Who held the speaker stage last time, so a pause does not swap the stage every second. */
  previousSpeakerId?: string | null;
}): StageLayout {
  const { participants } = input;
  const byId = new Map(participants.map((participant) => [participant.id, participant]));

  let staged: Staged | null = null;
  const [sharer] = sharerOrder(participants);
  if (sharer) staged = { kind: "screen", participant: sharer };
  else {
    const pinned = input.pinnedIds.map((id) => byId.get(id)).find(Boolean);
    if (pinned) staged = { kind: "pin", participant: pinned };
    else if (input.choice === "speaker") {
      // Never follow yourself: a stage of your own face is a mirror, not a meeting.
      const remote = (id: string | null | undefined) => {
        const candidate = id ? byId.get(id) : undefined;
        return candidate && !candidate.isLocal ? candidate : undefined;
      };
      const others = participants.filter((participant) => !participant.isLocal);
      const followed =
        remote(input.dominantSpeakerId) ??
        remote(input.previousSpeakerId) ??
        others.find((participant) => participant.hasVideo) ??
        others[0];
      if (followed) staged = { kind: "speaker", participant: followed };
    }
  }

  // A shared screen is not its sharer's face, so the sharer keeps a tile in the strip.
  const stagedTileId = staged && staged.kind !== "screen" ? staged.participant.id : null;
  const strip = participants.filter((participant) => participant.id !== stagedTileId);
  return { staged, strip };
}

/** How many columns a grid of `count` tiles gets on a phone: one when alone, two otherwise. */
export function gridColumns(count: number): number {
  return count <= 1 ? 1 : 2;
}
