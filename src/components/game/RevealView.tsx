// The reveal: every answer and every guess at once, Gemma calling it.
// While Gemma judges, skeleton cards hold the layout — no full-screen wait.

import { useMutation } from 'convex/react';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { api } from '../../../convex/_generated/api';
import { Avatar, GemmaMark } from '../Avatar';
import { pop, rise, useGrow, useSpin } from '../motion';
import { SkeletonCard } from '../Skeleton';
import { Btn, Icon } from '../ui';
import { useRoomSession } from '../../game/room';
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

function Row({ row, meId }: { row: any; meId: string | null }) {
  const { t } = useTheme();
  const good = row.ok || row.tag === '+55';
  const tagBg = good ? t.accent2_100 : row.isTrap ? t.accent100 : t.divider;
  const tagFg = good ? t.accent2_800 : row.isTrap ? t.accent800 : t.textMuted;
  const who = row.gid === meId ? 'you' : row.name;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, overflow: 'hidden' }}>
        <Avatar sym={row.sym} size={30} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18, color: t.text }}>
          <Text style={{ color: t.textMuted }}>{who} </Text>
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

function Card({ card, index, s }: { card: any; index: number; s: any }) {
  const { t, sh } = useTheme();
  const meId = s.meId;
  const archetype = s.round?.archetype;
  const kicker =
    archetype === 'whose' ? 'an anonymous take' : card.sid === meId ? 'about you' : `about ${card.name}`;
  const q =
    archetype === 'whose'
      ? `“${card.take}”`
      : card.sid === meId
        ? s.round?.aboutMe || ''
        : (s.round?.aboutTemplate || '{name}').replace('{name}', card.name);
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
            {kicker}
          </Text>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 19.5, color: t.text }}>{q}</Text>
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
        <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: t.accent2_800 }}>
          {card.sid === meId && archetype === 'whose' ? 'It was you' : card.truth}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {card.rows.map((row: any) => (
          <Row key={row.gid} row={row} meId={meId} />
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
          {card.pts.map((p: any, i: number) => (
            <Animated.View
              key={`${p.text}${i}`}
              entering={pop(400 + i * 80)}
              style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.accent100 }}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 11, color: t.accent800 }}>{p.text}</Text>
            </Animated.View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

export function RevealView({ s, judging }: { s: any; judging: boolean }) {
  const { t } = useTheme();
  const { roomId, deviceId } = useRoomSession();
  const advance = useMutation(api.game.advance);
  const spin = useSpin(3000);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 30, color: t.text }}>Reveal</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted }}>
            everyone at once · round {s.room.r + 1}
          </Text>
        </View>
        {judging && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Animated.View style={spin}>
              <GemmaMark size={14} color={t.accent} />
            </Animated.View>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.textMuted }}>
              judging by meaning, writing the calls…
            </Text>
          </View>
        )}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
        {judging ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          (s.cards || []).map((c: any, i: number) => <Card key={c.sid} card={c} index={i} s={s} />)
        )}
        {!judging && (s.cards || []).length === 0 && (
          <View style={{ borderRadius: 24, backgroundColor: t.surface, padding: 18 }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: t.textMuted, lineHeight: 20 }}>
              Nobody sealed an answer in time — the round evaporates. The next one is kinder.
            </Text>
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26 }}>
        <Btn
          label={s.room.r < 2 ? 'Standings' : 'Final standings'}
          size="lg"
          disabled={judging}
          onPress={() => {
            if (roomId && deviceId) advance({ roomId, deviceId, from: 'reveal' }).catch(() => {});
          }}
        />
      </View>
    </View>
  );
}
