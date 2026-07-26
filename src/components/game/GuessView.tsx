// Guess phase against the live room: one card per sealed friend; your own
// spotlight is a spectator card while real phones lock in about you.

import { useMutation } from 'convex/react';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { api } from '../../../convex/_generated/api';
import { guessMs } from '../../../convex/lib';
import { Avatar } from '../Avatar';
import { rise } from '../motion';
import { Btn, Icon, StreamedText } from '../ui';
import { useCountdown, useRoomSession } from '../../game/room';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { OptionRow } from './AskView';
import { PresenceRow, RoundHeader, WaitCenter } from './chrome';

function Spectate({ s, onDone }: { s: any; onDone: () => void }) {
  const { t } = useTheme();
  const round = s.round;
  const me = s.players.find((p: any) => p.isMe);
  const others = s.players.filter((p: any) => !p.isMe);
  const truth = s.myMove?.answer ?? '—';
  const selfMove = s.myMove?.selfMove;
  const heading =
    round.archetype === 'whose'
      ? 'Your take is in the pile, unsigned.'
      : round.aboutTemplate.replace('{name}', me?.name || 'you');
  const extra =
    round.archetype === 'tap'
      ? `You planted “${s.myMove?.planted || '—'}” in their options.`
      : round.archetype === 'type'
        ? `You called ${selfMove ?? '—'} of them getting it.`
        : `You bet they will blame ${s.players.find((p: any) => p.id === selfMove)?.name || '—'}.`;

  return (
    <Animated.View entering={rise()} style={{ flex: 1, minHeight: 0 }}>
      <View
        style={{ alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.accent, marginBottom: 14 }}
      >
        <Text style={{ fontFamily: fonts.body, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: t.bg }}>
          your spotlight · spectating
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.heading, fontSize: 27, lineHeight: 32, color: t.text, marginBottom: 6 }}>{heading}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.textMuted, marginBottom: 18 }}>
        You can't answer this one. They're guessing about you right now.
      </Text>
      <View style={{ borderRadius: 24, backgroundColor: t.surface, padding: 16, marginBottom: 12 }}>
        <Text
          style={{ fontFamily: fonts.body, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: t.textMuted, marginBottom: 9 }}
        >
          what you sealed
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Icon name="lock" size={16} color={t.textMuted} />
          <Text style={{ flex: 1, fontFamily: fonts.heading, fontSize: 19, lineHeight: 23, color: t.text }}>
            {round.archetype === 'whose' ? `“${truth}”` : truth}
          </Text>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: t.divider, marginTop: 10, paddingTop: 10 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.textMuted }}>{extra}</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {others.map((p: any) => {
          const done = !!s.locked[p.id];
          return (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                paddingVertical: 11,
                paddingHorizontal: 14,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: t.divider,
                backgroundColor: done ? t.vRaise : 'transparent',
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', opacity: done ? 1 : 0.55 }}>
                <Avatar sym={p.sym} size={34} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 14.5, color: t.text }}>{p.name}</Text>
              <View
                style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: done ? t.accent2_100 : t.divider }}
              >
                <Text style={{ fontFamily: fonts.body, fontSize: 11, color: done ? t.accent2_800 : t.text }}>
                  {done ? 'locked in' : 'thinking…'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Btn label="Now let me guess theirs →" onPress={onDone} style={{ marginTop: 12 }} />
    </Animated.View>
  );
}

