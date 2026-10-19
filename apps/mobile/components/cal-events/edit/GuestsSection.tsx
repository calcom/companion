import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useApproveAllCalEventRegistrations, useCalEventRoster } from "@/hooks";
import type {
  CalEvent,
  CalEventLocation,
  CalEventRosterGuest,
  CalEventRsvpResponse,
} from "@/services/calcom";
import { showInfoAlert } from "@/utils/alerts";
import {
  buildRosterCsv,
  CAL_EVENT_RSVP_LABELS,
  countRosterByRsvp,
  filterRoster,
  formatGuestDateTime,
  formatRelativeTime,
  GUEST_RSVP_FILTERS,
  type GuestLocationOption,
  type GuestRsvpFilter,
  getApproveAllMessage,
  getGuestAnswerEntries,
  getGuestContact,
  getGuestDisplayName,
  getGuestInitial,
  getGuestLocationLabel,
  getGuestLocationOptions,
  getRosterPage,
  isValidInviteEmail,
  rosterCsvFilename,
} from "@/utils/cal-event-guests";
import { getCalEventStatusColors } from "@/utils/cal-events";
import { getUserFacingApiReason } from "../useCalEventActions";
import { EditTextField, useEditTheme } from "./EditControls";
import { SelectField } from "./SelectField";

/** The web's badge variants: Going is success, Maybe warning, Not going error. */
const RSVP_BADGE_STATUS = {
  YES: "published",
  MAYBE: "draft",
  NO: "cancelled",
} as const satisfies Record<CalEventRsvpResponse, Parameters<typeof getCalEventStatusColors>[0]>;

/**
 * The web editor's Guests tab at phone width: search, the guest actions, a location filter, RSVP
 * chips and a paged list whose rows expand to the guest's details. The roster lists confirmed
 * guests only; invite, message and approve all apply at once and never touch Save.
 */
type GuestsSectionProps = {
  event: CalEvent;
  locations: CalEventLocation[];
  /** After a page turn, so the new page shows from its first row. */
  onPageChange: () => void;
};

export function GuestsSection({ event, locations, onPageChange }: GuestsSectionProps) {
  const theme = useEditTheme();
  if (event.publishedAt === null) {
    return (
      <View
        style={{
          alignItems: "center",
          gap: 12,
          paddingVertical: 48,
          paddingHorizontal: 24,
          borderRadius: 16,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: theme.border,
        }}
      >
        <Ionicons name="people-outline" size={32} color={theme.textSecondary} />
        <Text style={{ color: theme.textSecondary, fontSize: 15, textAlign: "center" }}>
          Publish this event to invite guests and manage the roster.
        </Text>
      </View>
    );
  }
  return <GuestRoster event={event} locations={locations} onPageChange={onPageChange} />;
}

