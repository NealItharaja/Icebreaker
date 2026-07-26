// Winner + what the room actually shares (venn for ≤3, ring graph for more).

import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Avatar } from '../components/Avatar';
import { fade, pop, rise, useBurstOnce, useFloat, useGrow } from '../components/motion';
import { Btn, Kicker } from '../components/ui';
import { ringGeo, regionList, unionOverlaps, vennGeo } from '../game/engine';
import { useGame } from '../game/GameContext';
import { useAppStore } from '../store/AppStore';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

function Burst({ delay, color }: { delay: number; color: string }) {
  const b = useBurstOnce(1600, delay);
  return <Animated.View style={[{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: color }, b]} />;
}

function Crown({ color }: { color: string }) {
  const float = useFloat(3200, 900);
  return (
    <Animated.View style={[{ position: 'absolute', top: -6, zIndex: 2 }, float]}>
      <Svg width={44} height={29} viewBox="0 0 40 26">
        <Path d="M4 22 2 6l9 7 9-11 9 11 9-7-2 16z" fill={color} />
        <Circle cx={2} cy={4.5} r={2.6} fill={color} />
        <Circle cx={38} cy={4.5} r={2.6} fill={color} />
        <Circle cx={20} cy={2.6} r={2.6} fill={color} />
      </Svg>
    </Animated.View>
  );
}

function ScoreRow({ rank, sym, name, score, pct, leader, blurb, delay }: any) {
  const { t, sh } = useTheme();
  const grow = useGrow(pct, 200, 900);
  return (
    <Animated.View entering={fade(delay)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 19, width: 22, color: t.text, opacity: 0.45 }}>{rank}</Text>
      <View style={[{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden' }, sh.sm]}>
        <Avatar sym={sym} size={40} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: t.text }}>{name}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.textMuted, fontVariant: ['tabular-nums'] }}>{score}</Text>
        </View>
        <View style={{ height: 10, borderRadius: 6, backgroundColor: t.divider, overflow: 'hidden' }}>
          <Animated.View style={[{ height: '100%', borderRadius: 6, backgroundColor: leader ? t.accent : t.accent2 }, grow]} />
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: t.textMuted, marginTop: 5 }}>{blurb}</Text>
      </View>
    </Animated.View>
  );
}

