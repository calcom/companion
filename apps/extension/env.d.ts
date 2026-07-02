/// <reference types="wxt/vite" />

interface ImportMetaEnv {
  readonly EXPO_PUBLIC_CAL_API_KEY?: string;
  readonly EXPO_PUBLIC_COMPANION_DEV_URL?: string;

  // Default OAuth config (Chrome/Brave)
  readonly EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID?: string;
  readonly EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI?: string;
  readonly EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI_EU?: string;

  // Firefox-specific OAuth config
  readonly EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID_FIREFOX?: string;
  readonly EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI_FIREFOX?: string;
  readonly EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI_FIREFOX_EU?: string;

  // Safari-specific OAuth config
  readonly EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID_SAFARI?: string;
  readonly EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI_SAFARI?: string;
  readonly EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI_SAFARI_EU?: string;

  // Edge-specific OAuth config
  readonly EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID_EDGE?: string;
  readonly EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI_EDGE?: string;
  readonly EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI_EDGE_EU?: string;

  // Browser target set during build
  readonly BROWSER_TARGET?: "chrome" | "firefox" | "safari" | "edge";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
