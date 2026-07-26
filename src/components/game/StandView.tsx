// Standings — accuracy on one track, overlaps found on the other.

import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Avatar, GemmaMark } from '../Avatar';
import { pop, useGrow } from '../motion';
import { Btn, Heading, Kicker } from '../ui';
import { GameController, GState } from '../../game/GameContext';
import { unionOverlaps } from '../../game/engine';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

function BoardBar({ pct, leader }: { pct: number; leader: boolean }) {
  const { t } = useTheme();
  const grow = useGrow(pct, 100, 700);
  return (
    <View style={{ height: 8, borderRadius: 5, backgroundColor: t.divider, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: 5, backgroundColor: leader ? t.accent : t.accent2 }, grow]} />
    </View>
  );
}

export function StandView({ g, ctrl }: { g: GState; ctrl: GameController }) {
  const { t } = useTheme();
  const router = useRouter();
  const max = Math.max(100, ...g.players.map((p) => g.scores[p.id] || 0));
  const sorted = g.players.slice().sort((a, b) => (g.scores[b.id] || 0) - (g.scores[a.id] || 0));
  const ov = unionOverlaps(g.pairs);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingTop: 56, paddingHorizontal: 22, paddingBottom: 26 }}>
      <Kicker>after round {g.r + 1}</Kicker>
      <Heading size={31} style={{ marginTop: 3, marginBottom: 20 }}>
        Two things are being counted
      </Heading>
      <View style={{ borderRadius: 26, backgroundColor: t.surface, padding: 17, marginBottom: 12 }}>
        <Kicker style={{ marginBottom: 14 }}>who knows the room</Kicker>
        <View style={{ gap: 12 }}>
          {sorted.map((p, i) => {
            const score = g.scores[p.id] || 0;
            const delta = g.deltas[p.id] || 0;
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden' }}>
                  <Avatar sym={p.sym} size={34} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: t.text }}>
                      {p.id === 'me' ? `${p.name} (you)` : p.name}
                    </Text>
                    <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.textMuted, fontVariant: ['tabular-nums'] }}>
                      {score} {delta > 0 && <Text style={{ color: t.accent700 }}>+{delta}</Text>}
                    </Text>
                  </View>
                  <BoardBar pct={Math.round((score / max) * 100)} leader={i === 0} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ borderRadius: 26, backgroundColor: t.vRaise, borderWidth: 1, borderColor: t.divider, padding: 17, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <Kicker>overlaps found</Kicker>
          <Text style={{ fontFamily: fonts.heading, fontSize: 26, color: t.text }}>{ov.length}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {ov.map((o, i) => (
            <Animated.View
              key={o}
              entering={pop(i * 90)}
              style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.accent2_100 }}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.accent2_800 }}>{o}</Text>
            </Animated.View>
          ))}
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted, marginTop: 12 }}>
          {ov.length ? 'Not a score. These go on your floor map at the end.' : 'Nothing yet — one round is a small sample.'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 15, paddingHorizontal: 4 }}>
        <View style={{ marginTop: 3 }}>
          <GemmaMark size={15} color={t.accent} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, fontStyle: 'italic', color: t.text, opacity: 0.9 }}>
          {g.midNote}
        </Text>
      </View>
      <View style={{ flex: 1, minHeight: 10 }} />
      <Btn
        label={g.r < 2 ? `Round ${g.r + 2} →` : 'See the results'}
        size="lg"
        onPress={() => {
          const last = g.r >= 2;
          ctrl.nextRound();
          if (last) router.replace('/final');
        }}
      />
    </ScrollView>
  );
}
