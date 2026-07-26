// "What you actually share" — Gemma's private card + one concrete plan.

import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GemmaMark } from '../components/Avatar';
import { pop, useSpin } from '../components/motion';
import { Btn, Heading, Kicker, StreamedText } from '../components/ui';
import { useGame } from '../game/GameContext';
import { useAppStore } from '../store/AppStore';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

export default function Share() {
  const { t, sh } = useTheme();
  const [g, ctrl] = useGame();
  const { addPlan } = useAppStore();
  const router = useRouter();
  const [noteDone, setNoteDone] = useState(false);
  const spin = useSpin(3000);

  if (g.phase === 'idle') return <Redirect href="/home" />;

  const best = ctrl.bestMatch();
  const chips = noteDone && best ? best.items : [];
  const plan = g.share?.plan;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: 56, paddingHorizontal: 22, paddingBottom: 26 }}>
      <Kicker>written for you only</Kicker>
      <Heading size={31} style={{ marginTop: 3, marginBottom: 18 }}>
        What you actually share
      </Heading>
      <View
        style={[
          { borderRadius: 30, backgroundColor: t.vRaise, borderWidth: 1.5, borderColor: t.accent200, padding: 20, overflow: 'hidden' },
          sh.md,
        ]}
      >
        <View style={{ position: 'absolute', right: -40, bottom: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: t.accent100, opacity: 0.7 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <GemmaMark size={15} color={t.accent} />
          <Kicker>gemma 4 · for {g.players.find((p) => p.id === 'me')?.name || 'you'}</Kicker>
        </View>
        {g.shareLoading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 }}>
            <Animated.View style={spin}>
              <GemmaMark size={15} color={t.accent} />
            </Animated.View>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.textMuted }}>writing your card…</Text>
          </View>
        ) : (
          <StreamedText
            text={g.share?.note}
            style={{ fontFamily: fonts.body, fontSize: 16.5, lineHeight: 25.5, color: t.text }}
            caretColor={t.accent}
            onDone={() => setNoteDone(true)}
          />
        )}
        {chips.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 16 }}>
            {chips.map((c, i) => (
              <Animated.View key={c} entering={pop(i * 100)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.accent2_100 }}>
                <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.accent2_800 }}>{c}</Text>
              </Animated.View>
            ))}
          </View>
        )}
      </View>
      {plan && (
        <View style={{ borderRadius: 28, backgroundColor: t.surface, padding: 18, marginTop: 14 }}>
          <Kicker style={{ marginBottom: 9 }}>one real thing to do about it</Kicker>
          <View style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
            <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 12, lineHeight: 14, color: t.bg, textAlign: 'center' }}>
                {plan.when.replace(' ', '\n')}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 19, lineHeight: 23, color: t.text, marginBottom: 4 }}>{plan.title}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: t.textMuted }}>{plan.why}</Text>
            </View>
          </View>
          <Pressable
            disabled={g.planned}
            onPress={() => {
              ctrl.markPlanned();
              addPlan({ when: plan.when, title: plan.title, why: plan.why, with: best?.player.id });
            }}
            style={{
              marginTop: 14,
              paddingVertical: 13,
              borderRadius: 999,
              backgroundColor: g.planned ? t.accent2 : t.accent,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: t.bg }}>
              {g.planned ? 'On your plans ✓' : 'Add to plans'}
            </Text>
          </Pressable>
        </View>
      )}
      <View style={{ flex: 1, minHeight: 16 }} />
      {/* leaving the flow keeps state; the next createGame resets it */}
      <Btn label="Add these to my floor map" size="lg" onPress={() => router.replace('/map')} />
      <Btn label="Play another game" variant="ghost" size="sm" onPress={() => router.replace('/create')} style={{ marginTop: 6 }} />
    </ScrollView>
  );
}
