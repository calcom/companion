import { storageEnabled, storageKey } from "./storage";

/**
 * The two axes deciding how tall an hour is: density (base height + type +
 * padding) and zoom (a ladder multiplier that leaves type alone).
 */

/* ── density ── */

export type KloqDensity = "compact" | "comfortable";

export const DENSITIES: readonly KloqDensity[] = ["compact", "comfortable"];

export const DEFAULT_DENSITY: KloqDensity = "comfortable";

export function isDensity(v: unknown): v is KloqDensity {
  return v === "compact" || v === "comfortable";
}

/** `hourHeight` feeds `createSettings`; the rest become custom properties read by `styles/kloq.css`. */
export interface DensityTokens {
  /** px per hour before zoom */
  readonly hourHeight: number;
  /** event/chip label size in px */
  readonly fontSize: number;
  /** event/chip label leading, unitless */
  readonly lineHeight: number;
  /** vertical padding inside an event block, px */
  readonly paddingBlock: number;
  /** horizontal padding inside an event block, px (start/end) */
  readonly paddingInline: number;
  /** all-day chip row height, px */
  readonly chipHeight: number;
}

export const DENSITY_TOKENS: Record<KloqDensity, DensityTokens> = {
  comfortable: {
    hourHeight: 64,
    fontSize: 12,
    lineHeight: 1.25,
    paddingBlock: 3,
    paddingInline: 10,
    chipHeight: 22,
  },
  compact: {
    // 44px is the smallest hour that fits a two-line chip at 11px
    hourHeight: 44,
    fontSize: 11,
    lineHeight: 1.15,
    paddingBlock: 1,
    paddingInline: 7,
    chipHeight: 18,
  },
};

export function densityTokens(density: KloqDensity = DEFAULT_DENSITY): DensityTokens {
  return DENSITY_TOKENS[isDensity(density) ? density : DEFAULT_DENSITY];
}

/* ── zoom ── */

/**
 * The zoom ladder, as multipliers of the base hour height. A fixed table so
 * steps are exactly reversible; chosen so base 64 gives whole pixels at every rung.
 */
export const ZOOM_STEPS: readonly number[] = [
  0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5, 1.75, 2, 2.5, 3,
];

/** The rung that means "no zoom". */
export const ZOOM_DEFAULT = 4;

export const ZOOM_MIN = 0;
export const ZOOM_MAX = ZOOM_STEPS.length - 1;

/** A zoom level, coerced into the ladder. Junk (NaN, undefined) → default. */
export function clampZoom(level: number | undefined): number {
  if (level === undefined || !Number.isFinite(level)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(level)));
}

/** One rung in a direction. Saturates at the ends rather than wrapping. */
export function stepZoom(level: number, dir: 1 | -1): number {
  return clampZoom(clampZoom(level) + dir);
}

/** The multiplier at a rung. */
export function zoomFactor(level: number): number {
  return ZOOM_STEPS[clampZoom(level)];
}

export function isDefaultZoom(level: number): boolean {
  return clampZoom(level) === ZOOM_DEFAULT;
}

export function zoomLabel(level: number): string {
  return `${Math.round(zoomFactor(level) * 100)}%`;
}

/* ── resolved ── */

export interface DensityState {
  readonly density: KloqDensity;
  /** index into `ZOOM_STEPS` */
  readonly zoom: number;
}

export const DEFAULT_DENSITY_STATE: DensityState = {
  density: DEFAULT_DENSITY,
  zoom: ZOOM_DEFAULT,
};

/** Bounds shared with `createSettings` so the two can never disagree. */
export const MIN_HOUR_HEIGHT = 8;
export const MAX_HOUR_HEIGHT = 480;

/**
 * Turns the picked state into px per hour. An explicit `hourHeight` wins as the
 * base over density; zoom multiplies whichever won.
 */
export function resolveHourHeight(opts: {
  hourHeight?: number;
  density?: KloqDensity;
  zoom?: number;
}): number {
  const base =
    opts.hourHeight !== undefined && Number.isFinite(opts.hourHeight)
      ? opts.hourHeight
      : densityTokens(opts.density).hourHeight;
  const scaled = Math.round(base * zoomFactor(clampZoom(opts.zoom)));
  return Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, scaled));
}

/** The custom properties a calendar root carries for a given state, ready for `style`. */
export function densityVars(state: DensityState = DEFAULT_DENSITY_STATE): Record<string, string> {
  const t = densityTokens(state.density);
  return {
    "--kloq-event-font-size": `${t.fontSize}px`,
    "--kloq-event-line-height": `${t.lineHeight}`,
    "--kloq-event-padding-block": `${t.paddingBlock}px`,
    "--kloq-event-padding-inline": `${t.paddingInline}px`,
    "--kloq-chip-height": `${t.chipHeight}px`,
  };
}

/* ── zoom-anchored scrolling ── */

