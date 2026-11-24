/**
 * Alert Utilities
 *
 * Helper functions for showing alerts with environment-aware and platform-aware behavior.
 * On iOS/Android, uses native Alert.alert().
 * On web (browser extension), uses the global toast system for centered notifications, and the
 * global confirm dialog for confirmations.
 * Error alerts are only shown in development mode to avoid confusing users in production.
 */

import { Alert, type AlertButton, Platform } from "react-native";

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

/** A confirmation for the web's confirm dialog: Alert.alert's arguments. */
export interface ConfirmRequest {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

/** Global confirm dialog reference (set by GlobalConfirmDialog), like the toast's. */
let globalShowConfirm: ((request: ConfirmRequest) => void) | null = null;

/**
 * Set the global confirm function. Called by GlobalConfirmDialog on mount.
 * @param fn - The dialog's open function, or null to clear
 */
export const setGlobalConfirmFunction = (fn: typeof globalShowConfirm) => {
  globalShowConfirm = fn;
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
 * Show a confirmation alert (always shown - user-initiated actions), with Alert.alert's buttons.
 * On web, react-native-web's Alert.alert does nothing, so the global confirm dialog asks instead.
 *
 * @param title - The alert title
 * @param message - The question to confirm
 * @param buttons - The choices, as for Alert.alert
 */
export const showConfirmAlert = (
  title: string,
  message?: string,
  buttons: AlertButton[] = [{ text: "OK" }]
) => {
  if (Platform.OS === "web" && globalShowConfirm) {
    globalShowConfirm({ title, message, buttons });
    return;
  }

  Alert.alert(title, message, buttons);
};

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
  showConfirmAlert(
    "Feature not available",
    "This feature is not available in the app yet. To use, please visit Cal.com.",
    [{ text: "OK", style: "cancel" }]
  );
};
