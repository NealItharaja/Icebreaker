// Guess phase: one card per friend. Your own spotlight is a spectator card —
// you watch them lock in guesses about you.

import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Avatar } from '../Avatar';
import { rise } from '../motion';
import { Btn, Icon, StreamedText } from '../ui';
import { GameController, GState } from '../../game/GameContext';
import { Spot } from '../../game/types';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { PresenceRow, RoundHeader, WaitCenter } from './chrome';

function sortOptions(opts: string[], sid: string): string[] {
  return opts.slice().sort((a, b) => (a + sid).length - (b + sid).length || a.localeCompare(b));
}

function dedupe(opts: string[]): string[] {
  const out: string[] = [];
  for (const o of opts) if (!out.some((x) => x.toLowerCase() === o.toLowerCase())) out.push(o);
  return out;
}

function OptionRow({
  label,
  selected,
  onPress,
  sym,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  sym?: number;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
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

function Spectate({ g, ctrl }: { g: GState; ctrl: GameController }) {
  const { t } = useTheme();
  const round = g.round!;
  const me = g.players.find((p) => p.id === 'me')!;
  const mySpot = (g.spots || []).find((s) => s.sid === 'me');
  const bots = g.players.filter((p) => p.id !== 'me');
  const truth = mySpot?.truth ?? g.myAnswers[g.r] ?? '—';
  const mySelf = g.mySelf[g.r];
  const heading =
    round.archetype === 'whose' ? 'Your take is in the pile, unsigned.' : round.aboutTemplate.replace('{name}', me.name);
  const extra =
    round.archetype === 'tap'
      ? `You planted “${mySelf || '—'}” in their options.`
      : round.archetype === 'type'
        ? `You called ${mySelf || '—'} of them getting it.`
        : `You bet they will blame ${g.players.find((p) => p.id === mySelf)?.name || '—'}.`;

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
        {bots.map((p) => {
          const done = !!g.botLocked[p.id];
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
      <Btn label="Now let me guess theirs →" onPress={() => ctrl.leaveSpectate()} style={{ marginTop: 12 }} />
    </Animated.View>
  );
}

function GuessCard({ g, ctrl, spot }: { g: GState; ctrl: GameController; spot: Spot }) {
  const { t, sh } = useTheme();
  const [draft, setDraft] = useState('');
  const round = g.round!;
  const chosen = g.picks[`${g.r}|${spot.sid}`];
  const kicker = round.archetype === 'whose' ? 'an anonymous take' : `about ${spot.name}`;
  const q = round.archetype === 'whose' ? 'Whose take is this?' : round.aboutTemplate.replace('{name}', spot.name);

  return (
    <Animated.View key={spot.sid} entering={rise()} style={{ flex: 1, minHeight: 0 }}>
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
          <Text style={{ fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, color: t.text }}>“{spot.truth}”</Text>
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
            onSubmitEditing={() => {
              if (draft.trim()) ctrl.guess(spot.sid, draft.trim());
            }}
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
          <Btn label="Lock it in" disabled={!draft.trim()} onPress={() => ctrl.guess(spot.sid, draft.trim())} />
        </>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
          {round.archetype === 'whose'
            ? // it can't be yours — you spectated your own take — so everyone else is a suspect
              g.players
                .filter((p) => p.id !== 'me')
                .map((p) => (
                  <OptionRow key={p.id} label={p.name} sym={p.sym} selected={chosen === p.id} onPress={() => ctrl.guess(spot.sid, p.id)} />
                ))
            : dedupe(sortOptions([spot.truth, ...spot.decoys, ...(spot.planted ? [spot.planted] : [])], spot.sid)).map((o) => (
                <OptionRow key={o} label={o} selected={chosen === o} onPress={() => ctrl.guess(spot.sid, o)} />
              ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

export function GuessView({ g, ctrl }: { g: GState; ctrl: GameController }) {
  const { t } = useTheme();
  const tasks = ctrl.tasks();
  const cur = tasks[g.task];
  const bots = g.players.filter((p) => p.id !== 'me');
  const pendingNames = bots.filter((p) => !g.botLocked[p.id]).map((p) => p.name);
  const lockedCount = g.players.filter((p) => (p.id === 'me' ? g.task >= tasks.length : g.botLocked[p.id])).length;
  const tag = g.round ? { tap: 'TAP', type: 'TYPE', whose: 'WHOSE' }[g.round.archetype] : '';

  return (
    <View style={{ flex: 1, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 18 }}>
      <RoundHeader g={g} tag={tag} tagTone="accent2" />
      {cur && (
        <View style={{ flexDirection: 'row', gap: 5, marginBottom: 16 }}>
          {tasks.map((_, i) => (
            <View
              key={i}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 3,
                backgroundColor: i < g.task ? t.accent : i === g.task ? t.accent300 : t.divider,
              }}
            />
          ))}
        </View>
      )}
      {cur ? (
        cur.kind === 'spectate' ? (
          <Spectate g={g} ctrl={ctrl} />
        ) : (
          <GuessCard key={cur.sid} g={g} ctrl={ctrl} spot={cur.spot!} />
        )
      ) : (
        <WaitCenter
          title={pendingNames.length ? `Waiting on ${pendingNames.join(' and ')}` : 'Closing the round…'}
          sub="Nothing is revealed until everyone has locked in. That's the whole point."
          nudgeLabel={g.nudged ? 'Nudged' : 'Nudge them'}
          nudgeDisabled={g.nudged || !pendingNames.length}
          onNudge={() => ctrl.nudge()}
        />
      )}
      <PresenceRow
        players={g.players}
        doneMap={{ me: g.task >= tasks.length, ...g.botLocked }}
        label={`${lockedCount}/${g.players.length} locked in`}
      />
    </View>
  );
}
