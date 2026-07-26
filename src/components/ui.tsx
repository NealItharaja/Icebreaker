// Small shared kit: buttons, chips, icons, streamed text, sheets.

import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { sheetIn, useBlink } from './motion';

// ── icons (lucide-style, stroke 2.75 per the design system) ───────────────

const ICON_PATHS: Record<string, string> = {
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  check: 'M20 6 9 17l-5-5',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  home: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z',
  map: 'M12 3v18M3 8l9-5 9 5M4 15l8 4 8-4',
};

export function Icon({
  name,
  size = 18,
  color,
  strokeWidth = 2.75,
}: {
  name: keyof typeof ICON_PATHS;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={ICON_PATHS[name]} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── buttons ───────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost';

export function Btn({
  label,
  onPress,
  variant = 'primary',
  disabled,
  size = 'md',
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  size?: 'md' | 'lg' | 'sm';
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  const { t } = useTheme();
  const pad = size === 'lg' ? { paddingVertical: 15, paddingHorizontal: 20 } : size === 'sm' ? { paddingVertical: 9, paddingHorizontal: 15 } : { paddingVertical: 13, paddingHorizontal: 20 };
  const fs = size === 'lg' ? 17 : size === 'sm' ? 14 : 16;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          ...pad,
          opacity: disabled ? 0.45 : 1,
        },
        variant === 'primary' && { backgroundColor: pressed ? t.accent700 : t.accent },
        variant === 'secondary' && {
          borderWidth: 1,
          borderColor: t.divider,
          backgroundColor: pressed ? 'rgba(127,127,127,0.12)' : 'transparent',
        },
        variant === 'ghost' && { backgroundColor: pressed ? `${t.accent}22` : 'transparent', paddingHorizontal: 6 },
        style,
      ]}
    >
      <Text
        style={[
          { fontFamily: fonts.heading, fontSize: fs, lineHeight: fs * 1.25 },
          { color: variant === 'primary' ? t.bg : variant === 'ghost' ? t.accent : t.text },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** circular icon button (back / close) */
export function RoundBtn({ icon, onPress, size = 36 }: { icon: keyof typeof ICON_PATHS; onPress: () => void; size?: number }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: t.divider,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? 'rgba(127,127,127,0.12)' : 'transparent',
      })}
    >
      <Icon name={icon} size={size * 0.45} color={t.text} />
    </Pressable>
  );
}

/** pill chip — selectable answer */
export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingVertical: 11,
        paddingHorizontal: 16,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: selected ? t.accent : t.divider,
        backgroundColor: selected ? t.accent : pressed ? 'rgba(127,127,127,0.1)' : 'transparent',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: selected ? t.bg : t.text }}>{label}</Text>
    </Pressable>
  );
}

// ── streamed text (gemma typing) ──────────────────────────────────────────

export function useStream(text: string | null | undefined, step = 2, ms = 14): { shown: string; done: boolean } {
  const [i, setI] = useState(0);
  const key = useRef<string | null | undefined>(undefined);
  if (key.current !== text) {
    key.current = text;
    // reset synchronously so a new text never flashes the old tail
    if (i !== 0) setI(0);
  }
  useEffect(() => {
    if (!text) return;
    if (i >= text.length) return;
    const id = setTimeout(() => setI((v) => Math.min(v + step, text.length)), ms);
    return () => clearTimeout(id);
  }, [text, i, step, ms]);
  if (!text) return { shown: '', done: false };
  return { shown: text.slice(0, i), done: i >= text.length };
}

export function StreamedText({
  text,
  style,
  caretColor,
  onDone,
}: {
  text: string | null | undefined;
  style: TextStyle | TextStyle[];
  caretColor: string;
  onDone?: () => void;
}) {
  const { shown, done } = useStream(text);
  const caret = useBlink(!done);
  const doneRef = useRef(false);
  useEffect(() => {
    if (done && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
    if (!done) doneRef.current = false;
  }, [done, onDone]);
  return (
    <Text style={style}>
      {shown}
      {!done && (
        <Animated.Text style={[{ color: caretColor }, caret]}>▍</Animated.Text>
      )}
    </Text>
  );
}

// ── bottom sheet ──────────────────────────────────────────────────────────

export function Sheet({
  visible,
  onClose,
  children,
  maxHeightPct = 0.88,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPct?: number;
}) {
  const { t, sh } = useTheme();
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={sheetIn}
            style={[
              {
                backgroundColor: t.bg,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                maxHeight: `${Math.round(maxHeightPct * 100)}%`,
              },
              sh.lg,
            ]}
          >
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── text helpers ──────────────────────────────────────────────────────────

export function Kicker({ children, color, style }: { children: React.ReactNode; color?: string; style?: TextStyle }) {
  const { t } = useTheme();
  return (
    <Text
      style={[
        { fontFamily: fonts.body, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: color || t.textMuted },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Heading({ children, size = 31, style }: { children: React.ReactNode; size?: number; style?: TextStyle }) {
  const { t } = useTheme();
  return (
    <Text style={[{ fontFamily: fonts.heading, fontSize: size, lineHeight: size * 1.1, color: t.text }, style]}>
      {children}
    </Text>
  );
}
