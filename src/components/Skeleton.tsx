// Shimmering skeletons — shown in place wherever Gemma is writing.

import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

export function Skeleton({
  width,
  height = 14,
  radius,
  style,
}: {
  width: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { t } = useTheme();
  const v = useSharedValue(0.45);
  useEffect(() => {
    v.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    return () => cancelAnimation(v);
  }, [v]);
  const anim = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius ?? height / 2, backgroundColor: t.divider },
        anim,
        style,
      ]}
    />
  );
}

/** A question being written: two title lines + a hint line. */
export function SkeletonQuestion() {
  return (
    <View style={{ gap: 9, marginBottom: 18 }}>
      <Skeleton width="92%" height={26} radius={8} />
      <Skeleton width="60%" height={26} radius={8} />
      <Skeleton width="45%" height={13} style={{ marginTop: 4 }} />
    </View>
  );
}

/** A row of chip-shaped placeholders. */
export function SkeletonChips({ count = 6 }: { count?: number }) {
  const widths = [96, 128, 84, 110, 92, 140, 88, 118];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} height={40} radius={999} />
      ))}
    </View>
  );
}

/** Tall option rows (lie drafts, guess options). */
export function SkeletonOptions({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: 9 }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width="100%" height={50} radius={22} />
      ))}
    </View>
  );
}

/** A reveal card being judged/written. */
export function SkeletonCard() {
  const { t } = useTheme();
  return (
    <View style={{ borderRadius: 28, backgroundColor: t.surface, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Skeleton width={42} height={42} radius={21} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="35%" height={10} />
          <Skeleton width="80%" height={14} />
        </View>
      </View>
      <Skeleton width="100%" height={40} radius={18} />
      <Skeleton width="88%" height={13} />
      <Skeleton width="70%" height={13} />
    </View>
  );
}

/** The share card being written. */
export function SkeletonParagraph({ lines = 4 }: { lines?: number }) {
  const widths: `${number}%`[] = ['96%', '90%', '94%', '62%', '85%'];
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} height={15} />
      ))}
    </View>
  );
}
