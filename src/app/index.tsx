// Welcome — "The first week of college is the loneliest. This one gets loud."

import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Avatar, GemmaMark, VennLogo } from '../components/Avatar';
import { pop, useDrift, useFloat } from '../components/motion';
import { JoinSheet } from '../components/sheets/JoinSheet';
import { Btn } from '../components/ui';
import { useAppStore } from '../store/AppStore';
import { setPendingJoin } from '../store/pending';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

function FloatingFace({ sym, size, ml, dur, delay }: { sym: number; size: number; ml: number; dur: number; delay: number }) {
  const { sh } = useTheme();
  const float = useFloat(dur, delay);
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, marginLeft: ml, ...sh.md }, float]}
    >
      <Avatar sym={sym} size={size} />
    </Animated.View>
  );
}

export default function Welcome() {
  const { t } = useTheme();
  const { onboarded } = useAppStore();
  const router = useRouter();
  const [join, setJoin] = useState(false);
  const blob1 = useDrift(9000);
  const blob2 = useDrift(11000, true);

  // returning students land straight on home — welcome is for night one
  if (onboarded) return <Redirect href="/home" />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 78, paddingHorizontal: 26, paddingBottom: 40, overflow: 'hidden' }}>
      <Animated.View
        style={[
          { position: 'absolute', top: 120, right: -70, width: 210, height: 210, borderRadius: 105, backgroundColor: t.accent2_100, opacity: 0.55 },
          blob1,
        ]}
      />
      <Animated.View
        style={[
          { position: 'absolute', bottom: 150, left: -80, width: 180, height: 180, borderRadius: 90, backgroundColor: t.accent200, opacity: 0.5 },
          blob2,
        ]}
      />
      <Animated.View entering={pop()}>
        <VennLogo width={112} />
      </Animated.View>
      <Text style={{ fontFamily: fonts.heading, fontSize: 62, lineHeight: 60, color: t.text, marginTop: 22, letterSpacing: -1.8 }}>
        Venn
      </Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 19, lineHeight: 27, color: t.text, opacity: 0.85, marginTop: 14, maxWidth: 250 }}>
        The first week of college is the loneliest. This one gets loud.
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 26, height: 96 }}>
        <FloatingFace sym={2} size={78} ml={0} dur={4400} delay={0} />
        <FloatingFace sym={7} size={92} ml={-18} dur={5200} delay={400} />
        <FloatingFace sym={4} size={70} ml={-16} dur={4800} delay={800} />
      </View>
      <View style={{ gap: 10 }}>
        <Btn
          label="Pick a name and a face"
          size="lg"
          onPress={() => {
            setPendingJoin(null); // plain onboarding — forget any abandoned join code
            router.push('/name');
          }}
        />
        <Btn label="I already have a code" variant="secondary" onPress={() => setJoin(true)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 }}>
          <GemmaMark size={13} color={t.accent} />
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.text, opacity: 0.55 }}>
            no forms. gemma 4 asks as you play
          </Text>
        </View>
      </View>
      <JoinSheet visible={join} onClose={() => setJoin(false)} />
    </View>
  );
}
