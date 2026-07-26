// "What you actually share" — Gemma writes your private card server-side;
// a skeleton paragraph holds the space while it thinks.

import { useAction } from 'convex/react';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { api } from '../../convex/_generated/api';
import { pairKey } from '../../convex/lib';
import { GemmaMark } from '../components/Avatar';
import { pop } from '../components/motion';
import { SkeletonParagraph, Skeleton } from '../components/Skeleton';
import { Btn, Heading, Kicker, StreamedText } from '../components/ui';
import { useRoom, useRoomSession } from '../game/room';
import { useAppStore } from '../store/AppStore';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

type Card = { note: string; plan?: { when: string; title: string; why: string } | null };

export default function Share() {
  const { t, sh } = useTheme();
  const s = useRoom();
  const { roomId, deviceId, clearRoom } = useRoomSession();
  const shareAction = useAction(api.ai.shareAction);
  const { addPlan, plans } = useAppStore();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [noteDone, setNoteDone] = useState(false);
  const [planned, setPlanned] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (!roomId || !deviceId || asked.current) return;
    if (s?.myShare?.note) {
      setCard(s.myShare as Card);
      asked.current = true;
      return;
    }
    if (s?.room.phase === 'final') {
      asked.current = true;
      shareAction({ roomId, deviceId })
        .then((c) => c && setCard(c))
        .catch(() => {});
    }
  }, [roomId, deviceId, s?.room.phase, s?.myShare, shareAction]);

  if (!roomId) return <Redirect href="/home" />;
  if (s === null) {
    clearRoom();
    return <Redirect href="/home" />;
  }

  const me = s?.players.find((p) => p.isMe);
  const pairs: Record<string, string[]> = s?.room.pairs || {};
  let bestName: string | null = null;
  let bestItems: string[] = [];
  if (s?.meId) {
    s.players
      .filter((p) => !p.isMe)
      .forEach((p) => {
        const items = pairs[pairKey(s.meId!, p.id)] || [];
        if (items.length > bestItems.length) {
          bestItems = items;
          bestName = p.name;
        }
      });
  }
  const chips = noteDone ? bestItems : [];
  const plan = card?.plan;

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
          <Kicker>gemma 4 · for {me?.name || 'you'}</Kicker>
        </View>
        {!card ? (
          <SkeletonParagraph lines={4} />
        ) : (
          <StreamedText
            text={card.note}
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
      <View style={{ borderRadius: 28, backgroundColor: t.surface, padding: 18, marginTop: 14 }}>
        <Kicker style={{ marginBottom: 9 }}>one real thing to do about it</Kicker>
        {!plan ? (
          <View style={{ flexDirection: 'row', gap: 13 }}>
            <Skeleton width={46} height={46} radius={16} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={17} />
              <Skeleton width="90%" height={12} />
            </View>
          </View>
        ) : (
          <>
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
              disabled={planned}
              onPress={() => {
                setPlanned(true);
                addPlan({ when: plan.when, title: plan.title, why: plan.why });
              }}
              style={{
                marginTop: 14,
                paddingVertical: 13,
                borderRadius: 999,
                backgroundColor: planned ? t.accent2 : t.accent,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: t.bg }}>
                {planned ? 'On your plans ✓' : 'Add to plans'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
      <View style={{ flex: 1, minHeight: 16 }} />
      <Btn
        label="Add these to my floor map"
        size="lg"
        onPress={() => {
          clearRoom();
          router.replace('/map');
        }}
      />
      <Btn
        label="Play another game"
        variant="ghost"
        size="sm"
        onPress={() => {
          clearRoom();
          router.replace('/create');
        }}
        style={{ marginTop: 6 }}
      />
    </ScrollView>
  );
}
