import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { Icon } from './ui';

export function TabBar({ current }: { current: 'home' | 'map' }) {
  const { t } = useTheme();
  const router = useRouter();
  const tabs = [
    { k: 'home' as const, label: 'Games', icon: 'home' as const, href: '/home' as const },
    { k: 'map' as const, label: 'Map', icon: 'map' as const, href: '/map' as const },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingTop: 6,
        paddingHorizontal: 14,
        paddingBottom: 30,
        borderTopWidth: 1,
        borderTopColor: t.divider,
        backgroundColor: t.bg,
      }}
    >
      {tabs.map((tab) => {
        const on = current === tab.k;
        return (
          <Pressable
            key={tab.k}
            onPress={() => {
              if (!on) router.replace(tab.href);
            }}
            style={{ flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 4 }}
          >
            <Icon name={tab.icon} size={22} color={on ? t.accent : t.textMuted} />
            <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: on ? t.accent : t.textMuted }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
