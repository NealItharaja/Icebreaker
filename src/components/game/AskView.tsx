// Ask phase: Gemma asks, you answer about yourself, seal it,
// then make the spotlight's own move (plant a lie / call it / predict blame).

import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Avatar, GemmaMark } from '../Avatar';
import { pop, rise, useSpin } from '../motion';
import { Btn, Chip, Icon, StreamedText } from '../ui';
import { GameController, GState } from '../../game/GameContext';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { PresenceRow, RoundHeader, WaitCenter } from './chrome';

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

export function AskView({ g, ctrl }: { g: GState; ctrl: GameController }) {
  const { t } = useTheme();
  const [draft, setDraft] = useState('');
  const spin = useSpin(3400);
  const round = g.round;
  const bots = g.players.filter((p) => p.id !== 'me');
  const myAnswer = g.myAnswers[g.r];
  const mySelf = g.mySelf[g.r];
  const pendingNames = bots.filter((p) => !g.botSealed[p.id]).map((p) => p.name);
  const sealedCount = g.players.filter((p) => (p.id === 'me' ? g.askStep >= 2 : g.botSealed[p.id])).length;

  const selfOptions = () => {
    if (!round) return null;
    if (round.archetype === 'tap') {
      if (g.lieLoading || !g.lieDrafts) {
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 14 }}>
            <Animated.View style={spin}>
              <GemmaMark size={15} color={t.accent} />
            </Animated.View>
            <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: t.textMuted }}>
              drafting three lies around “{myAnswer}”…
            </Text>
          </View>
        );
      }
      return (
        <View style={{ gap: 9 }}>
          {g.lieDrafts.map((lie, i) => (
            <Animated.View key={lie} entering={pop(i * 90)}>
              <OptionRow label={lie} selected={mySelf === lie} onPress={() => ctrl.setSelfMove(lie)} />
            </Animated.View>
          ))}
        </View>
      );
    }
    if (round.archetype === 'type') {
      return (
        <View style={{ gap: 9 }}>
          {Array.from({ length: g.n }, (_, i) => (
            <OptionRow key={i} label={String(i)} selected={mySelf === String(i)} onPress={() => ctrl.setSelfMove(String(i))} />
          ))}
        </View>
      );
    }
    return (
      <View style={{ gap: 9 }}>
        {bots.map((p) => (
          <OptionRow key={p.id} label={p.name} sym={p.sym} selected={mySelf === p.id} onPress={() => ctrl.setSelfMove(p.id)} />
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 18 }}>
      <RoundHeader g={g} tag="YOUR TURN" tagTone="accent" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 16 }}>
        <Animated.View style={[{ marginTop: 3 }, spin]}>
          <GemmaMark size={15} color={t.accent} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <StreamedText
            text={round ? round.intro : null}
            style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: t.text, opacity: 0.75 }}
            caretColor={t.accent}
          />
          {!round && (
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.textMuted }}>
              writing round {g.r + 1} — nothing is pre-baked…
            </Text>
          )}
        </View>
      </View>

      {round && g.askStep === 0 && (
        <Animated.View entering={rise()} style={{ flex: 1, minHeight: 0 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 29, lineHeight: 33, color: t.text, marginBottom: 6 }}>{round.q}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.textMuted, marginBottom: 16 }}>{round.hint}</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={round.archetype === 'whose' ? 'the one that ends friendships' : 'in your own words…'}
            placeholderTextColor={t.textFaint}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (draft.trim()) {
                ctrl.sealAnswer(draft.trim());
                setDraft('');
              }
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
              marginBottom: 14,
            }}
          />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }} showsVerticalScrollIndicator={false}>
            {round.chips.map((c) => (
              <Chip key={c} label={c} selected={myAnswer === c} onPress={() => ctrl.sealAnswer(c)} />
            ))}
          </ScrollView>
          {!!draft.trim() && (
            <Btn
              label="Seal it"
              onPress={() => {
                ctrl.sealAnswer(draft.trim());
                setDraft('');
              }}
              style={{ marginTop: 14 }}
            />
          )}
        </Animated.View>
      )}

      {round && g.askStep === 1 && (
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
          <Text style={{ fontFamily: fonts.heading, fontSize: 29, lineHeight: 33, color: t.text, marginBottom: 6 }}>{round.selfQ}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.textMuted, marginBottom: 18 }}>{round.selfHint}</Text>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {selfOptions()}
          </ScrollView>
        </Animated.View>
      )}

      {g.askStep >= 2 && (
        <WaitCenter
          title={g.closing ? 'Closing the round…' : pendingNames.length ? `Waiting on ${pendingNames.join(' and ')}` : 'Closing the round…'}
          sub="Nobody's answer is visible yet — not even to me until the round closes."
          nudgeLabel={g.nudged ? 'Nudged' : 'Nudge them'}
          nudgeDisabled={g.nudged || !pendingNames.length}
          onNudge={() => ctrl.nudge()}
        />
      )}

      <PresenceRow
        players={g.players}
        doneMap={{ me: g.askStep >= 2, ...g.botSealed }}
        label={`${sealedCount}/${g.players.length} sealed`}
      />
    </View>
  );
}
