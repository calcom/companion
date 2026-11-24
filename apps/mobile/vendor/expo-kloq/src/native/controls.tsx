// Metro picks `controls.ios.tsx` or `controls.android.tsx`; this module is what TypeScript resolves
// (and the shape both platforms implement). There is no web build of these controls.
export { NavControls, SheetButton, ViewSwitcher } from "./controls.ios.tsx";
