import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  useColorScheme,
  View,
} from "react-native";
import {
  useApproveAllCalEventRegistrations,
  useCalEventRegistrationCounts,
  useCalEventRoster,
  useDecideCalEventRegistration,
} from "@/hooks";
import type { CalEvent, CalEventLocation, CalEventRosterGuest } from "@/services/calcom";
import { showConfirmAlert, showInfoAlert } from "@/utils/alerts";
import {
  buildRosterCsv,
  CAL_EVENT_REGISTRATION_STATUS_LABELS,
  CAL_EVENT_RSVP_LABELS,
  countRoster,
  filterRoster,
  formatGuestDateTime,
  formatGuestPayment,
  formatLocationSeats,
  GUEST_FILTER_LABELS,
  type GuestBadgeTone,
  type GuestDecision,
  type GuestFilter,
  type GuestLocationOption,
  getApproveAllMessage,
  getApproveAllPrompt,
  getDecisionMessage,
  getGuestAnswerEntries,
  getGuestBadge,
  getGuestContact,
  getGuestContext,
  getGuestDecidedLabel,
  getGuestDecisions,
  getGuestDisplayName,
  getGuestFilterCounts,
  getGuestFilters,
  getGuestInitial,
  getGuestLocationLabel,
  getGuestLocationOptions,
  getRosterPage,
  isGuestNoShow,
  isValidInviteEmail,
  rosterCsvFilename,
} from "@/utils/cal-event-guests";
import { getCalEventStatusColors, isPaidCalEvent } from "@/utils/cal-events";
import { getAvatarUrl } from "@/utils/getAvatarUrl";
import { getUserFacingApiReason } from "../useCalEventActions";
import { EditTextField, useEditSurfaces, useEditTheme } from "./EditControls";
import { SelectField } from "./SelectField";

/** The web's badge variants in the Events tab's status colors. */
const BADGE_TONE_STATUS = {
  success: "published",
  warning: "draft",
  error: "cancelled",
  neutral: "past",
} as const satisfies Record<GuestBadgeTone, Parameters<typeof getCalEventStatusColors>[0]>;

