// The lobby — a real room. Phones join live while Gemma writes round 1.

import { useMutation } from 'convex/react';
import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { api } from '../../convex/_generated/api';
import { Avatar, GemmaMark } from '../components/Avatar';
import { fade, rise, useGrow, useSpin } from '../components/motion';
import { BehindSheet } from '../components/sheets/BehindSheet';
import { Btn, Kicker, RoundBtn } from '../components/ui';
import { useRoom, useRoomSession } from '../game/room';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

export default function Lobby() {
  const { t, sh } = useTheme();
  const s = useRoom();
  const { deviceId, roomId, clearRoom } = useRoomSession();
  const leaveRoom = useMutation(api.game.leaveRoom);
  const startGame = useMutation(api.game.startGame);
  const router = useRouter();
  const [behind, setBehind] = React.useState(false);
  const spin = useSpin(3000);
  const humans = s?.players.filter((p) => !p.isAi).length ?? 0;
  const canStart = !!s && s.lobbyReady && s.players.length >= 2;
  const pct = !s ? 10 : s.lobbyReady ? 100 : 40 + Math.min(40, s.players.length * 10);
  const bar = useGrow(pct, 0, 500);

  // room vanished or was closed by the host — state changes live in effects
  const dead = s === null || s?.room.phase === 'closed';
  React.useEffect(() => {
    if (dead) clearRoom();
  }, [dead, clearRoom]);
  if (!roomId || dead) return <Redirect href="/home" />;
  if (s && s.room.phase !== 'lobby') return <Redirect href="/game" />;

  const lines = [
    { mark: '01', text: `Room ${s?.room.code ?? '····'} is open. Real phones join with the code.`, on: true },
    { mark: '02', text: 'I write one question per round and ask everybody at once.', on: true },
    { mark: '03', text: 'Nothing is pre-baked. Round 2 depends on what round 1 says.', on: (s?.players.length ?? 0) >= 2 || !!s?.lobbyReady },
    { mark: '✓', text: 'Round 1 is written. Start when the room feels full.', on: !!s?.lobbyReady, last: true },
  ].filter((l) => l.on);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 58, paddingHorizontal: 22, paddingBottom: 30 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <View>
          <Kicker>room code · shout it</Kicker>
          <Text style={{ fontFamily: fonts.heading, fontSize: 44, letterSpacing: 6, color: t.text }}>
            {s?.room.code ?? '····'}
          </Text>
        </View>
        <RoundBtn
          icon="x"
          onPress={() => {
            if (roomId && deviceId) leaveRoom({ roomId, deviceId }).catch(() => {});
            clearRoom();
            router.replace('/home');
          }}
        />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
        <View style={{ gap: 10, marginBottom: 20 }}>
          {(s?.players ?? []).map((p, i) => (
            <Animated.View
              key={p.id}
              entering={rise(i * 120)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                paddingVertical: 11,
                paddingHorizontal: 14,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: t.divider,
                backgroundColor: t.vRaise,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                <Avatar sym={p.sym} size={44} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15.5, color: t.text }}>
                  {p.isMe ? `${p.name} (you)` : p.name}
                </Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted }}>
                  {p.isMe ? 'this phone' : 'joined with the code'}
                </Text>
              </View>
              <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.accent2_100 }}>
                <Text style={{ fontFamily: fonts.body, fontSize: 11, color: t.accent2_800 }}>here</Text>
              </View>
            </Animated.View>
          ))}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 13,
              paddingVertical: 11,
              paddingHorizontal: 14,
              borderRadius: 22,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: t.divider,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: t.divider,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 18, color: t.textMuted }}>+</Text>
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: t.textMuted }}>
              Seats open — read the code across the room
            </Text>
          </View>
        </View>
        <View style={[{ borderRadius: 26, backgroundColor: t.vRaise, borderWidth: 1, borderColor: t.divider, padding: 17 }, sh.sm]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Animated.View style={spin}>
              <GemmaMark size={15} color={t.accent} />
            </Animated.View>
            <Kicker>gemma 4 · setting up</Kicker>
          </View>
          <View style={{ gap: 7, minHeight: 66 }}>
            {lines.map((l) => (
              <Animated.View key={l.mark} entering={fade()} style={{ flexDirection: 'row', gap: 8 }}>
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
      {s?.room.isHost ? (
        <Btn
          label={
            !s.lobbyReady
              ? 'Gemma is writing round 1…'
              : s.players.length < 2
                ? 'Waiting for one more player…'
                : 'Start round 1'
          }
          size="lg"
          disabled={!canStart}
          onPress={() => {
            if (roomId && deviceId) startGame({ roomId, deviceId }).catch(() => {});
          }}
        />
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 14 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.textMuted }}>
            {humans > 1 ? 'The host starts the game — any second now.' : 'Waiting for the host…'}
          </Text>
        </View>
      )}
      <BehindSheet visible={behind} onClose={() => setBehind(false)} />
    </View>
  );
}