function GuestRoster({ event, locations, onPageChange }: GuestsSectionProps) {
  const theme = useEditTheme();
  const router = useRouter();
  const roster = useCalEventRoster(event.uuid);
  const { mutate: approveAll, isPending: approving } = useApproveAllCalEventRegistrations();
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [rsvp, setRsvp] = useState<GuestRsvpFilter>("ALL");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const guests = roster.data ?? [];
  const locationOptions = getGuestLocationOptions(locations);
  // A filter on a location that was since removed would hide every guest.
  const activeLocationId = locationOptions.some((option) => option.id === locationId)
    ? locationId
    : null;
  const filtered = filterRoster(guests, { search, locationId: activeLocationId, rsvp });
  const counts = countRosterByRsvp(guests, { search, locationId: activeLocationId });
  const current = getRosterPage(filtered, page);
  const narrowed = search.trim() !== "" || activeLocationId !== null || rsvp !== "ALL";
  // Like the web's search box: an address nobody registered with can be invited from there.
  const searchEmail = search.trim();
  const inviteFromSearch =
    isValidInviteEmail(searchEmail) &&
    !guests.some((guest) => guest.email.toLowerCase() === searchEmail.toLowerCase());

  // A new narrowing starts over at the first page and closes the open row.
  const narrow = (apply: () => void) => {
    apply();
    setPage(0);
    setExpandedId(null);
  };

  const openInvite = (email?: string) =>
    router.push({
      pathname: "/cal-event-invite-guests",
      params: email ? { uuid: event.uuid, email } : { uuid: event.uuid },
    });

  const confirmApproveAll = () => {
    Alert.alert(
      "Approve all pending guests?",
      "Approve every pending guest in registration order.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve all",
          onPress: () =>
            approveAll(
              {
                uuid: event.uuid,
                input: { search, locationId: activeLocationId ?? undefined },
              },
              {
                onSuccess: (result) => showInfoAlert("Approve all", getApproveAllMessage(result)),
                onError: (error) =>
                  showInfoAlert(
                    "Error",
                    getUserFacingApiReason(error) ?? "Failed to approve guests. Please try again."
                  ),
              }
            ),
        },
      ]
    );
  };

  const download = () => {
    if (!roster.data) return;
    const csv = buildRosterCsv(roster.data, event, locations);
    const filename = rosterCsvFilename(event.slug);
    // Android's share sheet takes no file URL, so the CSV goes as text there.
    const shared =
      Platform.OS === "ios"
        ? writeCsv(filename, csv).then((url) => ({ url }))
        : Promise.resolve({ message: csv, title: filename });
    shared
      .then((content) => Share.share(content))
      .catch(() => showInfoAlert("Error", "Failed to export the guest list. Please try again."));
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <EditTextField
          value={search}
          onChangeText={(next) => narrow(() => setSearch(next))}
          placeholder="Search guests"
          autoCapitalize="none"
          accessibilityLabel="Search guests"
          leading={<Ionicons name="search" size={18} color={theme.textMuted} />}
          trailing={
            search ? (
              <Pressable
                onPress={() => narrow(() => setSearch(""))}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            ) : null
          }
        />
        {inviteFromSearch ? (
          <Pressable
            onPress={() => openInvite(searchEmail)}
            accessibilityRole="button"
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}
          >
            <Ionicons name="person-add-outline" size={18} color={theme.accent} />
            <Text style={{ flex: 1, color: theme.accent, fontSize: 15 }} numberOfLines={1}>
              Invite {searchEmail} as a guest
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <ToolbarButton label="Invite guests" primary onPress={() => openInvite()} />
        <ToolbarButton
          label="Message guests"
          onPress={() =>
            router.push({ pathname: "/cal-event-message-guests", params: { uuid: event.uuid } })
          }
        />
        <ToolbarButton
          label="Sent messages"
          onPress={() =>
            router.push({ pathname: "/cal-event-sent-messages", params: { uuid: event.uuid } })
          }
        />
        <ToolbarButton label="Approve all" busy={approving} onPress={confirmApproveAll} />
        <ToolbarButton
          label="Download"
          icon="download-outline"
          disabled={!roster.data}
          onPress={download}
        />
      </View>

      {locationOptions.length > 0 ? (
        <SelectField<string | null>
          label="Filter by location"
          options={[
            { value: null, label: "All locations" },
            ...locationOptions.map((option) => ({ value: option.id, label: option.label })),
          ]}
          value={activeLocationId}
          onChange={(next) => narrow(() => setLocationId(next))}
        />
      ) : null}

      <RsvpChips value={rsvp} counts={counts} onChange={(next) => narrow(() => setRsvp(next))} />

      {roster.isPending ? (
        <GuestCard>
          {[0, 1, 2].map((key) => (
            <SkeletonRow key={key} first={key === 0} />
          ))}
        </GuestCard>
      ) : roster.isError && !roster.data ? (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 32 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 15, textAlign: "center" }}>
            {getUserFacingApiReason(roster.error) ?? "Couldn't load the guest list."}
          </Text>
          <Pressable
            onPress={() => roster.refetch()}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 16,
              height: 36,
              justifyContent: "center",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: "500" }}>Retry</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View
          style={{
            alignItems: "center",
            gap: 10,
            paddingVertical: 40,
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: theme.border,
          }}
        >
          <Ionicons name="people-outline" size={28} color={theme.textSecondary} />
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
            {narrowed ? "No attendees match your search" : "No guests yet"}
          </Text>
        </View>
      ) : (
        <GuestCard
          footer={
            <Pagination
              range={current.range}
              page={current.page}
              pageCount={current.pageCount}
              onPageChange={(next) => {
                setPage(next);
                setExpandedId(null);
                onPageChange();
              }}
            />
          }
        >
          {current.rows.map((guest, index) => (
            <GuestRow
              key={guest.registrationId}
              guest={guest}
              first={index === 0}
              event={event}
              locationOptions={locationOptions}
              expanded={expandedId === guest.registrationId}
              onToggle={() =>
                setExpandedId((open) =>
                  open === guest.registrationId ? null : guest.registrationId
                )
              }
            />
          ))}
        </GuestCard>
      )}
    </View>
  );
}

/** Writes the CSV to the cache directory and resolves to its URL for the share sheet. */
async function writeCsv(filename: string, csv: string): Promise<string> {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  // As bytes: a string write drops the BOM that tells Excel the file is UTF-8.
  file.write(new TextEncoder().encode(csv));
  return file.uri;
}

