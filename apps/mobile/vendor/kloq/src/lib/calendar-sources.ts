"use client";

/**
 * Calendar-source registry: accounts and their calendars, plus pure helpers.
 * The component never owns provider auth; hosts register what they connected.
 */

import { useCallback, useSyncExternalStore } from "react";
import { type CalEvent, DEFAULT_EVENT_COLOR, type EventColor } from "./calendar-types";

/** A calendar's colour is a palette key, not a hex string, so it themes like any event. */
export type CalendarColor = EventColor;

/** One connected account — an identity, not a calendar. */
export interface CalendarAccount {
  /** stable identity; re-registering the same id replaces it in place */
  id: string;
  label: string;
  /** Free-text provider tag (`"google"`, `"outlook"`, …); the component never branches on it. */
  provider: string;
  /** Human name for the provider; falls back to {@link provider}. */
  providerLabel?: string;
  /** Avatar URL or `data:` URI — not a React node, this object must stay serialisable. */
  avatarUrl?: string;
  /**
   * Default conferencing for events created on this account, matched against
   * {@link ConferencingProvider.id}. Records intent only; the host mints links.
   */
  defaultConferencing?: string;
  /** Calendar new events land on; an id outside this account is ignored. */
  defaultCalendarId?: string;
  /** The account new events belong to by default; at most one should carry it. */
  isDefault?: boolean;
}

export interface ConferencingProvider {
  id: string;
  label: string;
}

/** Default list for the settings dialog; `"none"` is the absence of conferencing. */
export const CONFERENCING_PROVIDERS: readonly ConferencingProvider[] = [
  { id: "none", label: "No conferencing" },
  { id: "google-meet", label: "Google Meet" },
  { id: "zoom", label: "Zoom" },
  { id: "teams", label: "Microsoft Teams" },
];

export interface CalendarSource {
  /** stable identity — this is what `CalEvent.calendarId` points at */
  id: string;
  name: string;
  color: CalendarColor;
  accountId: string;
  /** shown on the grid; absent means visible */
  visible?: boolean;
  /** the host can't write here (a holiday feed, a shared team calendar) */
  readOnly?: boolean;
  /** new events land here. At most one should carry it; the first wins. */
  isDefault?: boolean;
}

const accounts = new Map<string, CalendarAccount>();
const sources = new Map<string, CalendarSource>();
const listeners = new Set<() => void>();

// Rebuilt on emit, not on read: useSyncExternalStore needs referentially stable snapshots.
let accountSnapshot: CalendarAccount[] = [];
let sourceSnapshot: CalendarSource[] = [];

const emit = () => {
  accountSnapshot = [...accounts.values()];
  sourceSnapshot = [...sources.values()];
  for (const l of listeners) l();
};

/** Register one or more accounts. Returns an unregister covering exactly this call. */
export function registerCalendarAccounts(...items: CalendarAccount[]): () => void {
  for (const a of items) accounts.set(a.id, a);
  emit();
  return () => {
    let changed = false;
    for (const a of items) changed = accounts.delete(a.id) || changed;
    if (changed) emit();
  };
}

/** Register one or more calendars. A re-registered id keeps its original slot. */
export function registerCalendarSources(...items: CalendarSource[]): () => void {
  for (const s of items) sources.set(s.id, s);
  emit();
  return () => {
    let changed = false;
    for (const s of items) changed = sources.delete(s.id) || changed;
    if (changed) emit();
  };
}

/** Register an account with its calendars; `accountId` is filled in from the account. */
export function registerCalendarAccount(
  account: CalendarAccount,
  ...calendars: (Omit<CalendarSource, "accountId"> & Partial<Pick<CalendarSource, "accountId">>)[]
): () => void {
  const offAccount = registerCalendarAccounts(account);
  const offSources = registerCalendarSources(
    ...calendars.map((c) => ({ ...c, accountId: c.accountId ?? account.id })),
  );
  return () => {
    offSources();
    offAccount();
  };
}

/** Current accounts, in registration order. Referentially stable. */
export function getCalendarAccounts(): CalendarAccount[] {
  return accountSnapshot;
}

