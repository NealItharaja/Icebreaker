// Shared round chrome: header + timer, presence row, waiting center.

import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Avatar, VennLogo } from '../Avatar';
import { fade, useBurst, useFloat, usePulse } from '../motion';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

export function RoundHeader({
  r,
  tag,
  tagTone,
  tleft,
  pct,
  showTimer,
}: {
  r: number;
  tag: string;
  tagTone: 'accent' | 'accent2';
  tleft: number;
  pct: number;
  showTimer: boolean;
}) {
  const { t } = useTheme();
  const w = useSharedValue(100);
  useEffect(() => {
    w.value = withTiming(pct, { duration: 900, easing: Easing.linear });
  }, [pct, w]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  const urgent = showTimer && tleft <= 8;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Text style={{ fontFamily: fonts.heading, fontSize: 18, color: t.text }}>Round {r + 1} of 3</Text>
        <View
          style={{
            paddingVertical: 4,
            paddingHorizontal: 9,
            borderRadius: 999,
            backgroundColor: tagTone === 'accent' ? t.accent100 : t.accent2_100,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 10.5,
              letterSpacing: 1.3,
              color: tagTone === 'accent' ? t.accent800 : t.accent2_800,
            }}
          >
            {tag}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.textMuted, fontVariant: ['tabular-nums'] }}>
          {showTimer ? `${tleft}s` : ''}
        </Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: t.divider, overflow: 'hidden', marginBottom: 16 }}>
        <Animated.View style={[{ height: '100%', borderRadius: 3, backgroundColor: urgent ? t.accent : t.accent2 }, bar]} />
      </View>
    </View>
  );
}

function Dot({ done }: { done: boolean }) {
  const { t } = useTheme();
  const pulse = usePulse(!done);
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          right: -2,
          bottom: -2,
          width: 15,
          height: 15,
          borderRadius: 8,
          backgroundColor: done ? t.accent2 : t.accent300,
          borderWidth: 2,
          borderColor: t.bg,
        },
        pulse,
      ]}
    />
  );
}

export function PresenceRow({
  players,
  doneMap,
  label,
}: {
  players: { id: string; sym: number }[];
  doneMap: Record<string, boolean>;
  label: string;
}) {
  const { t } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingTop: 12,
        paddingBottom: 4,
        paddingHorizontal: 4,
        borderTopWidth: 1,
        borderTopColor: t.divider,
        marginTop: 12,
      }}
    >
      {players.map((p) => {
        const done = !!doneMap[p.id];
        return (
          <View key={p.id} style={{ width: 38, height: 38 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, overflow: 'hidden', opacity: done ? 1 : 0.5 }}>
              <Avatar sym={p.sym} size={38} />
            </View>
            <Dot done={done} />
          </View>
        );
      })}
      <View style={{ flex: 1 }} />
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted }}>{label}</Text>
    </View>
  );
}

export function WaitCenter({ title, sub }: { title: string; sub: string }) {
  const { t } = useTheme();
  const b1 = useBurst(2400, 0);
  const b2 = useBurst(2400, 800);
  const float = useFloat(3400, 0);
  return (
    <Animated.View entering={fade()} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <View style={{ width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
        <Animated.View style={[{ position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: t.accent }, b1]} />
        <Animated.View style={[{ position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: t.accent2 }, b2]} />
        <Animated.View style={float}>
          <VennLogo width={82} />
        </Animated.View>
      </View>
      <Text style={{ fontFamily: fonts.heading, fontSize: 26, lineHeight: 30, color: t.text, textAlign: 'center', marginBottom: 8 }}>
        {title}
      </Text>
      <Text
        style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: t.textMuted, textAlign: 'center', maxWidth: 250 }}
      >
        {sub}
      </Text>
    </Animated.View>
  );
}
