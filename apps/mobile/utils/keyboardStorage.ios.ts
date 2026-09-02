import { ExtensionStorage } from "@bacons/apple-targets";

import {
  APP_GROUP_IDENTIFIER,
  KEYBOARD_DATA_KEY,
  type KeyboardData,
} from "./keyboardStorage.shared";

const iosStorage = new ExtensionStorage(APP_GROUP_IDENTIFIER);

export async function updateKeyboardData(data: KeyboardData): Promise<void> {
  iosStorage.set(KEYBOARD_DATA_KEY, data as unknown as Record<string, string | number>);
}

export async function getKeyboardData(): Promise<KeyboardData | null> {
  const value = iosStorage.get(KEYBOARD_DATA_KEY);
  if (!value) {
    return null;
  }

  try {
    return (typeof value === "string" ? JSON.parse(value) : value) as KeyboardData;
  } catch {
    return null;
  }
}

export async function clearKeyboardData(): Promise<void> {
  iosStorage.remove(KEYBOARD_DATA_KEY);
}

export * from "./keyboardStorage.shared";
