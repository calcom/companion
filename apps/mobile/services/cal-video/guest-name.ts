import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "cal-video.guest-name";
const MAX_LENGTH = 80;

/** The name a guest last joined with, so a rejoin or the next meeting starts from it, as on web. */
export async function loadGuestName(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export async function saveGuestName(name: string): Promise<void> {
  const trimmed = name.trim().slice(0, MAX_LENGTH);
  try {
    if (trimmed) await AsyncStorage.setItem(KEY, trimmed);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // A name that is not remembered is typed again; nothing else depends on it.
  }
}
