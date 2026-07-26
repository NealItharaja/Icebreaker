// The reveal: every answer and every guess at the same moment, Gemma calling it.

import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Avatar, GemmaMark } from '../Avatar';
import { pop, rise, useGrow } from '../motion';
import { Btn, Icon } from '../ui';
import { GameController, GState } from '../../game/GameContext';
import { RevealCard, RevealRow } from '../../game/types';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

function Meter({ pct, ok, half }: { pct: number; ok: boolean; half: boolean }) {
  const { t } = useTheme();
  const grow = useGrow(pct, 300);
  const fg = ok ? t.accent2 : half ? t.accent : t.neutral500;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
      <View style={{ height: 4, flex: 1, borderRadius: 3, backgroundColor: t.divider, overflow: 'hidden' }}>
        <Animated.View style={[{ height: '100%', borderRadius: 3, backgroundColor: fg }, grow]} />
      </View>
      <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: t.textMuted, fontVariant: ['tabular-nums'] }}>{pct}% match</Text>
    </View>
  );
}

function Row({ row }: { row: RevealRow }) {
  const { t } = useTheme();
  const good = row.ok || row.tag === '+55';
  const tagBg = good ? t.accent2_100 : row.isTrap ? t.accent100 : t.divider;
  const tagFg = good ? t.accent2_800 : row.isTrap ? t.accent800 : t.textMuted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, overflow: 'hidden' }}>
        <Avatar sym={row.sym} size={30} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18, color: t.text }}>
          <Text style={{ color: t.textMuted }}>{row.who} </Text>
          {row.value}
        </Text>
        {row.meter != null && <Meter pct={row.meter} ok={row.ok} half={row.half} />}
      </View>
      <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: tagBg }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: tagFg }}>{row.tag}</Text>
      </View>
    </View>
  );
}

function Card({ card, index }: { card: RevealCard; index: number }) {
  const { t, sh } = useTheme();
  return (
    <Animated.View
      entering={rise(index * 220)}
      style={[
        {
          borderRadius: 28,
          backgroundColor: card.anyOk ? t.vRaise : t.surface,
          borderWidth: 1.5,
          borderColor: card.allMiss ? t.accent300 : t.divider,
          padding: 16,
        },
        sh.sm,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, overflow: 'hidden' }}>
          <Avatar sym={card.sym} size={42} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 11, letterSpacing: 0.75, textTransform: 'uppercase', color: t.textMuted }}>
            {card.kicker}
          </Text>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 19.5, color: t.text }}>{card.q}</Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 10,
          paddingHorizontal: 13,
          borderRadius: 18,
          backgroundColor: t.accent2_100,
          marginBottom: 12,
        }}
      >
        <Icon name="check" size={15} color={t.accent2_800} strokeWidth={3} />
        <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: t.accent2_800 }}>{card.truth}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {card.rows.map((row) => (
          <Row key={row.gid} row={row} />
        ))}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          marginTop: 13,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: t.divider,
        }}
      >
        <View style={{ marginTop: 3 }}>
          <GemmaMark size={14} color={t.accent} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19.5, fontStyle: 'italic', color: t.text, opacity: 0.9 }}>
          {card.gemma}
        </Text>
      </View>
      {card.pts.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>
          {card.pts.map((p, i) => (
            <Animated.View
              key={`${p}${i}`}
              entering={pop(400 + i * 80)}
              style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.accent100 }}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 11, color: t.accent800 }}>{p}</Text>
            </Animated.View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

export function RevealView({ g, ctrl }: { g: GState; ctrl: GameController }) {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 30, color: t.text }}>Reveal</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted }}>everyone at once · round {g.r + 1}</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
        {(g.cards || []).map((c, i) => (
          <Card key={c.sid} card={c} index={i} />
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26 }}>
        <Btn label={g.r < 2 ? 'Standings' : 'Final standings'} size="lg" onPress={() => ctrl.toStandings()} />
      </View>
    </View>
  );
}
