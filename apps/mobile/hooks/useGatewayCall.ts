import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { toCalChatParticipantId } from "@/services/cal-video/cal-chat/participant-id";
import type {
  CalChatCallFrame,
  CalChatClientFrame,
  TranscriptionState,
} from "@/services/cal-video/cal-chat/types";
import { appendCaption } from "@/services/cal-video/captions";
import { queueReaction, REACTION_FLUSH_MS } from "@/services/cal-video/reactions";
import type {
  CallParticipant,
  CaptionLine,
  Reaction,
  ReactionEmoji,
} from "@/services/cal-video/types";

export function useGatewayCall({
  sessionId,
  participants,
  providerReactions,
}: {
  sessionId: string | null;
  participants: readonly CallParticipant[];
  providerReactions: boolean;
}) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [transcription, setTranscription] = useState<TranscriptionState | null>(null);
  const latest = useRef<TranscriptionState | null>(null);
  const speakers = useRef(new Map<string, CallParticipant>());
  const speakersReady = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef<{ emoji: ReactionEmoji; count: number }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendFrame = useRef<((frame: CalChatClientFrame) => boolean) | null>(null);
  useEffect(() => {
    const index = new Map<string, CallParticipant>();
    const ready = Promise.all(
      participants.map(async (person) => {
        if (person.identityId) index.set(await toCalChatParticipantId(person.identityId), person);
      })
    );
    speakers.current = index;
    speakersReady.current = ready.then(() => undefined).catch(() => undefined);
    return () => {
      if (speakers.current === index) speakers.current = new Map();
    };
  }, [participants]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: changing sessions discards ephemeral call state
  useEffect(() => {
    setReactions([]);
    setLines([]);
    setTranscription(null);
    latest.current = null;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = [];
    };
  }, [sessionId]);
  const receiveState = useCallback((state: TranscriptionState) => {
    if (latest.current && state.version < latest.current.version) return;
    if (!state.on || state.epoch !== latest.current?.epoch) setLines([]);
    latest.current = state;
    setTranscription(state);
  }, []);
  const onFrame = useCallback(
    (frame: CalChatCallFrame) => {
      if (frame.type === "transcription.state") return receiveState(frame.state);
      const epoch = latest.current?.epoch;
      void (async () => {
        let ready: Promise<void>;
        do {
          ready = speakersReady.current;
          await ready;
        } while (ready !== speakersReady.current);
        if (frame.type === "reaction") {
          if (providerReactions) return;
          const person = speakers.current.get(frame.participantId);
          if (!person || person.isLocal) return;
          setReactions((before) =>
            [
              ...before,
              {
                id: randomUUID(),
                participantId: person.id,
                emoji: frame.emoji,
                count: frame.count,
                at: Date.now(),
              },
            ].slice(-32)
          );
          return;
        }
        if (!latest.current?.on || epoch !== latest.current.epoch) return;
        const person = speakers.current.get(frame.caption.participantId);
        if (!person) return;
        setLines((before) => {
          const id = `${frame.caption.participantId}:${frame.caption.seq}`;
          if (before.some((line) => line.id === id && line.final)) return before;
          return appendCaption(before, {
            id,
            participantId: person.id,
            participantName: person.displayName,
            text: frame.caption.text,
            final: frame.caption.final,
            at: Date.now(),
          });
        });
      })();
    },
    [providerReactions, receiveState]
  );
  const sendReaction = useCallback(
    (emoji: ReactionEmoji, send: (frame: CalChatClientFrame) => boolean) => {
      const self = participants.find((person) => person.isLocal);
      if (!self) return;
      setReactions((before) =>
        [
          ...before,
          {
            id: randomUUID(),
            participantId: self.id,
            emoji,
            count: 1,
            at: Date.now(),
          },
        ].slice(-32)
      );
      sendFrame.current = send;
      const flush = () => {
        const next = pending.current.shift();
        if (next) sendFrame.current?.({ type: "reaction", ...next });
        timer.current = pending.current.length ? setTimeout(flush, REACTION_FLUSH_MS) : null;
      };
      if (!timer.current) {
        send({ type: "reaction", emoji, count: 1 });
        timer.current = setTimeout(flush, REACTION_FLUSH_MS);
      } else pending.current = queueReaction(pending.current, emoji).slice(-100);
    },
    [participants]
  );
  return { reactions, lines, transcription, receiveState, onFrame, sendReaction };
}
