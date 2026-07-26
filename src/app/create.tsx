// "How many of you?" — count, spice, and the plan. Nobody fills anything in.

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Avatar, GemmaMark } from '../components/Avatar';
import { pop } from '../components/motion';
import { Btn, Heading, Kicker, RoundBtn } from '../components/ui';
import { Spice } from '../game/data';
import { rosterFor, useGame } from '../game/GameContext';
import { useAppStore } from '../store/AppStore';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

export default function Create() {
  const { t } = useTheme();
  const { profile } = useAppStore();
  const [, ctrl] = useGame();
  const router = useRouter();
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const invites = React.useMemo(
    () => (typeof invite === 'string' && invite ? invite.split(',').filter(Boolean) : []),
    [invite],
  );
  // when specific people were promised a game, size the room to fit them
  const [n, setN] = useState(() => Math.min(7, Math.max(3, invites.length + 1)));
  const [spice, setSpice] = useState<Spice>('chaotic');

  const pool = rosterFor(invites);
  const roster = [{ id: 'me', name: 'you', sym: profile.sym }, ...pool.slice(0, n - 1).map((b) => ({ id: b.id, name: b.name, sym: b.sym }))];

  const stepBtn = (label: string, onPress: () => void, disabled: boolean) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 1.5,
        borderColor: t.divider,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
        backgroundColor: pressed ? 'rgba(127,127,127,0.1)' : 'transparent',
      })}
    >
      <Text style={{ fontFamily: fonts.body, fontSize: 26, color: t.text, lineHeight: 30 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 58, paddingHorizontal: 22, paddingBottom: 30 }}>
        <View style={{ alignSelf: 'flex-start', marginBottom: 20 }}>
          <RoundBtn icon="chevronLeft" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
        </View>
        <Heading size={33}>How many of you?</Heading>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.textMuted, marginTop: 6, marginBottom: 20 }}>
          Everyone joins with the code. Nobody fills anything in first.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 8 }}>
          {stepBtn('−', () => setN((v) => Math.max(2, v - 1)), n <= 2)}
          <Text style={{ fontFamily: fonts.heading, fontSize: 56, lineHeight: 60, color: t.text, width: 78, textAlign: 'center' }}>{n}</Text>
          {stepBtn('+', () => setN((v) => Math.min(7, v + 1)), n >= 7)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 26, minHeight: 56 }}>
          {roster.map((p) => (
            <Animated.View key={p.id} entering={pop()} style={{ width: 52, alignItems: 'center', gap: 5 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden' }}>
                <Avatar sym={p.sym} size={46} />
              </View>
              <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: t.textMuted, textAlign: 'center' }} numberOfLines={1}>
                {p.name}
              </Text>
            </Animated.View>
          ))}
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted, marginBottom: 10 }}>How mean should gemma be?</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 26 }}>
          {(['cozy', 'chaotic', 'unhinged'] as Spice[]).map((s) => {
            const on = spice === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSpice(s)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: on ? t.accent : t.divider,
                  backgroundColor: on ? t.accent : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: on ? t.bg : t.text }}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ borderRadius: 24, backgroundColor: t.surface, padding: 17 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <GemmaMark size={14} color={t.accent} />
            <Kicker>the plan</Kicker>
          </View>
          <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: t.text }}>
            3 rounds · {n} answers per round · about {4 + n} minutes. Everyone is in the spotlight once per round.
          </Text>
        </View>
        <View style={{ flex: 1, minHeight: 18 }} />
        <Btn
          label="Open the room"
          size="lg"
          onPress={() => {
            ctrl.createGame(profile, n, spice, undefined, invites);
            router.push('/lobby');
          }}
        />
      </ScrollView>
    </View>
  );
}
