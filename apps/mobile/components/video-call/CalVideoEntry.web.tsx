import type { ComponentProps } from "react";
import type { CalVideoEntry as NativeCalVideoEntry } from "./CalVideoEntry";

// The call screens load native-only WebRTC views, and Cal Video links don't open in the web app.
export function CalVideoEntry(_props: ComponentProps<typeof NativeCalVideoEntry>) {
  return null;
}
