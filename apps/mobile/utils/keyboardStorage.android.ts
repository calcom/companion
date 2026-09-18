import { File, Paths } from "expo-file-system";

import { ANDROID_KEYBOARD_FILE, type KeyboardData } from "./keyboardStorage.shared";

const keyboardFile = new File(Paths.document, ANDROID_KEYBOARD_FILE);

export async function updateKeyboardData(data: KeyboardData): Promise<void> {
  keyboardFile.write(JSON.stringify(data));
}

export async function getKeyboardData(): Promise<KeyboardData | null> {
  try {
    return JSON.parse(await keyboardFile.text()) as KeyboardData;
  } catch {
    return null;
  }
}

export async function clearKeyboardData(): Promise<void> {
  try {
    keyboardFile.delete();
  } catch {
    // The file may not exist yet.
  }
}

export * from "./keyboardStorage.shared";
