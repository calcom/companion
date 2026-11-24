import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { CalEventSheet } from "@/components/screens/CalEventSheet";
import {
  InviteGuestsScreen,
  type InviteGuestsScreenHandle,
} from "@/components/screens/InviteGuestsScreen";

/** Invite guests, opened from the event editor's Guests tab. */
export default function CalEventInviteGuests() {
  const { uuid, email } = useLocalSearchParams<{ uuid: string; email?: string }>();
  const router = useRouter();
  const screenRef = useRef<InviteGuestsScreenHandle>(null);
  const [state, setState] = useState({ canSubmit: false, saving: false });
  return (
    <CalEventSheet
      title="Invite guests"
      onClose={() => router.back()}
      onSubmit={() => screenRef.current?.submit()}
      submitDisabled={!state.canSubmit || state.saving}
    >
      <InviteGuestsScreen
        ref={screenRef}
        uuid={uuid ?? ""}
        initialEmail={email}
        onDone={() => router.back()}
        onStateChange={setState}
        transparentBackground
      />
    </CalEventSheet>
  );
}