function ToolbarButton({
  label,
  icon,
  onPress,
  primary = false,
  disabled = false,
  busy = false,
}: {
  label: string;
  /** Like the web's toolbar, only Download has one. */
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  const theme = useEditTheme();
  const color = primary ? theme.background : theme.text;
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: primary ? theme.text : theme.border,
        backgroundColor: primary ? theme.text : theme.background,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : icon ? (
        <Ionicons name={icon} size={16} color={color} />
      ) : null}
      <Text style={{ color, fontSize: 15, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

/** The web's phone filter tabs with their counts, in the Events tab's chip style. */
function RsvpChips({
  value,
  counts,
  onChange,
}: {
  value: GuestRsvpFilter;
  counts: Record<GuestRsvpFilter, number>;
  onChange: (value: GuestRsvpFilter) => void;
}) {
  const theme = useEditTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Lets the chips run to the screen's edge, past the editor's padding.
      style={{ marginHorizontal: -16 }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      accessibilityRole="tablist"
    >
      {GUEST_RSVP_FILTERS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label}, ${counts[option.value]}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: selected ? theme.backgroundEmphasis : "transparent",
            }}
          >
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: selected ? "600" : "400" }}>
              {option.label}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{counts[option.value]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function GuestCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const theme = useEditTheme();
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.background,
        overflow: "hidden",
      }}
    >
      {children}
      {footer ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.backgroundSecondary,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

function RsvpBadge({ rsvp }: { rsvp: CalEventRsvpResponse }) {
  const isDark = useColorScheme() === "dark";
  const colors = getCalEventStatusColors(RSVP_BADGE_STATUS[rsvp], isDark);
  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
        {CAL_EVENT_RSVP_LABELS[rsvp]}
      </Text>
    </View>
  );
}

function GuestRow({
  guest,
  first,
  event,
  locationOptions,
  expanded,
  onToggle,
}: {
  guest: CalEventRosterGuest;
  first: boolean;
  event: CalEvent;
  locationOptions: GuestLocationOption[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useEditTheme();
  const name = getGuestDisplayName(guest);
  const contact = getGuestContact(guest);
  const location = getGuestLocationLabel(guest.locationId, locationOptions);
  const details = [
    { label: contact.kind === "phone" ? "Phone" : "Email", value: contact.value },
    { label: "Registered", value: formatGuestDateTime(guest.createdAt) },
    // The roster lists confirmed guests only.
    { label: "Registration", value: "Approved" },
    { label: "Attendance", value: CAL_EVENT_RSVP_LABELS[guest.rsvpResponse] },
    ...(location ? [{ label: "Location", value: location }] : []),
    ...(guest.checkedInAt
      ? [{ label: "Checked in", value: formatGuestDateTime(guest.checkedInAt) }]
      : []),
    ...getGuestAnswerEntries(guest.responses, event.registrationFields),
  ];
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: theme.border }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${name}, ${CAL_EVENT_RSVP_LABELS[guest.rsvpResponse]}`}
        style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 12 }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.backgroundEmphasis,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>
            {getGuestInitial(name)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }} numberOfLines={1}>
            {name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <RsvpBadge rsvp={guest.rsvpResponse} />
            <Text
              style={{ flexShrink: 1, color: theme.textSecondary, fontSize: 13 }}
              numberOfLines={1}
            >
              Registered {formatRelativeTime(guest.createdAt)}
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.textSecondary}
          style={{ marginTop: 2 }}
        />
      </Pressable>
      {expanded ? (
        <View
          style={{
            marginHorizontal: 12,
            marginBottom: 12,
            padding: 12,
            gap: 10,
            borderRadius: 10,
            backgroundColor: theme.backgroundMuted,
          }}
        >
          {details.map((detail, index) => (
            // A guest can answer two questions with the same label.
            <View key={`${detail.label}-${index}`} style={{ gap: 2 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{detail.label}</Text>
              <Text selectable style={{ color: theme.text, fontSize: 15, fontWeight: "500" }}>
                {detail.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SkeletonRow({ first }: { first: boolean }) {
  const theme = useEditTheme();
  const bar = (width: number, height: number) => (
    <View style={{ width, height, borderRadius: 4, backgroundColor: theme.backgroundEmphasis }} />
  );
  return (
    <View
      accessibilityLabel="Loading guests"
      style={{
        gap: 8,
        padding: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.border,
      }}
    >
      {bar(128, 14)}
      {bar(192, 18)}
    </View>
  );
}

function Pagination({
  range,
  page,
  pageCount,
  onPageChange,
}: {
  range: string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const theme = useEditTheme();
  const button = (
    icon: "chevron-back" | "chevron-forward",
    label: string,
    target: number,
    enabled: boolean
  ) => (
    <Pressable
      onPress={() => onPageChange(target)}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      hitSlop={6}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.background,
        alignItems: "center",
        justifyContent: "center",
        opacity: enabled ? 1 : 0.4,
      }}
    >
      <Ionicons name={icon} size={16} color={theme.text} />
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 32,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 14 }}>{range}</Text>
      {pageCount > 1 ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {button("chevron-back", "Previous", page - 1, page > 0)}
          {button("chevron-forward", "Next", page + 1, page < pageCount - 1)}
        </View>
      ) : null}
    </View>
  );
}
