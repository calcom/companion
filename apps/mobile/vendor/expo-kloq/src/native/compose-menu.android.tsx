import { DropdownMenu, DropdownMenuItem, Text, TextButton } from "@expo/ui/jetpack-compose";
import { useState } from "react";

export interface ComposeMenuItem {
  key: string;
  label: string;
  selected?: boolean;
  onSelect: () => void;
}

/** A Material 3 dropdown: a text button that opens a list of items (Compose has no picker menu). */
export function ComposeMenu({ label, items }: { label: string; items: ComposeMenuItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
      <DropdownMenu.Trigger>
        <TextButton onClick={() => setOpen(true)}>
          <Text>{label}</Text>
        </TextButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            onClick={() => {
              setOpen(false);
              item.onSelect();
            }}
          >
            <DropdownMenuItem.Text>
              <Text>{item.selected ? `✓ ${item.label}` : item.label}</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}