/**
 * The web editor's Guests tab at phone width: search, the guest actions, a location filter, status
 * chips and a paged list whose rows expand to the guest's details. Invite, message and approve
 * all apply at once and never touch Save.
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
          borderRadius: 14,
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
  const { data: serverCounts } = useCalEventRegistrationCounts(event.uuid);
  const { mutate: approveAll, isPending: approving } = useApproveAllCalEventRegistrations();
  const {
    mutate: decide,
    isPending: deciding,
    variables: decidingVariables,
  } = useDecideCalEventRegistration();
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [filter, setFilter] = useState<GuestFilter>("ALL");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const guests = roster.data ?? [];
  const locationOptions = getGuestLocationOptions(locations);
  // A filter on a location that was since removed would hide every guest.
  const activeLocationId = locationOptions.some((option) => option.id === locationId)
    ? locationId
    : null;
  // Like the web's Guests tab, by the server's rule: a price of 0 charges nothing.
  const paid = isPaidCalEvent({ price: event.price, locations });
  const filters = getGuestFilters(guests, { waitlistEnabled: event.waitlistEnabled, paid });
  // A chip that went away with the last guest in it would leave the list on nothing.
  const activeFilter = filters.includes(filter) ? filter : "ALL";
  const filtered = filterRoster(guests, {
    search,
    locationId: activeLocationId,
    filter: activeFilter,
  });
  const searching = search.trim() !== "";
  // The server's counts are event-wide, so they stand while nothing narrows the list. A search or
  // location counts the loaded guests instead, which are all of them; so does a server without counts.
  const counts =
    serverCounts && !searching && activeLocationId === null
      ? getGuestFilterCounts(serverCounts)
      : countRoster(guests, { search, locationId: activeLocationId });
  const current = getRosterPage(filtered, page);
  const narrowed = searching || activeLocationId !== null || activeFilter !== "ALL";
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
    showConfirmAlert(
      "Approve all pending guests?",
      getApproveAllPrompt(counts.PENDING_APPROVAL, { paid }),
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

  const runDecision = (guest: CalEventRosterGuest, decision: GuestDecision) =>
    decide(
      { uuid: event.uuid, registrationId: guest.registrationId, decision },
      {
        onSuccess: (kind) => {
          const message = getDecisionMessage(kind);
          if (message) showInfoAlert(message.title, message.message);
        },
        onError: (error) =>
          showInfoAlert(
            "Error",
            getUserFacingApiReason(error) ?? `Failed to ${decision} the guest. Please try again.`
          ),
      }
    );

  // Approve goes at once, as on the web. Decline asks first: it emails the guest and can't be undone here.
  const onDecide = (guest: CalEventRosterGuest, decision: GuestDecision) => {
    if (decision === "approve") {
      runDecision(guest, decision);
      return;
    }
    showConfirmAlert(
      `Decline ${getGuestDisplayName(guest)}?`,
      "They'll get an email letting them know.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Decline", style: "destructive", onPress: () => runDecision(guest, decision) },
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
        {/* As on the web, only while someone in the list is waiting for approval. */}
        {counts.PENDING_APPROVAL > 0 || approving ? (
          <ToolbarButton label="Approve all" busy={approving} onPress={confirmApproveAll} />
        ) : null}
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
            ...locationOptions.map((option) => ({
              value: option.id,
              label: option.label,
              hint: formatLocationSeats(option, serverCounts?.byLocation) ?? undefined,
            })),
          ]}
          value={activeLocationId}
          onChange={(next) => narrow(() => setLocationId(next))}
        />
      ) : null}

      {serverCounts && (serverCounts.going > 0 || serverCounts.checkedIn > 0) ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="checkmark-circle-outline" size={18} color={theme.textSecondary} />
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
            {serverCounts.checkedIn} / {serverCounts.going} checked in
          </Text>
        </View>
      ) : null}

      <FilterChips
        filters={filters}
        value={activeFilter}
        counts={counts}
        onChange={(next) => narrow(() => setFilter(next))}
      />

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
              borderRadius: 8,
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
            borderRadius: 14,
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
              // One decision at a time, as on the web: each has to see the seats the last one took.
              decisionsDisabled={deciding}
              busyDecision={
                deciding && decidingVariables?.registrationId === guest.registrationId
                  ? decidingVariables.decision
                  : null
              }
              onDecide={(decision) => onDecide(guest, decision)}
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
        borderRadius: 8,
        borderWidth: 1,
        borderColor: primary ? theme.text : theme.border,
        backgroundColor: primary ? theme.text : "transparent",
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
function FilterChips({
  filters,
  value,
  counts,
  onChange,
}: {
  filters: GuestFilter[];
  value: GuestFilter;
  counts: Record<GuestFilter, number>;
  onChange: (value: GuestFilter) => void;
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
      {filters.map((option) => {
        const selected = option === value;
        const label = GUEST_FILTER_LABELS[option];
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label}, ${counts[option]}`}
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
              {label}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{counts[option]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function GuestCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const theme = useEditTheme();
  const surfaces = useEditSurfaces();
  return (
    <View
      style={{
        borderRadius: 14,
        backgroundColor: surfaces.card,
        overflow: "hidden",
      }}
    >
      {children}
      {footer ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.backgroundMuted,
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

function GuestBadge({ label, tone }: { label: string; tone: GuestBadgeTone }) {
  const isDark = useColorScheme() === "dark";
  const colors = getCalEventStatusColors(BADGE_TONE_STATUS[tone], isDark);
  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

const AVATAR_SIZE = 36;

/** The guest's Cal.com photo, else their initial, as the web's avatar. */
function GuestAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const theme = useEditTheme();
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.backgroundEmphasis,
      }}
    >
      {avatarUrl && !failed ? (
        <Image
          source={{ uri: getAvatarUrl(avatarUrl) }}
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>
          {getGuestInitial(name)}
        </Text>
      )}
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
  decisionsDisabled,
  busyDecision,
  onDecide,
}: {
  guest: CalEventRosterGuest;
  first: boolean;
  event: CalEvent;
  locationOptions: GuestLocationOption[];
  expanded: boolean;
  onToggle: () => void;
  decisionsDisabled: boolean;
  /** The decision on its way for this guest, if any. */
  busyDecision: GuestDecision | null;
  onDecide: (decision: GuestDecision) => void;
}) {
  const theme = useEditTheme();
  const name = getGuestDisplayName(guest);
  const contact = getGuestContact(guest);
  const location = getGuestLocationLabel(guest.locationId, locationOptions);
  const badge = getGuestBadge(guest);
  const noShow = isGuestNoShow(guest);
  const payment = formatGuestPayment(guest);
  const decisions = getGuestDecisions(guest.status);
  const details = [
    { label: contact.kind === "phone" ? "Phone" : "Email", value: contact.value },
    { label: "Registered", value: formatGuestDateTime(guest.createdAt) },
    { label: "Registration", value: CAL_EVENT_REGISTRATION_STATUS_LABELS[guest.status] },
    { label: "Attendance", value: CAL_EVENT_RSVP_LABELS[guest.rsvpResponse] },
    ...(location ? [{ label: "Location", value: location }] : []),
    ...(payment ? [{ label: "Payment", value: payment }] : []),
    ...(guest.decidedAt
      ? [{ label: getGuestDecidedLabel(guest.status), value: formatGuestDateTime(guest.decidedAt) }]
      : []),
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
        accessibilityLabel={`${name}, ${badge.label}${noShow ? ", No-show" : ""}`}
        style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 12 }}
      >
        <GuestAvatar name={name} avatarUrl={guest.avatarUrl} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }} numberOfLines={1}>
            {name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <GuestBadge label={badge.label} tone={badge.tone} />
            {noShow ? <GuestBadge label="No-show" tone="warning" /> : null}
            <Text
              style={{ flexShrink: 1, color: theme.textSecondary, fontSize: 13 }}
              numberOfLines={1}
            >
              {getGuestContext(guest)}
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
        <View style={{ marginHorizontal: 12, marginBottom: 12, gap: 12 }}>
          <View
            style={{
              padding: 12,
              gap: 10,
              borderRadius: 8,
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
          {/* Under the details, as the web's row actions. */}
          {decisions.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {decisions.map((decision) => (
                <ToolbarButton
                  key={decision}
                  label={decision === "approve" ? "Approve" : "Decline"}
                  primary={decision === "approve"}
                  disabled={decisionsDisabled && busyDecision !== decision}
                  busy={busyDecision === decision}
                  onPress={() => onDecide(decision)}
                />
              ))}
            </View>
          ) : null}
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
