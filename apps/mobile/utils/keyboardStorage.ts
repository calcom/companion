import type { KeyboardData } from "./keyboardStorage.shared";

export * from "./keyboardStorage.shared";

export async function updateKeyboardData(_data: KeyboardData): Promise<void> {
  console.warn("Keyboard updates are not supported on this platform");
}

export async function getKeyboardData(): Promise<KeyboardData | null> {
  console.warn("Keyboard reads are not supported on this platform");
  return null;
}

export async function clearKeyboardData(): Promise<void> {
  console.warn("Keyboard clearing is not supported on this platform");
}
