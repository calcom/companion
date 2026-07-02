export function resolveCorsOrigin(configuredOrigin: string | undefined, serverUrl: string): string {
  if (configuredOrigin) return configuredOrigin;
  return new URL(serverUrl).origin;
}
