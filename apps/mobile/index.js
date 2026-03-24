import { Platform } from "react-native";

if (Platform.OS !== "web") {
  const { registerWidgetTaskHandler } =
    require("react-native-android-widget");
  const { widgetTaskHandler } = require("./widgets/widgetTaskHandler");
  registerWidgetTaskHandler(widgetTaskHandler);
}

import "expo-router/entry";
