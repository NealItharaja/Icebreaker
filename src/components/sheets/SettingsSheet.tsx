// "You, briefly" — name, face, floor, appearance. No profile beyond this.

import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAppStore } from '../../store/AppStore';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Avatar } from '../Avatar';
import { Btn, RoundBtn, Sheet } from '../ui';

export function SettingsSheet({
  visible,
  onClose,
  onOpenBehind,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenBehind: () => void;
}) {
  const { t, dark, toggle } = useTheme();
  const { profile, setProfile } = useAppStore();

  const label = { fontFamily: fonts.body, fontSize: 12, color: t.textMuted, marginBottom: 5 } as const;
  const input = {
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.divider,
    backgroundColor: t.surface,
    color: t.text,
  } as const;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 34 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: t.text }}>You, briefly</Text>
          <RoundBtn icon="x" size={34} onPress={onClose} />
        </View>
        <View style={{ marginBottom: 16 }}>
          <Text style={label}>Name</Text>
          <TextInput
            value={profile.name}
            onChangeText={(v) => setProfile({ name: v })}
            style={input}
            placeholderTextColor={t.textFaint}
            placeholder="Riley"
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {Array.from({ length: 7 }, (_, i) => i + 1).map((sym) => (
            <Pressable
              key={sym}
              onPress={() => setProfile({ sym })}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 2.5,
                borderColor: profile.sym === sym ? t.accent : 'transparent',
                overflow: 'hidden',
              }}
            >
              <Avatar sym={sym} size={39} />
            </Pressable>
          ))}
        </View>
        <View style={{ marginBottom: 16 }}>
          <Text style={label}>Your floor</Text>
          <TextInput
            value={profile.floor}
            onChangeText={(v) => setProfile({ floor: v })}
            style={input}
            placeholderTextColor={t.textFaint}
            placeholder="kerr hall · 3rd floor"
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 13,
            paddingHorizontal: 15,
            borderRadius: 22,
            backgroundColor: t.surface,
            marginBottom: 10,
          }}
        >
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: t.text }}>Appearance</Text>
          <Pressable
            onPress={toggle}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 15,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: t.divider,
            }}
          >
            <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: t.text }}>{dark ? 'Dark' : 'Light'}</Text>
          </Pressable>
        </View>
        <Btn label="Behind the model" variant="ghost" size="sm" onPress={onOpenBehind} style={{ marginTop: 8 }} />
      </ScrollView>
    </Sheet>
  );
}