/** Current calendars, in registration order. Referentially stable. */
export function getCalendarSources(): CalendarSource[] {
  return sourceSnapshot;
}

export function subscribeCalendarSources(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearCalendarSources(): void {
  if (accounts.size === 0 && sources.size === 0) return;
  accounts.clear();
  sources.clear();
  emit();
}

export function setCalendarVisible(id: string, visible: boolean): void {
  const s = sources.get(id);
  if (!s || isVisible(s) === visible) return;
  sources.set(id, { ...s, visible });
  emit();
}

export function toggleCalendarVisible(id: string): void {
  const s = sources.get(id);
  if (s) setCalendarVisible(id, !isVisible(s));
}

/** Make `id` the default calendar, clearing the flag elsewhere. No-op for read-only. */
export function setDefaultCalendar(id: string): void {
  const target = sources.get(id);
  if (!target || target.readOnly || target.isDefault) return;
  for (const [key, s] of sources) if (s.isDefault) sources.set(key, { ...s, isDefault: false });
  sources.set(id, { ...target, isDefault: true });
  emit();
}

function patchAccount(id: string, patch: Partial<Omit<CalendarAccount, "id">>): boolean {
  const a = accounts.get(id);
  if (!a) return false;
  const next = { ...a, ...patch };
  if (Object.entries(patch).every(([k, v]) => a[k as keyof CalendarAccount] === v)) return false;
  accounts.set(id, next);
  emit();
  return true;
}

export function setAccountConferencing(accountId: string, conferencing: string | undefined): void {
  patchAccount(accountId, { defaultConferencing: conferencing });
}

/** Set the calendar new events land on within an account; refuses foreign or read-only ones. */
export function setAccountDefaultCalendar(accountId: string, calendarId: string): void {
  const cal = sources.get(calendarId);
  if (!cal || cal.accountId !== accountId || cal.readOnly) return;
  patchAccount(accountId, { defaultCalendarId: calendarId });
}

export function setDefaultAccount(id: string): void {
  const target = accounts.get(id);
  if (!target || target.isDefault) return;
  for (const [key, a] of accounts) if (a.isDefault) accounts.set(key, { ...a, isDefault: false });
  accounts.set(id, { ...target, isDefault: true });
  emit();
}

/** Drop an account and every calendar under it; returns the removed calendar ids. */
export function disconnectAccount(id: string): string[] {
  const removed: string[] = [];
  for (const [key, s] of sources)
    if (s.accountId === id) {
      sources.delete(key);
      removed.push(key);
    }
  const hadAccount = accounts.delete(id);
  if (hadAccount || removed.length > 0) emit();
  return removed;
}

export function useCalendarSources(): {
  accounts: CalendarAccount[];
  sources: CalendarSource[];
} {
  const subscribe = useCallback((l: () => void) => subscribeCalendarSources(l), []);
  const list = useSyncExternalStore(subscribe, getCalendarSources, getCalendarSources);
  const accts = useSyncExternalStore(subscribe, getCalendarAccounts, getCalendarAccounts);
  return { accounts: accts, sources: list };
}

export const isVisible = (s: Pick<CalendarSource, "visible">) => s.visible !== false;

export function findCalendar(
  sources: readonly CalendarSource[],
  id: string | undefined,
): CalendarSource | undefined {
  if (!id) return undefined;
  return sources.find((s) => s.id === id);
}

/** Event colour: its own, else its calendar's, else the default. */
export function resolveEventColor(
  event: Pick<CalEvent, "color" | "calendarId">,
  sources: readonly CalendarSource[],
): CalendarColor {
  return event.color ?? findCalendar(sources, event.calendarId)?.color ?? DEFAULT_EVENT_COLOR;
}

export function visibleCalendarIds(sources: readonly CalendarSource[]): Set<string> {
  return new Set(sources.filter(isVisible).map((s) => s.id));
}

/** Only an event on a registered *and* hidden calendar is filtered out. */
export function isEventVisible(
  event: Pick<CalEvent, "calendarId">,
  sources: readonly CalendarSource[],
): boolean {
  const cal = findCalendar(sources, event.calendarId);
  return !cal || isVisible(cal);
}

/** Events on visible calendars, in input order. Returns the same array when nothing is hidden. */
export function filterVisibleEvents<T extends Pick<CalEvent, "calendarId">>(
  events: readonly T[],
  sources: readonly CalendarSource[],
): readonly T[] {
  const hidden = sources.filter((s) => !isVisible(s));
  if (hidden.length === 0) return events;
  const hiddenIds = new Set(hidden.map((s) => s.id));
  return events.filter((e) => !e.calendarId || !hiddenIds.has(e.calendarId));
}

/**
 * Where a new event lands: the flagged default, then the first writable visible
 * calendar, then the first writable one. `undefined` when nothing is registered.
 */
export function defaultCalendar(sources: readonly CalendarSource[]): CalendarSource | undefined {
  const writable = sources.filter((s) => !s.readOnly);
  return writable.find((s) => s.isDefault) ?? writable.find(isVisible) ?? writable[0];
}

export function defaultCalendarId(sources: readonly CalendarSource[]): string | undefined {
  return defaultCalendar(sources)?.id;
}

export interface CalendarAccountGroup {
  account: CalendarAccount;
  calendars: CalendarSource[];
}

/**
 * Group calendars under their accounts, both in registration order. A calendar
 * with no registered account gets a placeholder account; empty accounts are kept.
 */
export function groupByAccount(
  accounts: readonly CalendarAccount[],
  sources: readonly CalendarSource[],
): CalendarAccountGroup[] {
  const groups = new Map<string, CalendarAccountGroup>();
  for (const account of accounts) groups.set(account.id, { account, calendars: [] });
  for (const s of sources) {
    let g = groups.get(s.accountId);
    if (!g) {
      g = {
        account: { id: s.accountId, label: s.accountId, provider: "unknown" },
        calendars: [],
      };
      groups.set(s.accountId, g);
    }
    g.calendars.push(s);
  }
  return [...groups.values()];
}

export function findAccount(
  accounts: readonly CalendarAccount[],
  id: string | undefined,
): CalendarAccount | undefined {
  if (!id) return undefined;
  return accounts.find((a) => a.id === id);
}

/** The account new events belong to: the flagged default, else the first one. */
export function defaultAccount(accounts: readonly CalendarAccount[]): CalendarAccount | undefined {
  return accounts.find((a) => a.isDefault) ?? accounts[0];
}

/**
 * The calendar new events land on within one account: its `defaultCalendarId`
 * if still writable here, then the `isDefault` one, then the first writable visible one.
 */
export function accountDefaultCalendar(
  account: CalendarAccount,
  sources: readonly CalendarSource[],
): CalendarSource | undefined {
  const mine = sources.filter((s) => s.accountId === account.id && !s.readOnly);
  const named = mine.find((s) => s.id === account.defaultCalendarId);
  return named ?? mine.find((s) => s.isDefault) ?? mine.find(isVisible) ?? mine[0];
}

/** The default account's default calendar, else {@link defaultCalendar}. */
export function resolveDefaultCalendar(
  accounts: readonly CalendarAccount[],
  sources: readonly CalendarSource[],
): CalendarSource | undefined {
  const account = accounts.find((a) => a.isDefault);
  return (account && accountDefaultCalendar(account, sources)) ?? defaultCalendar(sources);
}

/** The `calendarId` a new event should carry, read off the live registry. */
export function newEventCalendarId(): string | undefined {
  return resolveDefaultCalendar(getCalendarAccounts(), getCalendarSources())?.id;
}

export function providerLabel(account: CalendarAccount): string {
  return account.providerLabel || account.provider || "Calendar";
}

/** Label for an account's conferencing choice, or `undefined`. An unknown id renders as itself. */
export function conferencingLabel(
  account: CalendarAccount,
  providers: readonly ConferencingProvider[] = CONFERENCING_PROVIDERS,
): string | undefined {
  const id = account.defaultConferencing;
  if (!id) return undefined;
  return providers.find((p) => p.id === id)?.label ?? id;
}
