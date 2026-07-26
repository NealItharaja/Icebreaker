// "Two things and you're in." — name + face, and that's the whole profile.

import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../../convex/_generated/api';
import { Avatar } from '../components/Avatar';
import { Btn, Heading, RoundBtn } from '../components/ui';
import { useRoomSession } from '../game/room';
import { useAppStore } from '../store/AppStore';
import { takePendingJoin } from '../store/pending';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

export default function Name() {
  const { t, sh } = useTheme();
  const { profile, setProfile } = useAppStore();
  const { deviceId, enterRoom } = useRoomSession();
  const joinRoom = useMutation(api.game.joinRoom);
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [sym, setSym] = useState(profile.sym || 1);
  const [busy, setBusy] = useState(false);

  const done = async () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setProfile({ name: clean, sym });
    const code = takePendingJoin();
    if (code && deviceId) {
      setBusy(true);
      try {
        const res = await joinRoom({ code, deviceId, name: clean, sym });
        if ('roomId' in res && res.roomId) {
          enterRoom(res.roomId);
          router.replace('/lobby');
          return;
        }
      } catch {
        // fall through to home; they can re-enter the code there
      } finally {
        setBusy(false);
      }
    }
    router.replace('/home');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 66, paddingHorizontal: 24, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignSelf: 'flex-start', marginBottom: 22 }}>
          <RoundBtn
            icon="chevronLeft"
            onPress={() => {
              takePendingJoin(); // backing out abandons any join code
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
          />
        </View>
        <Heading size={36}>Two things and you're in.</Heading>
        <Text style={{ fontFamily: fonts.body, fontSize: 14.5, color: t.textMuted, marginTop: 8, marginBottom: 26 }}>
          No profile, no bio, no interests list. Gemma asks the questions once the game starts.
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted, marginBottom: 5 }}>
          What should the room call you?
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Riley"
          placeholderTextColor={t.textFaint}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={done}
          style={{
            fontFamily: fonts.body,
            fontSize: 18,
            minHeight: 50,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.divider,
            backgroundColor: t.surface,
            color: t.text,
            marginBottom: 26,
          }}
        />
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Pick a face</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 13 }}>
          {Array.from({ length: 7 }, (_, i) => i + 1).map((s) => {
            const on = sym === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSym(s)}
                style={[
                  {
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    borderWidth: 3,
                    borderColor: on ? t.accent : 'transparent',
                    overflow: 'hidden',
                    transform: [{ scale: on ? 1.06 : 1 }],
                  },
                  on ? sh.md : null,
                ]}
              >
                <Avatar sym={s} size={66} />
              </Pressable>
            );
          })}
        </View>
        <View style={{ flex: 1, minHeight: 22 }} />
        <Btn label={busy ? 'Walking in…' : 'Done — take me in'} size="lg" disabled={!name.trim() || busy} onPress={done} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
