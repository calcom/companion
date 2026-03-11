// This file serves as the base implementation for platforms without specific extensions.
// Metro bundler will prefer widgetStorage.ios.ts or widgetStorage.android.ts when available.

import type { BookingInput } from "./widgetStorage.shared";

// Re-export shared types and utilities for consumers
export {
  ANDROID_WIDGET_STORAGE_KEY,
  APP_GROUP_IDENTIFIER,
  type BookingInput,
  formatDate,
  formatTime,
  setupWidgetRefreshOnAppStateChange,
  transformBookingsToWidgetData,
  WIDGET_BOOKINGS_KEY,
  type WidgetBookingData,
  type WidgetData,
} from "./widgetStorage.shared";

export async function updateWidgetBookings(_bookings: BookingInput[]): Promise<void> {
  console.warn("Widget updates are not supported on this platform");
}

export async function clearWidgetBookings(): Promise<void> {
  console.warn("Widget clearing is not supported on this platform");
}