function GuessCard({ s, spot }: { s: any; spot: any }) {
  const { t, sh } = useTheme();
  const { roomId, deviceId } = useRoomSession();
  const submitGuess = useMutation(api.game.submitGuess);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const round = s.round;
  const chosen = s.myMove?.guesses?.[spot.spotId];
  const kicker = round.archetype === 'whose' ? 'an anonymous take' : `about ${spot.name}`;
  const q = round.archetype === 'whose' ? 'Whose take is this?' : round.aboutTemplate.replace('{name}', spot.name);

  const guess = async (value: string) => {
    if (!roomId || !deviceId || busy || !value.trim()) return;
    setBusy(true);
    try {
      await submitGuess({ roomId, deviceId, spotId: spot.spotId, value: value.trim() });
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View key={spot.spotId} entering={rise()} style={{ flex: 1, minHeight: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <View style={[{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }, sh.sm]}>
          {round.archetype === 'whose' ? (
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 20, color: t.textMuted }}>?</Text>
            </View>
          ) : (
            <Avatar sym={spot.sym} size={44} />
          )}
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: t.textMuted }}>
          {kicker}
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.heading, fontSize: 27, lineHeight: 32, color: t.text, marginBottom: 6 }}>{q}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.textMuted, marginBottom: 18 }}>{round.aboutHint}</Text>
      {round.archetype === 'whose' && (
        <View style={{ borderRadius: 24, backgroundColor: t.surface, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 18 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, color: t.text }}>“{spot.quote}”</Text>
        </View>
      )}
      {round.archetype === 'type' ? (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="anything, in your words"
            placeholderTextColor={t.textFaint}
            returnKeyType="done"
            onSubmitEditing={() => guess(draft)}
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
              marginBottom: 12,
            }}
          />
          <View style={{ flex: 1 }} />
          <Btn label="Lock it in" disabled={!draft.trim() || busy} onPress={() => guess(draft)} />
        </>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
          {round.archetype === 'whose'
            ? s.players
                .filter((p: any) => !p.isMe)
                .map((p: any) => (
                  <OptionRow key={p.id} label={p.name} sym={p.sym} selected={chosen === p.id} onPress={() => guess(p.id)} disabled={busy} />
                ))
            : (spot.options || []).map((o: string) => (
                <OptionRow key={o} label={o} selected={chosen === o} onPress={() => guess(o)} disabled={busy} />
              ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

export function GuessView({ s }: { s: any }) {
  const { t } = useTheme();
  const [spectateDoneR, setSpectateDoneR] = useState<number | null>(null);
  const { tleft, pct } = useCountdown(s.room.deadline, guessMs(s.players.length));
  const humans = s.players.filter((p: any) => !p.isAi);
  const iSealed = !!s.myMove?.sealed;
  const targets = s.spots.filter((sp: any) => !sp.isMe);
  const guessedCount = targets.filter((sp: any) => s.myMove?.guesses?.[sp.spotId]).length;
  // spectate-dismissed is per round — the component stays mounted across rounds
  const spectateDone = spectateDoneR === s.room.r;
  const setSpectateDone = () => setSpectateDoneR(s.room.r);
  const showSpectate = iSealed && !spectateDone;
  const current = showSpectate ? null : targets.find((sp: any) => !s.myMove?.guesses?.[sp.spotId]);
  const allDone = !showSpectate && !current;
  const pendingNames = humans.filter((p: any) => !p.isMe && !s.locked[p.id]).map((p: any) => p.name);
  const lockedCount = s.players.filter((p: any) => (p.isMe ? allDone : s.locked[p.id])).length;
  const tag = s.round ? { tap: 'TAP', type: 'TYPE', whose: 'WHOSE' }[s.round.archetype as 'tap'] || '' : '';
  const pips = (iSealed ? 1 : 0) + targets.length;
  const pipsDone = (iSealed && spectateDone ? 1 : 0) + guessedCount;

  return (
    <View style={{ flex: 1, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 18 }}>
      <RoundHeader r={s.room.r} tag={tag} tagTone="accent2" tleft={tleft} pct={pct} showTimer={s.room.deadline != null} />
      {!allDone && pips > 0 && (
        <View style={{ flexDirection: 'row', gap: 5, marginBottom: 16 }}>
          {Array.from({ length: pips }, (_, i) => (
            <View
              key={i}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 3,
                backgroundColor: i < pipsDone ? t.accent : i === pipsDone ? t.accent300 : t.divider,
              }}
            />
          ))}
        </View>
      )}
      {showSpectate ? (
        <Spectate s={s} onDone={setSpectateDone} />
      ) : current ? (
        <GuessCard key={current.spotId} s={s} spot={current} />
      ) : (
        <WaitCenter
          title={pendingNames.length ? `Waiting on ${pendingNames.join(' and ')}` : 'Closing the round…'}
          sub="Nothing is revealed until everyone has locked in. That's the whole point."
        />
      )}
      <PresenceRow
        players={s.players}
        doneMap={Object.fromEntries(s.players.map((p: any) => [p.id, p.isMe ? allDone : !!s.locked[p.id]]))}
        label={`${lockedCount}/${s.players.length} locked in`}
      />
    </View>
  );
}