export default function Final() {
  const { t, sh } = useTheme();
  const [g, ctrl] = useGame();
  const { recordGame } = useAppStore();
  const router = useRouter();
  const [tab, setTab] = useState<'scores' | 'over'>('scores');

  // the night survives: merge this game into the floor map exactly once
  useEffect(() => {
    const rec = ctrl.takeRecord();
    if (rec) recordGame(rec.botIds, rec.pairs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (g.phase === 'idle' || !g.played) return <Redirect href="/home" />;

  const sorted = g.players.slice().sort((a, b) => (g.scores[b.id] || 0) - (g.scores[a.id] || 0));
  const winner = sorted[0];
  const max = Math.max(100, ...sorted.map((p) => g.scores[p.id] || 0));
  const overlap = ctrl.overlap;
  const venn = g.players.length <= 3 ? vennGeo(g.players, overlap) : null;
  const ring = g.players.length > 3 ? ringGeo(g.players, overlap) : null;
  const myAnswers = g.answersByRound.map((a) => a?.me).filter(Boolean) as string[];
  const regions = regionList(g.players, overlap, myAnswers);

  const vennFill = (role: string) =>
    role === 'a' ? t.accent : role === 'b' ? t.accent2 : role === 'c' ? t.neutral400 : t.text;
  const vennStroke = (role: string) => (role === 'a' ? t.accent600 : role === 'b' ? t.accent2_600 : t.neutral600);
  const labelColor = (role: string) =>
    role === 'a' ? t.accent800 : role === 'b' ? t.accent2_800 : role === 'c' ? t.neutral800 : role === 'bg' ? t.bg : t.text;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: 56, paddingHorizontal: 22 }}>
        <View style={{ alignItems: 'center', paddingBottom: 16 }}>
          <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
            <Burst delay={0} color={t.accent} />
            <Burst delay={280} color={t.accent2} />
            <Burst delay={560} color={t.accent} />
            <Crown color={t.accent} />
            <Animated.View entering={pop(350)} style={[{ width: 108, height: 108, borderRadius: 54, overflow: 'hidden' }, sh.lg]}>
              <Avatar sym={winner.sym} size={108} />
            </Animated.View>
          </View>
          <Animated.View entering={rise(700)} style={{ alignItems: 'center' }}>
            <Kicker style={{ marginTop: 8 }}>knew the room best</Kicker>
            <Text style={{ fontFamily: fonts.heading, fontSize: 40, lineHeight: 44, color: t.text, marginTop: 4, marginBottom: 2 }}>
              {winner.id === 'me' ? 'You' : winner.name}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.textMuted }}>
              {g.scores[winner.id] || 0} points · {winner.id === 'me' ? 'you were paying attention' : 'suspiciously observant'}
            </Text>
          </Animated.View>
        </View>
        <View style={{ flexDirection: 'row', gap: 7, paddingTop: 8, paddingBottom: 14 }}>
          {(
            [
              ['scores', 'Who knew who'],
              ['over', 'What you share'],
            ] as const
          ).map(([k, label]) => {
            const on = tab === k;
            return (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: on ? t.text : t.divider,
                  backgroundColor: on ? t.text : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: on ? t.bg : t.text }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 12 }}>
        {tab === 'scores' ? (
          <View style={{ gap: 13 }}>
            {sorted.map((p, i) => (
              <ScoreRow
                key={p.id}
                rank={i + 1}
                sym={p.sym}
                name={p.id === 'me' ? `${p.name} (you)` : p.name}
                score={g.scores[p.id] || 0}
                pct={Math.round(((g.scores[p.id] || 0) / max) * 100)}
                leader={i === 0}
                blurb={i === 0 ? 'read the room all night' : i === sorted.length - 1 ? 'made up for it in overlaps' : 'solid, with one catastrophic guess'}
                delay={i * 80}
              />
            ))}
          </View>
        ) : (
          <Animated.View entering={fade()}>
            {venn && venn.circles.length > 0 && (
              <Svg width="100%" height={280} viewBox="0 0 260 230" style={{ marginTop: -6, marginBottom: 6 }}>
                {venn.circles.map((c, i) => (
                  <Circle
                    key={i}
                    cx={c.cx}
                    cy={c.cy}
                    r={c.r}
                    fill={vennFill(c.role)}
                    fillOpacity={0.55}
                    stroke={vennStroke(c.role)}
                    strokeWidth={2}
                  />
                ))}
                {venn.labels.map((l, i) => (
                  <SvgText
                    key={i}
                    x={l.x}
                    y={l.y + l.fs * 0.35}
                    fontFamily={fonts.heading}
                    fontSize={l.fs}
                    fill={labelColor(l.role)}
                    textAnchor="middle"
                  >
                    {l.text}
                  </SvgText>
                ))}
              </Svg>
            )}
            {ring && (
              <Svg width="100%" height={260} viewBox="0 0 260 230">
                {ring.edges.map((e, i) => (
                  <Line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={t.accent2} strokeWidth={e.w} strokeOpacity={0.6} strokeLinecap="round" />
                ))}
                {ring.nodes.map((nd) => (
                  <Circle key={nd.id} cx={nd.x} cy={nd.y} r={nd.r} fill={nd.me ? t.accent : t.accent2_600} />
                ))}
              </Svg>
            )}
            <View style={{ gap: 9, marginTop: 10 }}>
              {regions.length === 0 && (
                <View style={{ borderRadius: 22, backgroundColor: t.surface, padding: 15 }}>
                  <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.textMuted, lineHeight: 19 }}>
                    No overlaps surfaced tonight. Rare — and honestly more interesting. Play one more round set.
                  </Text>
                </View>
              )}
              {regions.map((rg) => (
                <View key={rg.title} style={{ borderRadius: 22, backgroundColor: rg.mine ? t.accent100 : t.accent2_100, paddingVertical: 13, paddingHorizontal: 15 }}>
                  <Text
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 11,
                      letterSpacing: 0.7,
                      textTransform: 'uppercase',
                      color: rg.mine ? t.accent800 : t.accent2_800,
                      opacity: 0.85,
                      marginBottom: 7,
                    }}
                  >
                    {rg.title}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {rg.items.map((it) => (
                      <View
                        key={it}
                        style={{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: t.vRaise, borderWidth: 1, borderColor: t.divider }}
                      >
                        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.text }}>{it}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 26 }}>
        <Btn
          label="Your card from gemma"
          size="lg"
          onPress={() => {
            ctrl.buildShare();
            router.push('/share');
          }}
        />
      </View>
    </View>
  );
}
