import { getNativeRouteFromAppLink } from "@/utils/app-link-navigation";

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return getNativeRouteFromAppLink(path);
}
