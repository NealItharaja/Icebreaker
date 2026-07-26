// "Join a game" — four digits, shouted across a common room. Real rooms.

import { useMutation } from 'convex/react';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../../convex/_generated/api';
import { useRoomSession } from '../../game/room';
import { useAppStore } from '../../store/AppStore';
import { setPendingJoin } from '../../store/pending';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { RoundBtn, Sheet } from '../ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'go'];

export function JoinSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const { deviceId, enterRoom } = useRoomSession();
  const joinRoom = useMutation(api.game.joinRoom);
  const { profile, onboarded } = useAppStore();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setCode('');
    setError(null);
    onClose();
  };

  const go = async () => {
    if (code.length !== 4 || busy || !deviceId) return;
    if (!onboarded) {
      // no name yet — collect it first, then walk into the room
      setPendingJoin(code);
      close();
      router.push('/name');
      return;
    }
    setBusy(true);
    try {
      const res = await joinRoom({ code, deviceId, name: profile.name, sym: profile.sym });
      if ('error' in res && res.error) {
        setError(res.error);
        setCode('');
      } else if ('roomId' in res && res.roomId) {
        enterRoom(res.roomId);
        close();
        router.push('/lobby');
      }
    } catch {
      setError('Could not reach the room. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  const key = (ch: string) => {
    setError(null);
    if (ch === '⌫') return setCode((c) => c.slice(0, -1));
    if (ch === 'go') return void go();
    if (code.length < 4) setCode((c) => c + ch);
  };

  return (
    <Sheet visible={visible} onClose={close}>
      <View style={{ padding: 24, paddingBottom: 34 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: t.text }}>Join a game</Text>
          <RoundBtn icon="x" size={34} onPress={close} />
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
          {KEYS.map((k) => (
            <Pressable
              key={k}
              onPress={() => key(k)}
              disabled={busy && k === 'go'}
              style={({ pressed }) => ({
                width: '31.3%',
                paddingVertical: 14,
                borderRadius: 20,
                backgroundColor: pressed ? t.divider : t.surface,
                alignItems: 'center',
                opacity: busy && k === 'go' ? 0.5 : 1,
              })}
            >
              <Text style={{ fontFamily: fonts.heading, fontSize: 21, color: k === 'go' ? t.accent : t.text }}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 12,
            color: error ? t.accent700 : t.textMuted,
            marginTop: 14,
            textAlign: 'center',
          }}
        >
          {error
            ? error
            : busy
              ? 'Walking in…'
              : code.length === 4
                ? 'Press go to walk in'
                : 'Codes are 4 digits, shouted across a common room'}
        </Text>
      </View>
    </Sheet>
  );
}
