import { Button, ContextMenu, Divider, Host, HStack, Image } from "@expo/ui/swift-ui";
import { accessibilityLabel as a11yLabel, buttonStyle, frame } from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Fragment } from "react";
import type { CalEventMenuProps } from "./CalEventMenu.types";

/** An event card's "⋯" menu: the native menu of the Links cards, its groups split by dividers. */
export function CalEventMenu({ groups, accessibilityLabel }: CalEventMenuProps) {
  const shown = groups.filter((group) => group.length > 0);

  return (
    <Host matchContents>
      <ContextMenu
        modifiers={[buttonStyle(isLiquidGlassAvailable() ? "glass" : "bordered")]}
        activationMethod="singlePress"
      >
        <ContextMenu.Items>
          {shown.map((group, index) => (
            <Fragment key={group[0].label}>
              {index > 0 ? <Divider /> : null}
              {group.map((item) => (
                <Button
                  key={item.label}
                  systemImage={item.systemImage}
                  onPress={item.onPress}
                  role={item.destructive ? "destructive" : "default"}
                  label={item.label}
                />
              ))}
            </Fragment>
          ))}
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          <HStack>
            <Image
              systemName="ellipsis"
              color="primary"
              size={24}
              modifiers={[frame({ height: 24, width: 17 }), a11yLabel(accessibilityLabel)]}
            />
          </HStack>
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
