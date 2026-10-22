import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from "react";
import type { GestureResponderEvent, PressableProps, ViewStyle } from "react-native";
import { Platform, Pressable, StyleSheet } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type AppPressableProps = PressableProps & {
  className?: string;
  style?: ViewStyle;
  enableHaptics?: boolean;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
  /** @deprecated Use the built-in animation instead. Kept for backward compatibility. */
  activeOpacity?: number;
};

function usePressAnimations(activeOpacity: number) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const animatePressIn = useCallback(
    (op: SharedValue<number>, sc: SharedValue<number>) => {
      op.value = withTiming(activeOpacity, { duration: 100 });
      sc.value = withTiming(0.98, { duration: 100 });
    },
    [activeOpacity]
  );

  const animatePressOut = useCallback((op: SharedValue<number>, sc: SharedValue<number>) => {
    op.value = withTiming(1, { duration: 100 });
    sc.value = withTiming(1, { duration: 100 });
  }, []);

  return { animatedStyle, animatePressIn, animatePressOut, opacity, scale };
}

export const AppPressable = React.forwardRef<React.ElementRef<typeof Pressable>, AppPressableProps>(
  (
    {
      className,
      style,
      enableHaptics = true,
      hapticStyle = Haptics.ImpactFeedbackStyle.Light,
      activeOpacity = 0.7,
      onPressIn,
      onPressOut,
      onPress,
      ...props
    },
    ref
  ) => {
    const { animatedStyle, animatePressIn, animatePressOut, opacity, scale } =
      usePressAnimations(activeOpacity);

    const handlePressIn = useCallback(
      (event: GestureResponderEvent) => {
        animatePressIn(opacity, scale);
        onPressIn?.(event);
      },
      [animatePressIn, onPressIn, opacity, scale]
    );

    const handlePressOut = useCallback(
      (event: GestureResponderEvent) => {
        animatePressOut(opacity, scale);
        onPressOut?.(event);
      },
      [animatePressOut, onPressOut, opacity, scale]
    );

    const handlePress = useCallback(
      (event: GestureResponderEvent) => {
        if (enableHaptics) {
          Haptics.impactAsync(hapticStyle);
        }
        onPress?.(event);
      },
      [enableHaptics, hapticStyle, onPress]
    );

    if (Platform.OS === "web") {
      return (
        <WebPressable
          ref={ref}
          className={className}
          style={style}
          activeOpacity={activeOpacity}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={handlePress}
          {...props}
        />
      );
    }

    return (
      <AnimatedPressable
        ref={ref}
        className={className}
        style={[style, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        {...props}
      />
    );
  }
);

AppPressable.displayName = "AppPressable";

const WEB_PRESS_TRANSITION = {
  transitionProperty: "opacity, transform",
  transitionDuration: "100ms",
} as ViewStyle;

/**
 * The web's AppPressable. NativeWind styles className only on the components it knows: the
 * animated Pressable isn't one there (a "pill" showed as bare text). So the plain Pressable takes
 * the classes, and the press feedback is a CSS transition.
 */
const WebPressable = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  PressableProps & { className?: string; style?: ViewStyle; activeOpacity: number }
>(({ style, activeOpacity, onPressIn, onPressOut, ...props }, ref) => {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      ref={ref}
      // One object, not an array: NativeWind pushes the class styles into a style array, and the
      // React Compiler hands the same array back each render, so old classes piled up.
      style={StyleSheet.flatten([
        style,
        WEB_PRESS_TRANSITION,
        pressed ? { opacity: activeOpacity, transform: [{ scale: 0.98 }] } : null,
      ])}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      {...props}
    />
  );
});

WebPressable.displayName = "WebPressable";
