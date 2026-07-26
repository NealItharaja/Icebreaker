// The lobby — the room fills while Gemma genuinely writes round 1.
// Latency is shown, not hidden: "Start" unlocks when the question exists.

import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Avatar, GemmaMark } from '../components/Avatar';
import { fade, rise, useGrow, useSpin } from '../components/motion';
import { BehindSheet } from '../components/sheets/BehindSheet';
import { Btn, Kicker, RoundBtn } from '../components/ui';
import { useGame } from '../game/GameContext';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

export default function Lobby() {
  const { t, sh } = useTheme();
  const [g, ctrl] = useGame();
  const router = useRouter();
  const [behind, setBehind] = React.useState(false);
  const spin = useSpin(3000);
  const bar = useGrow(g.lobbyPct, 0, 500);

  // this screen only exists for the lobby phase — anywhere else, follow the game
  if (g.phase === 'idle') return <Redirect href="/home" />;
  if (g.phase === 'final' || g.phase === 'share') return <Redirect href="/final" />;
  if (g.phase !== 'lobby') return <Redirect href="/game" />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 58, paddingHorizontal: 22, paddingBottom: 30 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <View>
          <Kicker>room code</Kicker>
          <Text style={{ fontFamily: fonts.heading, fontSize: 38, letterSpacing: 1.5, color: t.text }}>{g.code}</Text>
        </View>
        <RoundBtn
          icon="x"
          onPress={() => {
            ctrl.reset();
            router.replace('/home');
          }}
        />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
        <View style={{ gap: 10, marginBottom: 20 }}>
          {g.players.map((p, i) => {
            const joined = g.lobbyLines.length > i || g.ready;
            return (
              <Animated.View
                key={p.id}
                entering={rise(i * 180)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: t.divider,
                  backgroundColor: joined ? t.vRaise : 'transparent',
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Avatar sym={p.sym} size={44} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15.5, color: t.text }}>
                    {p.id === 'me' ? `${p.name} (you)` : p.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted }}>
                    {joined ? (p.bot ? `${p.bot.from} · in the room` : 'this phone') : 'joining…'}
                  </Text>
                </View>
                <View
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: joined ? t.accent2_100 : t.divider,
                  }}
                >
                  <Text style={{ fontFamily: fonts.body, fontSize: 11, color: joined ? t.accent2_800 : t.text }}>
                    {joined ? 'here' : '…'}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
        <View style={[{ borderRadius: 26, backgroundColor: t.vRaise, borderWidth: 1, borderColor: t.divider, padding: 17 }, sh.sm]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Animated.View style={spin}>
              <GemmaMark size={15} color={t.accent} />
            </Animated.View>
            <Kicker>gemma 4 · setting up</Kicker>
          </View>
          <View style={{ gap: 7, minHeight: 88 }}>
            {g.lobbyLines.map((l, i) => (
              <Animated.View key={i} entering={fade()} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: t.textFaint }}>{l.mark}</Text>
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 13.5,
                    lineHeight: 19.5,
                    flex: 1,
                    color: l.last ? t.accent2_700 : t.text,
                  }}
                >
                  {l.text}
                </Text>
              </Animated.View>
            ))}
          </View>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: t.divider, overflow: 'hidden', marginTop: 14 }}>
            <Animated.View style={[{ height: '100%', borderRadius: 3, backgroundColor: t.accent }, bar]} />
          </View>
        </View>
      </ScrollView>
      <Btn label="How the questions get written" variant="ghost" size="sm" onPress={() => setBehind(true)} style={{ marginBottom: 6 }} />
      <Btn
        label={g.ready ? 'Start round 1' : 'Gemma is warming up…'}
        size="lg"
        disabled={!g.ready}
        onPress={() => {
          ctrl.startGame();
          router.replace('/game');
        }}
      />
      <BehindSheet visible={behind} onClose={() => setBehind(false)} />
    </View>
  );
}
