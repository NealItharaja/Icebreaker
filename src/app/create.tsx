// "Open a room" — friends join with the numeric code; AI floor-mates can
// fill empty seats so the game works even when the hallway is quiet.

import { useMutation } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { api } from '../../convex/_generated/api';
import { AI_SEEDS } from '../../convex/lib';
import { Avatar, GemmaMark } from '../components/Avatar';
import { pop } from '../components/motion';
import { Btn, Heading, Kicker, RoundBtn } from '../components/ui';
import { Spice } from '../game/data';
import { useRoomSession } from '../game/room';
import { useAppStore } from '../store/AppStore';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

export default function Create() {
  const { t } = useTheme();
  const { profile } = useAppStore();
  const { deviceId, enterRoom } = useRoomSession();
  const createRoom = useMutation(api.game.createRoom);
  const router = useRouter();
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const invites = React.useMemo(
    () =>
      (typeof invite === 'string' && invite ? invite.split(',') : [])
        .map((k) => k.replace(/^ai:/, ''))
        .filter((k) => AI_SEEDS.some((s) => s.key === k)),
    [invite],
  );
  const [aiCount, setAiCount] = useState(() => Math.max(2, Math.min(6, invites.length)));
  const [spice, setSpice] = useState<Spice>('chaotic');
  const [opening, setOpening] = useState(false);

  const aiPool = [
    ...AI_SEEDS.filter((s) => invites.includes(s.key)),
    ...AI_SEEDS.filter((s) => !invites.includes(s.key)),
  ];
  const roster = [
    { key: 'me', name: 'you', sym: profile.sym },
    ...aiPool.slice(0, aiCount).map((s) => ({ key: s.key, name: s.name, sym: s.sym })),
  ];

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

  const open = async () => {
    if (!deviceId || opening) return;
    setOpening(true);
    try {
      const res = await createRoom({
        deviceId,
        name: profile.name || 'You',
        sym: profile.sym,
        spice,
        aiCount,
        aiKeys: invites.length ? invites : undefined,
      });
      enterRoom(res.roomId);
      router.push('/lobby');
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 58, paddingHorizontal: 22, paddingBottom: 30 }}>
        <View style={{ alignSelf: 'flex-start', marginBottom: 20 }}>
          <RoundBtn icon="chevronLeft" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
        </View>
        <Heading size={33}>Open a room</Heading>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.textMuted, marginTop: 6, marginBottom: 20 }}>
          Friends join with the code — real phones, real people. Nobody fills anything in first.
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted, marginBottom: 10 }}>
          AI floor-mates to fill empty seats
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 8 }}>
          {stepBtn('−', () => setAiCount((v) => Math.max(0, v - 1)), aiCount <= 0)}
          <Text style={{ fontFamily: fonts.heading, fontSize: 56, lineHeight: 60, color: t.text, width: 78, textAlign: 'center' }}>
            {aiCount}
          </Text>
          {stepBtn('+', () => setAiCount((v) => Math.min(6, v + 1)), aiCount >= 6)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 26, minHeight: 56 }}>
          {roster.map((p) => (
            <Animated.View key={p.key} entering={pop()} style={{ width: 52, alignItems: 'center', gap: 5 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden' }}>
                <Avatar sym={p.sym} size={46} />
              </View>
              <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: t.textMuted, textAlign: 'center' }} numberOfLines={1}>
                {p.name}
              </Text>
            </Animated.View>
          ))}
          <Animated.View entering={pop(120)} style={{ width: 52, alignItems: 'center', gap: 5 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: t.divider,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 20, color: t.textMuted }}>+</Text>
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: t.textMuted, textAlign: 'center' }}>friends</Text>
          </Animated.View>
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
            3 rounds, everyone in the spotlight once per round. Gemma writes every question live once the room opens — nothing is pre-baked.
          </Text>
        </View>
        <View style={{ flex: 1, minHeight: 18 }} />
        <Btn label={opening ? 'Opening…' : 'Open the room'} size="lg" disabled={opening || !deviceId} onPress={open} />
      </ScrollView>
    </View>
  );
}
