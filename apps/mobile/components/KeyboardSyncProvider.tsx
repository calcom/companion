import { useKeyboardSync } from "@/hooks/useKeyboardSync";

export function KeyboardSyncProvider({ children }: { children: React.ReactNode }) {
  useKeyboardSync();
  return <>{children}</>;
}
