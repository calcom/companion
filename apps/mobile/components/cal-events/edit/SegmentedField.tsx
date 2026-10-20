import { ChoiceChips } from "./EditControls";

export interface SegmentedFieldProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** A short exclusive choice: chips here, a native segmented control on iOS (SegmentedField.ios). */
export function SegmentedField<T extends string>(props: SegmentedFieldProps<T>) {
  return <ChoiceChips {...props} />;
}
