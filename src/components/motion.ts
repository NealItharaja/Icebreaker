// One motion vocabulary, ported from the design's keyframes:
// rise for arrivals, pop for people, burst for waiting and winning,
// grow for bars, float/pulse/spin/blink for ambient life.

import { useEffect } from 'react';
import {
  Easing,
  FadeIn,
  FadeInDown,
  Keyframe,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export const rise = (delay = 0) => FadeInDown.duration(500).delay(delay);
export const fade = (delay = 0) => FadeIn.duration(400).delay(delay);

export const pop = (delay = 0) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.55 }] },
    62: { opacity: 1, transform: [{ scale: 1.08 }] },
    100: { opacity: 1, transform: [{ scale: 1 }] },
  })
    .duration(450)
    .delay(delay);

export const sheetIn = new Keyframe({
  0: { transform: [{ translateY: 600 }] },
  100: { transform: [{ translateY: 0 }] },
})
  .duration(380);

/** vFloat — gentle bob */
export function useFloat(duration = 4400, delay = 0, dist = 7) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-dist, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(v);
  }, [duration, delay, dist, v]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: v.value }] }));
}

/** vPulse — presence dots while thinking */
export function usePulse(active: boolean, duration = 1400) {
  const v = useSharedValue(0.32);
  useEffect(() => {
    if (active) {
      v.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.32, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    } else {
      cancelAnimation(v);
      v.value = withTiming(1, { duration: 200 });
    }
    return () => cancelAnimation(v);
  }, [active, duration, v]);
  return useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: active ? 0.9 + v.value * 0.28 : 1 }],
  }));
}

/** vSpin — the gemma mark at work */
export function useSpin(duration = 3000) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(360, { duration, easing: Easing.linear }), -1);
    return () => cancelAnimation(v);
  }, [duration, v]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${v.value}deg` }] }));
}

/** vBurst — expanding ring, repeating */
export function useBurst(duration = 2400, delay = 0) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.ease) }), -1));
    return () => cancelAnimation(v);
  }, [duration, delay, v]);
  return useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - v.value),
    transform: [{ scale: 0.35 + v.value * 1.95 }],
  }));
}

/** vBurst once — the winner moment */
export function useBurstOnce(duration = 1600, delay = 0) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.ease) }));
    return () => cancelAnimation(v);
  }, [duration, delay, v]);
  return useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - v.value),
    transform: [{ scale: 0.35 + v.value * 1.95 }],
  }));
}

/** vBlink — the streaming caret */
export function useBlink(active: boolean) {
  const v = useSharedValue(1);
  useEffect(() => {
    if (active) {
      v.value = withRepeat(
        withSequence(withTiming(1, { duration: 490 }), withTiming(0, { duration: 10 }), withTiming(0, { duration: 490 }), withTiming(1, { duration: 10 })),
        -1,
      );
    } else {
      cancelAnimation(v);
      v.value = 0;
    }
    return () => cancelAnimation(v);
  }, [active, v]);
  return useAnimatedStyle(() => ({ opacity: v.value }));
}

/** vGrow — bars growing from the left */
export function useGrow(pct: number, delay = 300, duration = 800) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(pct, { duration, easing: Easing.out(Easing.cubic) }));
  }, [pct, delay, duration, v]);
  return useAnimatedStyle(() => ({ width: `${v.value}%` }));
}

/** vDrift — welcome-screen blobs */
export function useDrift(duration = 9000, reverse = false) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    return () => cancelAnimation(v);
  }, [duration, v]);
  return useAnimatedStyle(() => ({
    transform: [
      { translateX: v.value * (reverse ? -7 : 7) },
      { translateY: v.value * (reverse ? 11 : -11) },
      { rotate: `${v.value * (reverse ? -4 : 4)}deg` },
    ],
  }));
}
