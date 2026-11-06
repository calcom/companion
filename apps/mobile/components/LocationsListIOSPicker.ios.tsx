import { Button, Host, Menu } from "@expo/ui/swift-ui";
import { buttonStyle } from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import type React from "react";
import type { LocationItem, LocationOptionGroup } from "@/types/locations";

const getSFSymbolForType = (type: string) => {
  switch (type) {
    case "address":
      return "mappin.and.ellipse";
    case "link":
      return "link";
    case "phone":
      return "phone";
    default:
      return "video";
  }
};

function isLocationAlreadyAdded(locations: LocationItem[], optionValue: string): boolean {
  return locations.some((loc) => {
    if (loc.type === "integration" && optionValue.startsWith("integrations:")) {
      return loc.integration === optionValue.replace("integrations:", "");
    }
    if (["address", "link", "phone"].includes(loc.type)) {
      return false;
    }
    return loc.type === optionValue;
  });
}

interface LocationsListIOSPickerProps {
  isHeader?: boolean;
  locationOptions: LocationOptionGroup[];
  locations: LocationItem[];
  onSelectOption: (value: string, label: string) => void;
  trigger: React.ReactNode;
}

export function LocationsListIOSPicker({
  isHeader = false,
  locationOptions,
  locations,
  onSelectOption,
  trigger,
}: LocationsListIOSPickerProps) {
  return (
    <Host matchContents>
      <Menu
        modifiers={!isHeader ? [buttonStyle(isLiquidGlassAvailable() ? "glass" : "bordered")] : []}
        label={trigger}
      >
        {locationOptions.flatMap((group) =>
          group.options
            .filter((opt) => !isLocationAlreadyAdded(locations, opt.value))
            .map((option) => (
              <Button
                key={option.value}
                onPress={() => onSelectOption(option.value, option.label)}
                label={option.label}
                systemImage={getSFSymbolForType(option.value)}
              />
            ))
        )}
      </Menu>
    </Host>
  );
}