interface AnchoredScrollInput {
  /** minutes-from-midnight that must stay put */
  anchorMin: number;
  /** px from the viewport's top edge */
  anchorOffset: number;
  /** the NEW scale, after the change */
  minutesToPx: (min: number) => number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * The scroll position that keeps `anchorMin` under `anchorOffset`. Clamped:
 * a scrollTop past the new maximum is silently rejected by the scroller.
 */
export function anchoredScrollTop(o: AnchoredScrollInput): number {
  const target = o.minutesToPx(o.anchorMin) - o.anchorOffset;
  const max = Math.max(0, o.scrollHeight - o.clientHeight);
  return Math.min(max, Math.max(0, target));
}

/** The minute under `anchorOffset` before the change, read on the OLD scale. */
export function minuteUnderAnchor(o: {
  scrollTop: number;
  anchorOffset: number;
  hourHeight: number;
  dayStartMin: number;
}): number {
  return (o.scrollTop + o.anchorOffset) / (o.hourHeight / 60) + o.dayStartMin;
}

/* ── persistence ── */

const DENSITY_STORAGE_KEY = "kloq-density";
const ZOOM_STORAGE_KEY = "kloq-zoom";
/** Stamped on `<html>` so `styles/kloq.css` can key off it pre-hydration. */
const DENSITY_ATTRIBUTE = "data-kloq-density";

export function readStoredDensity(): DensityState {
  if (!storageEnabled()) return DEFAULT_DENSITY_STATE;
  try {
    const d = localStorage.getItem(storageKey("density"));
    const z = localStorage.getItem(storageKey("zoom"));
    return {
      density: isDensity(d) ? d : DEFAULT_DENSITY,
      zoom: clampZoom(z === null ? undefined : Number(z)),
    };
  } catch {
    return DEFAULT_DENSITY_STATE;
  }
}

/** Persist both axes; a default value is removed, so a future default change reaches everyone. */
export function writeStoredDensity(state: DensityState): void {
  if (!storageEnabled()) return;
  try {
    if (state.density === DEFAULT_DENSITY) localStorage.removeItem(storageKey("density"));
    else localStorage.setItem(storageKey("density"), state.density);

    if (isDefaultZoom(state.zoom)) localStorage.removeItem(storageKey("zoom"));
    else localStorage.setItem(storageKey("zoom"), String(clampZoom(state.zoom)));
  } catch {
    /* storage unavailable */
  }
}

/** Pre-paint restore of the `<html>` attribute only; the px-per-hour half is React state. */
export function densityRestoreScript(prefix = "kloq"): string {
  return `try{var d=localStorage.getItem(${JSON.stringify(
    `${prefix}-density`,
  )});if(d==="compact"||d==="comfortable")document.documentElement.setAttribute(${JSON.stringify(
    DENSITY_ATTRIBUTE,
  )},d)}catch(e){}`;
}

/** `densityRestoreScript()` for the default prefix. */
export const DENSITY_RESTORE_SCRIPT = densityRestoreScript();

/* ── store ── */

let current: DensityState = DEFAULT_DENSITY_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Stable identity — safe as a `useSyncExternalStore` snapshot. */
export function getDensityState(): DensityState {
  return current;
}

/** Always the defaults, never storage; `hydrateDensity()` closes the gap before paint. */
export function getServerDensityState(): DensityState {
  return DEFAULT_DENSITY_STATE;
}

export function subscribeDensity(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setDensityState(next: Partial<DensityState>): DensityState {
  const merged: DensityState = {
    density: isDensity(next.density) ? next.density : current.density,
    zoom: next.zoom === undefined ? current.zoom : clampZoom(next.zoom),
  };
  if (merged.density === current.density && merged.zoom === current.zoom) return current;
  current = merged;
  writeStoredDensity(current);
  applyDensityAttribute(current.density);
  emit();
  return current;
}

export function setDensity(density: KloqDensity): DensityState {
  return setDensityState({ density });
}

export function setZoom(zoom: number): DensityState {
  return setDensityState({ zoom });
}

export function zoomBy(dir: 1 | -1): DensityState {
  return setDensityState({ zoom: stepZoom(current.zoom, dir) });
}

export function resetZoom(): DensityState {
  return setDensityState({ zoom: ZOOM_DEFAULT });
}

export function applyDensityAttribute(density: KloqDensity): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (density === DEFAULT_DENSITY) root.removeAttribute(DENSITY_ATTRIBUTE);
  else root.setAttribute(DENSITY_ATTRIBUTE, density);
}

/** Adopt the persisted state. Idempotent; only the first `<Kloq>` does any work. */
export function hydrateDensity(): DensityState {
  if (hydrated) return current;
  hydrated = true;
  const stored = readStoredDensity();
  if (stored.density !== current.density || stored.zoom !== current.zoom) {
    current = stored;
    applyDensityAttribute(current.density);
    emit();
  }
  return current;
}

/** Test seam. */
export function resetDensityStore(): void {
  current = DEFAULT_DENSITY_STATE;
  hydrated = false;
  listeners.clear();
}
