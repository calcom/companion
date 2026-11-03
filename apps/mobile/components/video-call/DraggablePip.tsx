import * as Haptics from "expo-haptics";
import { type ReactNode, useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  cornerPosition,
  nearestCorner,
  type PipBounds,
  type PipCorner,
} from "@/services/cal-video/pip-snap";

const SPRING = { damping: 22, stiffness: 240, mass: 0.8 };

function park() {
  Haptics.selectionAsync().catch(() => undefined);
}

/**
 * A tile you can drag anywhere and let go of: it glides to the nearest corner, a flick carrying
 * it toward the one it was thrown at. It keeps its corner when the surface resizes. Taps still
 * reach the content, since a drag only begins after a few points of movement.
 */
export function DraggablePip({
  bounds,
  style,
  children,
}: {
  bounds: PipBounds;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  // Gesture worklets write shared values the compiler treats as frozen; Reanimated owns them.
  "use no memo";
  const corner = useSharedValue<PipCorner>("bottom-right");
  const initial = cornerPosition("bottom-right", bounds);
  const x = useSharedValue(initial.x);
  const y = useSharedValue(initial.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const { width, height, pipWidth, pipHeight, top, bottom, side } = bounds;
  useEffect(() => {
    const target = cornerPosition(corner.value, {
      width,
      height,
      pipWidth,
      pipHeight,
      top,
      bottom,
      side,
    });
    x.value = withSpring(target.x, SPRING);
    y.value = withSpring(target.y, SPRING);
  }, [corner, x, y, width, height, pipWidth, pipHeight, top, bottom, side]);

  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((event) => {
      x.value = startX.value + event.translationX;
      y.value = startY.value + event.translationY;
    })
    .onEnd((event) => {
      const next = nearestCorner(
        { x: x.value, y: y.value },
        { x: event.velocityX, y: event.velocityY },
        bounds
      );
      corner.value = next;
      const target = cornerPosition(next, bounds);
      x.value = withSpring(target.x, { ...SPRING, velocity: event.velocityX });
      y.value = withSpring(target.y, { ...SPRING, velocity: event.velocityY });
      runOnJS(park)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.base, { width: pipWidth, height: pipHeight }, style, animatedStyle]}
        accessibilityHint="Drag to move to another corner"
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = {
  base: { position: "absolute" as const, left: 0, top: 0 },
};
