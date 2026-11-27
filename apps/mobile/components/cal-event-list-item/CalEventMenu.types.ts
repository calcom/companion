import type { Button } from "@expo/ui/swift-ui";
import type { ComponentProps } from "react";
import type { AppIconName } from "@/components/AppIcon";

type SFSymbol = Exclude<ComponentProps<typeof Button>["systemImage"], undefined>;

export interface CalEventMenuItem {
  label: string;
  /** The web and Android icon. */
  icon: AppIconName;
  /** The iOS menu's icon. */
  systemImage: SFSymbol;
  onPress: () => void;
  destructive?: boolean;
}

export interface CalEventMenuProps {
  /** The menu's items, a divider between groups; empty groups are left out. */
  groups: CalEventMenuItem[][];
  accessibilityLabel: string;
  /** The web and Android trigger's look, such as a header's round button; a card's by default. */
  triggerClassName?: string;
}
