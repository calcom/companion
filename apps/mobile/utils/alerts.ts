/**
 * Alert Utilities
 *
 * Helper functions for showing alerts with environment-aware and platform-aware behavior.
 * On iOS/Android, uses native Alert.alert().
 * On web (browser extension), uses the global toast system for centered notifications.
 * Error alerts are only shown in development mode to avoid confusing users in production.
 */

import { Alert, Platform } from "react-native";

type ToastType = "success" | "error" | "info";

/**
 * Global toast reference (set by ToastProvider)
 * This allows the alert utilities to show toasts on web without requiring React context.
 */
let globalShowToast: ((title: string, message: string, type?: ToastType) => void) | null = null;

/**
 * Set the global toast function. Called by ToastProvider on mount.
 * @param fn - The showToast function from ToastProvider, or null to clear
 */
export const setGlobalToastFunction = (fn: typeof globalShowToast) => {
  globalShowToast = fn;
};

/**
 * Show an error alert only in development mode.
 * On web, shows a centered toast notification.
 * In production, errors are silently logged to console.
 *
 * @param title - The alert title
 * @param message - The error message to display
 */
export const showErrorAlert = (title: string, message: string) => {
  if (Platform.OS === "web" && globalShowToast) {
    if (__DEV__) {
      globalShowToast(title, message, "error");
    } else {
      console.error(`[${title}] ${message}`);
    }
    return;
  }

  if (__DEV__) {
    Alert.alert(title, message);
  } else {
    console.error(`[${title}] ${message}`);
  }
};

/**
 * Show a confirmation alert (always shown - user-initiated actions)
 * This is a direct reference to Alert.alert for consistency.
 * Note: On web, this will not work - use a modal or custom confirmation dialog instead.
 */
export const showConfirmAlert = Alert.alert;

/**
 * Show a success alert (always shown - user feedback)
 * On web, shows a centered toast notification.
 *
 * @param title - The alert title
 * @param message - The success message to display
 */
export const showSuccessAlert = (title: string, message: string) => {
  if (Platform.OS === "web" && globalShowToast) {
    globalShowToast(title, message, "success");
    return;
  }

  Alert.alert(title, message);
};

/**
 * Show a success alert only on web (browser extension).
 * On native (iOS/Android), this is a no-op — the UI state change
 * (navigation, list refresh, etc.) provides sufficient feedback.
 *
 * On web, this only shows feedback when globalShowToast is registered
 * (i.e., when the ToastProvider is mounted). If globalShowToast is null,
 * this is a complete no-op on all platforms.
 */
export const showSilentSuccessAlert = (title: string, message: string) => {
  if (Platform.OS === "web" && globalShowToast) {
    globalShowToast(title, message, "success");
    return;
  }
};

/**
 * Show an info alert (always shown - informational feedback)
 * On web, shows a centered toast notification.
 *
 * @param title - The alert title
 * @param message - The info message to display
 */
export const showInfoAlert = (title: string, message: string) => {
  if (Platform.OS === "web" && globalShowToast) {
    globalShowToast(title, message, "info");
    return;
  }

  Alert.alert(title, message);
};

/**
 * Show a standard "Feature not available" alert for companion app limitations.
 */
export const showNotAvailableAlert = () => {
  Alert.alert(
    "Feature not available",
    "This feature is not available in the app yet. To use, please visit Cal.com.",
    [{ text: "OK", style: "cancel" }]
  );
};
