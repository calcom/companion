import { Hand, MicOff, MonitorUp, MoreHorizontal, Pin, VideoOff, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type ParticipantAction,
  type ParticipantMark,
  participantMarks,
  type RosterPerson,
} from "@/services/cal-video/roster";
import { type WaitingEntry, waitingEntryKey } from "@/services/cal-video/waiting-list";
import { CallAvatar } from "./Avatar";

const MARK_ICON = {
  "hand-raised": Hand,
  pinned: Pin,
  sharing: MonitorUp,
  "camera-off": VideoOff,
  muted: MicOff,
} satisfies Record<ParticipantMark, typeof Pin>;

function Marks({
  person,
  pinned,
  video,
}: {
  person: RosterPerson;
  pinned: boolean;
  video: boolean;
}) {
  return (
    <View style={styles.marks}>
      {participantMarks({ person, pinned, video }).map((mark) => {
        const Icon = MARK_ICON[mark];
        return <Icon key={mark} size={14} color="rgba(255,255,255,0.55)" />;
      })}
    </View>
  );
}

/**
 * Who is in this meeting and who wants to be, with what can be done about each of them. A sheet
 * rather than a popover: a host moderates while watching the call, and comes back to it.
 */
export function PeopleSheet({
  visible,
  here,
  waiting,
  failed,
  pinnedIds,
  video,
  actionsFor,
  onAction,
  onDecide,
  onClose,
}: {
  visible: boolean;
  here: RosterPerson[];
  waiting: WaitingEntry[];
  /** The decision the server last refused, by `waitingEntryKey`. */
  failed: ReadonlyMap<string, "admit" | "deny">;
  pinnedIds: readonly string[];
  /** False in an audio room: no pinning, and no camera to report as off. */
  video: boolean;
  actionsFor: (person: RosterPerson) => ParticipantAction[];
  onAction: (person: RosterPerson, actions: ParticipantAction[]) => void;
  onDecide: (entry: WaitingEntry, decision: "admit" | "deny") => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>People</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={10}
            style={styles.close}
          >
            <X size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {waiting.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Waiting to join ({waiting.length})</Text>
              {waiting.map((entry) => {
                const key = waitingEntryKey(entry);
                const refused = failed.get(key);
                return (
                  <View key={key} style={styles.row}>
                    <CallAvatar name={entry.displayName} url={null} size={36} />
                    <View style={styles.rowText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {entry.displayName}
                      </Text>
                      {refused && (
                        <Text style={styles.refused}>
                          {refused === "admit"
                            ? "Couldn't admit. Try again."
                            : "Couldn't deny. Try again."}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onDecide(entry, "admit")}
                      style={styles.admit}
                    >
                      <Text style={styles.admitText}>Admit</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onDecide(entry, "deny")}
                      style={styles.deny}
                    >
                      <Text style={styles.denyText}>Deny</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>In the meeting ({here.length})</Text>
            {here.map((person) => {
              const actions = actionsFor(person);
              const subtitle = [person.isYou && "You", person.isHost && "Host"]
                .filter(Boolean)
                .join(" · ");
              return (
                <View key={person.id} style={styles.row}>
                  <CallAvatar name={person.displayName} url={person.avatarUrl} size={36} />
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {person.displayName}
                    </Text>
                    {subtitle.length > 0 && <Text style={styles.subtitle}>{subtitle}</Text>}
                  </View>
                  <Marks person={person} pinned={pinnedIds.includes(person.id)} video={video} />
                  {actions.length > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Options for ${person.displayName}`}
                      onPress={() => onAction(person, actions)}
                      hitSlop={8}
                      style={styles.more}
                    >
                      <MoreHorizontal size={18} color="#FFFFFF" />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111113" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  title: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: 20, gap: 20 },
  section: { gap: 4 },
  sectionTitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: "#FFFFFF", fontSize: 16 },
  subtitle: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 1 },
  refused: { color: "#FF453A", fontSize: 12, marginTop: 1 },
  marks: { flexDirection: "row", gap: 6 },
  more: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  admit: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  admitText: { color: "#111111", fontSize: 14, fontWeight: "600" },
  deny: { paddingHorizontal: 10, paddingVertical: 8 },
  denyText: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
});
