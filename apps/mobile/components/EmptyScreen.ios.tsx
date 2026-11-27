import { ContentUnavailableView, Host } from "@expo/ui/swift-ui";
import { View } from "react-native";
import { SystemButton } from "@/components/SystemButton";
import { getSFSymbolForIonicon } from "@/constants/sfSymbols";
import type { EmptyScreenProps } from "./EmptyScreen";

/**
 * iOS: SwiftUI's ContentUnavailableView, the empty state Mail, Files and Notes use, so the
 * symbol, title and description get the system's sizes, colors and Dynamic Type. The optional
 * action sits under it as a bordered-prominent capsule, as Apple places it.
 */
export function EmptyScreen({
  icon,
  headline,
  description,
  buttonText,
  onButtonPress,
  className,
}: EmptyScreenProps) {
  return (
    <View
      className={className}
      style={{ width: "100%", alignItems: "center", paddingVertical: 24 }}
    >
      <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <ContentUnavailableView
          title={headline}
          description={description}
          systemImage={getSFSymbolForIonicon(icon)}
        />
      </Host>
      {buttonText && onButtonPress ? (
        <SystemButton title={buttonText} onPress={onButtonPress} style={{ marginTop: 8 }} />
      ) : null}
    </View>
  );
}
