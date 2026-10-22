import type { Button } from "@expo/ui/swift-ui";
import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type SFSymbol = Exclude<ComponentProps<typeof Button>["systemImage"], undefined>;

export interface CalEventMenuItem {
  label: string;
  /** The web and Android icon. */
  icon: keyof typeof Ionicons.glyphMap;
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
