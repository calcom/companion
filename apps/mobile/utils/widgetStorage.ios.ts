import { ExtensionStorage } from "@bacons/apple-targets";
import {
  APP_GROUP_IDENTIFIER,
  type BookingInput,
  transformBookingsToWidgetData,
  WIDGET_BOOKINGS_KEY,
  type WidgetData,
} from "./widgetStorage.shared";

const iosStorage = new ExtensionStorage(APP_GROUP_IDENTIFIER);

async function updateIOSWidget(widgetData: WidgetData): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: ExtensionStorage.set() expects any for the value parameter
  iosStorage.set(WIDGET_BOOKINGS_KEY, widgetData as any);

  ExtensionStorage.reloadWidget();
}

export async function updateWidgetBookings(bookings: BookingInput[]): Promise<void> {
  try {
    const widgetData = transformBookingsToWidgetData(bookings);
    await updateIOSWidget(widgetData);
  } catch (error) {
    console.warn("Failed to update widget bookings:", error);
  }
}

export async function clearWidgetBookings(): Promise<void> {
  try {
    const emptyData: WidgetData = {
      bookings: [],
      lastUpdated: new Date().toISOString(),
    };
    await updateIOSWidget(emptyData);
  } catch (error) {
    console.warn("Failed to clear widget bookings:", error);
  }
}

// Re-export shared utilities
export * from "./widgetStorage.shared";
