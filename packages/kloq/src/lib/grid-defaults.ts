// Grid geometry defaults — public API; the component reads `useKloqSettings()` instead.

export const HOUR_HEIGHT = 64;
const DAY_START_HOUR = 0;
export const DAY_END_HOUR = 24;
export const SNAP_MIN = 15;
export const SNAP_FINE_MIN = 5; // with ⌥ held
export const MIN_EVENT_MIN = 15;
export const DRAG_THRESHOLD_PX = 4;

/** Default-geometry px↔time. Configured geometry lives on `KloqSettings`. */
export const minutesToPx = (min: number) => (min / 60) * HOUR_HEIGHT;
export const pxToMinutes = (px: number) => (px / HOUR_HEIGHT) * 60;

export const snapMinutes = (min: number, step: number) => Math.round(min / step) * step;

export const clampMinutes = (min: number) =>
  Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60, min));
