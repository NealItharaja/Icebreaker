// The live round flow — every phone in the room sees the same server phases.

import { Redirect } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { AskView } from '../components/game/AskView';
import { GuessView } from '../components/game/GuessView';
import { RevealView } from '../components/game/RevealView';
import { StandView } from '../components/game/StandView';
import { useRoom, useRoomSession } from '../game/room';
import { useTheme } from '../theme/ThemeContext';

export default function Game() {
  const { t } = useTheme();
  const { roomId, clearRoom } = useRoomSession();
  const s = useRoom();

  if (!roomId) return <Redirect href="/home" />;
  if (s === undefined) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  if (s === null) {
    clearRoom();
    return <Redirect href="/home" />;
  }
  if (s.room.phase === 'lobby') return <Redirect href="/lobby" />;
  if (s.room.phase === 'closed') {
    clearRoom();
    return <Redirect href="/home" />;
  }
  if (s.room.phase === 'final') return <Redirect href="/final" />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      {s.room.phase === 'ask' && <AskView s={s} />}
      {s.room.phase === 'guess' && <GuessView s={s} />}
      {(s.room.phase === 'judging' || s.room.phase === 'reveal') && (
        <RevealView s={s} judging={s.room.phase === 'judging'} />
      )}
      {s.room.phase === 'stand' && <StandView s={s} />}
    </KeyboardAvoidingView>
  );
}
