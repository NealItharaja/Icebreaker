// "Open a room" — real friends join with the four digits. That's it.

import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { api } from '../../convex/_generated/api';
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
  const [spice, setSpice] = useState<Spice>('chaotic');
  const [opening, setOpening] = useState(false);

  const open = async () => {
    if (!deviceId || opening) return;
    setOpening(true);
    try {
      const res = await createRoom({
        deviceId,
        name: profile.name || 'You',
        sym: profile.sym,
        spice,
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
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.textMuted, marginTop: 6, marginBottom: 24 }}>
          You get four digits. Read them across the hallway — everyone joins from their own phone. Nobody fills anything in first.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 26 }}>
          <Animated.View entering={pop()} style={{ alignItems: 'center', gap: 5, width: 56 }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden' }}>
              <Avatar sym={profile.sym} size={50} />
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: t.textMuted }}>you</Text>
          </Animated.View>
          {[0, 1, 2].map((i) => (
            <Animated.View key={i} entering={pop(120 + i * 90)} style={{ alignItems: 'center', gap: 5, width: 56 }}>
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: t.divider,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: fonts.body, fontSize: 20, color: t.textMuted }}>+</Text>
              </View>
              <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: t.textMuted }}>{i === 2 ? '· · ·' : 'friend'}</Text>
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
            3 rounds, everyone in the spotlight once per round. Gemma writes every question live once the room opens — nothing is pre-baked.
          </Text>
        </View>
        <View style={{ flex: 1, minHeight: 18 }} />
        <Btn label={opening ? 'Opening…' : 'Open the room'} size="lg" disabled={opening || !deviceId} onPress={open} />
      </ScrollView>
    </View>
  );
}
