import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { CalEventSheet } from "@/components/screens/CalEventSheet";
import {
  MessageGuestsScreen,
  type MessageGuestsScreenHandle,
} from "@/components/screens/MessageGuestsScreen";

/** Message guests, opened from the event editor's Guests tab. */
export default function CalEventMessageGuests() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const router = useRouter();
  const screenRef = useRef<MessageGuestsScreenHandle>(null);
  const [state, setState] = useState({ canSubmit: false, saving: false });
  return (
    <CalEventSheet
      title="Message guests"
      onClose={() => router.back()}
      onSubmit={() => screenRef.current?.submit()}
      submitDisabled={!state.canSubmit || state.saving}
    >
      <MessageGuestsScreen
        ref={screenRef}
        uuid={uuid ?? ""}
        onDone={() => router.back()}
        onStateChange={setState}
      />
    </CalEventSheet>
  );
}
