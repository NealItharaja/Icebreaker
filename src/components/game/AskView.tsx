// Ask phase against the live room: Gemma's question arrives as a skeleton
// fills in; you seal, make the spotlight move, then wait for real phones.

import { useMutation } from 'convex/react';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { api } from '../../../convex/_generated/api';
import { ASK_MS } from '../../../convex/lib';
import { Avatar, GemmaMark } from '../Avatar';
import { pop, rise, useSpin } from '../motion';
import { SkeletonChips, SkeletonOptions, SkeletonQuestion, Skeleton } from '../Skeleton';
import { Btn, Chip, Icon, StreamedText } from '../ui';
import { useCountdown, useRoomSession } from '../../game/room';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { PresenceRow, RoundHeader, WaitCenter } from './chrome';

export function OptionRow({
  label,
  selected,
  onPress,
  sym,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  sym?: number;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: selected ? t.accent : t.divider,
        backgroundColor: selected ? t.accent : 'transparent',
        opacity: disabled && !selected ? 0.6 : 1,
      }}
    >
      {sym != null && (
        <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>
          <Avatar sym={sym} size={32} />
        </View>
      )}
      <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15.5, color: selected ? t.bg : t.text }}>{label}</Text>
      {selected && <Icon name="check" size={17} color={t.bg} strokeWidth={3} />}
    </Pressable>
  );
}

export function AskView({ s }: { s: any }) {
  const { t } = useTheme();
  const { roomId, deviceId } = useRoomSession();
  const sealAnswer = useMutation(api.game.sealAnswer);
  const setSelfMove = useMutation(api.game.setSelfMove);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const spin = useSpin(3400);
  const { tleft, pct } = useCountdown(s.room.deadline, ASK_MS);

  const round = s.round;
  const me = s.players.find((p: any) => p.isMe);
  const humans = s.players.filter((p: any) => !p.isAi);
  const askStep = !s.myMove?.sealed ? 0 : !s.myMove?.ready ? 1 : 2;
  const pendingNames = humans.filter((p: any) => !s.ready[p.id] && !p.isMe).map((p: any) => p.name);
  const sealedCount = s.players.filter((p: any) => s.ready[p.id]).length;

  const seal = async (v: string) => {
    if (!roomId || !deviceId || busy || !v.trim()) return;
    setBusy(true);
    try {
      await sealAnswer({ roomId, deviceId, answer: v.trim() });
      setDraft('');
    } finally {
      setBusy(false);
    }
  };
  const self = async (v: string) => {
    if (!roomId || !deviceId || busy) return;
    setBusy(true);
    try {
      await setSelfMove({ roomId, deviceId, value: v });
    } finally {
      setBusy(false);
    }
  };

  const selfOptions = () => {
    if (!round) return null;
    if (round.archetype === 'tap') {
      if (!s.myMove?.lieDrafts) {
        return (
          <View style={{ gap: 9 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 3 }}>
              <Animated.View style={spin}>
                <GemmaMark size={14} color={t.accent} />
              </Animated.View>
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.textMuted }}>
                drafting lies around “{s.myMove?.answer}”…
              </Text>
            </View>
            <SkeletonOptions count={3} />
          </View>
        );
      }
      return (
        <View style={{ gap: 9 }}>
          {s.myMove.lieDrafts.map((lie: string, i: number) => (
            <Animated.View key={lie} entering={pop(i * 90)}>
              <OptionRow label={lie} selected={s.myMove?.planted === lie} onPress={() => self(lie)} disabled={busy} />
            </Animated.View>
          ))}
        </View>
      );
    }
    if (round.archetype === 'type') {
      return (
        <View style={{ gap: 9 }}>
          {Array.from({ length: s.players.length }, (_, i) => (
            <OptionRow key={i} label={String(i)} selected={s.myMove?.selfMove === String(i)} onPress={() => self(String(i))} disabled={busy} />
          ))}
        </View>
      );
    }
    return (
      <View style={{ gap: 9 }}>
        {s.players
          .filter((p: any) => !p.isMe)
          .map((p: any) => (
            <OptionRow key={p.id} label={p.name} sym={p.sym} selected={s.myMove?.selfMove === p.id} onPress={() => self(p.id)} disabled={busy} />
          ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 18 }}>
      <RoundHeader r={s.room.r} tag="YOUR TURN" tagTone="accent" tleft={tleft} pct={pct} showTimer={!!round && s.room.deadline != null} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 16 }}>
        <Animated.View style={[{ marginTop: 3 }, spin]}>
          <GemmaMark size={15} color={t.accent} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          {round ? (
            <StreamedText
              text={round.intro}
              style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: t.text, opacity: 0.75 }}
              caretColor={t.accent}
            />
          ) : (
            <Skeleton width="85%" height={13} style={{ marginTop: 3 }} />
          )}
        </View>
      </View>

      {askStep === 0 && (
        <Animated.View entering={rise()} style={{ flex: 1, minHeight: 0 }}>
          {round ? (
            <>
              <Text style={{ fontFamily: fonts.heading, fontSize: 29, lineHeight: 33, color: t.text, marginBottom: 6 }}>
                {round.q}
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.textMuted, marginBottom: 16 }}>{round.hint}</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={round.archetype === 'whose' ? 'the one that ends friendships' : 'in your own words…'}
                placeholderTextColor={t.textFaint}
                returnKeyType="done"
                onSubmitEditing={() => seal(draft)}
                style={{
                  fontFamily: fonts.body,
                  fontSize: 17,
                  minHeight: 52,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: t.divider,
                  backgroundColor: t.surface,
                  color: t.text,
                  marginBottom: 14,
                }}
              />
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}
                showsVerticalScrollIndicator={false}
              >
                {round.chips.map((c: string) => (
                  <Chip key={c} label={c} selected={s.myMove?.answer === c} onPress={() => seal(c)} disabled={busy} />
                ))}
              </ScrollView>
              {!!draft.trim() && <Btn label="Seal it" disabled={busy} onPress={() => seal(draft)} style={{ marginTop: 14 }} />}
            </>
          ) : (
            <>
              <SkeletonQuestion />
              <Skeleton width="100%" height={52} radius={999} style={{ marginBottom: 14 }} />
              <SkeletonChips count={7} />
            </>
          )}
        </Animated.View>
      )}

      {askStep === 1 && round && (
        <Animated.View entering={rise()} style={{ flex: 1, minHeight: 0 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              paddingVertical: 5,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: t.accent,
              marginBottom: 14,
            }}
          >
            <Text style={{ fontFamily: fonts.body, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: t.bg }}>
              sealed · one more thing
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.heading, fontSize: 29, lineHeight: 33, color: t.text, marginBottom: 6 }}>
            {round.selfQ}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.textMuted, marginBottom: 18 }}>{round.selfHint}</Text>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {selfOptions()}
          </ScrollView>
        </Animated.View>
      )}

      {askStep === 2 && (
        <WaitCenter
          title={pendingNames.length ? `Waiting on ${pendingNames.join(' and ')}` : 'Closing the round…'}
          sub="Nobody's answer is visible yet — not even to Gemma's reveal until the round closes."
        />
      )}

      <PresenceRow players={s.players} doneMap={s.ready} label={`${sealedCount}/${s.players.length} sealed`} />
    </View>
  );
}
