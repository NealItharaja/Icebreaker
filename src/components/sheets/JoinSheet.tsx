// "Join a game" — four characters shouted across a common room.

import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CODE_KEYS } from '../../game/data';
import { useGame } from '../../game/GameContext';
import { useAppStore } from '../../store/AppStore';
import { setPendingJoin } from '../../store/pending';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { RoundBtn, Sheet } from '../ui';

export function JoinSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const [, ctrl] = useGame();
  const { profile, onboarded } = useAppStore();
  const router = useRouter();
  const [code, setCode] = useState('');

  const key = (ch: string) => {
    if (ch === '⌫') return setCode((c) => c.slice(0, -1));
    if (ch === 'go') {
      if (code.length !== 4) return;
      onClose();
      setCode('');
      if (!onboarded) {
        // no name yet — collect it first, then walk into the room
        setPendingJoin(code);
        router.push('/name');
        return;
      }
      ctrl.joinGame(profile, code);
      router.push('/lobby');
      return;
    }
    if (code.length < 4) setCode((c) => c + ch);
  };

  return (
    <Sheet visible={visible} onClose={() => { setCode(''); onClose(); }}>
      <View style={{ padding: 24, paddingBottom: 34 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: t.text }}>Join a game</Text>
          <RoundBtn icon="x" size={34} onPress={() => { setCode(''); onClose(); }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 9, marginBottom: 18 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 0.82,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: code.length === i ? t.accent : t.divider,
                backgroundColor: code[i] ? t.surface : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.heading, fontSize: 27, color: t.text }}>{code[i] || ''}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {CODE_KEYS.map((k) => (
            <Pressable
              key={k}
              onPress={() => key(k)}
              style={({ pressed }) => ({
                width: '31.3%',
                paddingVertical: 14,
                borderRadius: 20,
                backgroundColor: pressed ? t.divider : t.surface,
                alignItems: 'center',
              })}
            >
              <Text style={{ fontFamily: fonts.heading, fontSize: 21, color: k === 'go' ? t.accent : t.text }}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted, marginTop: 14, textAlign: 'center' }}>
          {code.length === 4 ? 'Press go to walk in' : 'Codes are 4 characters, shouted across a common room'}
        </Text>
      </View>
    </Sheet>
  );
}
