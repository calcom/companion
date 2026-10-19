import { useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { getUserFacingApiReason } from "@/components/cal-events/useCalEventActions";
import {
  isForbiddenError,
  useCalEventCoHosts,
  useChangeCalEventCoHosts,
  useTeamMembers,
} from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import { showInfoAlert, showSilentSuccessAlert } from "@/utils/alerts";
import {
  EditSheet,
  EditTextField,
  FieldLabel,
  ListRow,
  moveItem,
  RowControls,
  TextButton,
  useEditTheme,
} from "./EditControls";

/**
 * The event's hosts. The creator is always first and stays; a team event can add accepted team
 * members. Listing them needs the team admin role and the TEAM_MEMBERSHIP_READ scope, which the
 * app's OAuth sign-in doesn't ask for yet: without either, the list 403s and adding is off.
 */
export function HostsField({
  event,
  hostUserIds,
  onChange,
}: {
  event: Pick<CalEvent, "hosts" | "teamId">;
  hostUserIds: number[];
  onChange: (hostUserIds: number[]) => void;
}) {
  const theme = useEditTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const {
    data: members,
    error: membersError,
    refetch: refetchMembers,
  } = useTeamMembers(event.teamId);
  const creatorId = event.hosts[0]?.userId;

  const describe = (userId: number) => {
    const host = event.hosts.find((candidate) => candidate.userId === userId);
    if (host) return { name: host.name || host.username || "Host", avatarUrl: host.avatarUrl };
    const member = members?.find((candidate) => candidate.userId === userId);
    return {
      name: member?.name || member?.username || member?.email || "Host",
      avatarUrl: member?.avatarUrl,
    };
  };
  const addable = (members ?? []).filter((member) => !hostUserIds.includes(member.userId));
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const matching = needle
    ? addable.filter((member) =>
        [member.name, member.username, member.email].some((text) =>
          text?.toLowerCase().includes(needle)
        )
      )
    : addable;
  const closePicker = () => {
    setPickerOpen(false);
    setSearch("");
  };

  return (
    <View style={{ gap: 8 }}>
      <FieldLabel label="Hosts" />
      {hostUserIds.map((userId, index) => {
        const host = describe(userId);
        const locked = userId === creatorId;
        return (
          <ListRow
            key={userId}
            title={host.name}
            subtitle={locked ? "Creator" : null}
            avatarUrl={host.avatarUrl}
            showAvatar
            trailing={
              event.teamId !== null && !locked ? (
                <RowControls
                  itemLabel={host.name}
                  // Index 1 sits right under the creator, who can't move.
                  onMoveUp={
                    index > 1 ? () => onChange(moveItem(hostUserIds, index, -1)) : undefined
                  }
                  onMoveDown={
                    index < hostUserIds.length - 1
                      ? () => onChange(moveItem(hostUserIds, index, 1))
                      : undefined
                  }
                  onRemove={() =>
                    Alert.alert(
                      "Remove co-host?",
                      "They will no longer be listed as a host on this event.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => onChange(hostUserIds.filter((id) => id !== userId)),
                        },
                      ]
                    )
                  }
                />
              ) : null
            }
          />
        );
      })}
      {event.teamId !== null ? (
        isForbiddenError(membersError) ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            Adding hosts needs a team admin, and a sign-in that can read team members.
          </Text>
        ) : membersError && members === undefined ? (
          // Without this, a failed load reads as a team with nobody left to add.
          <View style={{ gap: 4 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Couldn't load team members.
            </Text>
            <TextButton
              icon="refresh-outline"
              label="Try again"
              accessibilityLabel="Try loading team members again"
              onPress={() => void refetchMembers()}
            />
          </View>
        ) : (
          <TextButton
            icon="person-add-outline"
            label="Add host"
            disabled={addable.length === 0}
            onPress={() => setPickerOpen(true)}
          />
        )
      ) : null}

      <EditSheet visible={pickerOpen} title="Add host" onCancel={closePicker} onDone={closePicker}>
        <EditTextField
          value={search}
          onChangeText={setSearch}
          placeholder="Search team members"
          autoCapitalize="none"
          accessibilityLabel="Search team members"
        />
        {members === undefined ? <ActivityIndicator /> : null}
        {matching.map((member) => (
          <ListRow
            key={member.userId}
            title={member.name || member.username || member.email}
            subtitle={member.email}
            avatarUrl={member.avatarUrl}
            showAvatar
            accessibilityHint="Adds them as a host"
            onPress={() => {
              onChange([...hostUserIds, member.userId]);
              closePicker();
            }}
          />
        ))}
        {members !== undefined && matching.length === 0 ? (
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>No team members found</Text>
        ) : null}
      </EditSheet>
    </View>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CO_HOST_STATUS: Record<string, string> = {
  PENDING: "Invited",
  DECLINED: "Declined",
};

/**
 * People outside the team who help host, invited by email. Unlike the rest of the form, each
 * change here applies at once: an invite sends its email straight away.
 */
export function CoHostsField({ uuid }: { uuid: string }) {
  const theme = useEditTheme();
  const [email, setEmail] = useState("");
  const { data: coHosts, isLoading, error } = useCalEventCoHosts(uuid);
  const { mutate: change, isPending } = useChangeCalEventCoHosts();

  const run = (
    next: Parameters<typeof change>[0]["change"],
    fallback: string,
    onSuccess?: () => void
  ) =>
    change(
      { uuid, change: next },
      {
        onSuccess,
        onError: (failure) => showInfoAlert("Error", getUserFacingApiReason(failure) ?? fallback),
      }
    );

  const invite = () => {
    const address = email.trim();
    if (!EMAIL.test(address)) {
      showInfoAlert("Check the email", "Enter the co-host's email address.");
      return;
    }
    run({ kind: "invite", email: address }, "Couldn't send the invite. Please try again.", () => {
      setEmail("");
      showSilentSuccessAlert("Invitation sent", `${address} was invited to co-host`);
    });
  };

  const ids = (coHosts ?? []).map((coHost) => coHost.id);

  return (
    <View style={{ gap: 8 }}>
      <FieldLabel
        label="Co-hosts outside your team"
        hint="External co-hosts can edit the event and manage attendees but have no access to anything else your team owns. Changes here apply right away."
      />
      {isLoading ? <ActivityIndicator /> : null}
      {error && !isLoading ? (
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Couldn't load co-hosts.</Text>
      ) : null}
      {(coHosts ?? []).map((coHost, index) => {
        const label = coHost.name || coHost.email;
        return (
          <ListRow
            key={coHost.id}
            title={label}
            subtitle={[
              coHost.name ? coHost.email : null,
              coHost.status === "ACCEPTED"
                ? null
                : (CO_HOST_STATUS[coHost.status] ?? coHost.status),
            ]
              .filter(Boolean)
              .join(" · ")}
            avatarUrl={coHost.avatarUrl}
            showAvatar
            trailing={
              <RowControls
                itemLabel={label}
                onMoveUp={
                  index > 0 && !isPending
                    ? () =>
                        run(
                          { kind: "reorder", coHostIds: moveItem(ids, index, -1) },
                          "Couldn't reorder co-hosts. Please try again."
                        )
                    : undefined
                }
                onMoveDown={
                  index < ids.length - 1 && !isPending
                    ? () =>
                        run(
                          { kind: "reorder", coHostIds: moveItem(ids, index, 1) },
                          "Couldn't reorder co-hosts. Please try again."
                        )
                    : undefined
                }
                onRemove={() =>
                  Alert.alert(
                    "Revoke co-host access?",
                    "They lose access to this event immediately.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Revoke",
                        style: "destructive",
                        onPress: () =>
                          run(
                            { kind: "remove", coHostId: coHost.id },
                            "Couldn't remove the co-host. Please try again."
                          ),
                      },
                    ]
                  )
                }
              />
            }
          />
        );
      })}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <EditTextField
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Co-host email"
          />
        </View>
        <View style={{ height: 44, justifyContent: "center" }}>
          <TextButton
            label="Invite co-host"
            disabled={!email.trim() || isPending}
            onPress={invite}
          />
        </View>
      </View>
    </View>
  );
}
