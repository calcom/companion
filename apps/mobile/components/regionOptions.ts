import type { CalRegion } from "@/utils/region";

// Shared by RegionPicker.tsx and RegionPicker.ios.tsx. It lives in its own file because on iOS
// "./RegionPicker" resolves to RegionPicker.ios.tsx itself.
export const REGION_OPTIONS: { value: CalRegion; label: string }[] = [
  { value: "us", label: "United States" },
  { value: "eu", label: "European Union" },
];

export function getRegionLabel(region: CalRegion): string {
  return REGION_OPTIONS.find((option) => option.value === region)?.label ?? "United States";
}

export type RegionPickerProps = {
  region: CalRegion;
  onChange: (region: CalRegion) => void;
  disabled?: boolean;
};
