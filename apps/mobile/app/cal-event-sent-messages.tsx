import { useLocalSearchParams, useRouter } from "expo-router";
import { CalEventSheet } from "@/components/screens/CalEventSheet";
import { SentMessagesScreen } from "@/components/screens/SentMessagesScreen";

/** The messages sent to an event's guests, opened from the event editor's Guests tab. */
export default function CalEventSentMessages() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const router = useRouter();
  return (
    <CalEventSheet title="Sent messages" onClose={() => router.back()}>
      <SentMessagesScreen uuid={uuid ?? ""} />
    </CalEventSheet>
  );
}
