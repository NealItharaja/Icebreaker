// The round flow: ask → guess → judging → reveal → standings. One route,
// phases driven by the game controller.

import { Redirect } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { AskView } from '../components/game/AskView';
import { WaitCenter } from '../components/game/chrome';
import { GuessView } from '../components/game/GuessView';
import { RevealView } from '../components/game/RevealView';
import { StandView } from '../components/game/StandView';
import { useGame } from '../game/GameContext';
import { useTheme } from '../theme/ThemeContext';

export default function Game() {
  const { t } = useTheme();
  const [g, ctrl] = useGame();

  if (g.phase === 'idle') return <Redirect href="/home" />;
  if (g.phase === 'final' || g.phase === 'share') return <Redirect href="/final" />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      {g.phase === 'ask' && <AskView g={g} ctrl={ctrl} />}
      {g.phase === 'guess' && <GuessView g={g} ctrl={ctrl} />}
      {g.phase === 'judging' && (
        <View style={{ flex: 1, paddingBottom: 40 }}>
          <WaitCenter title="Gemma is calling it…" sub="Judging by meaning, writing the reveal. Nothing was visible until now." />
        </View>
      )}
      {g.phase === 'reveal' && <RevealView g={g} ctrl={ctrl} />}
      {g.phase === 'stand' && <StandView g={g} ctrl={ctrl} />}
      {g.phase === 'lobby' && <Redirect href="/lobby" />}
    </KeyboardAvoidingView>
  );
}
