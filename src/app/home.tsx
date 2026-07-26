// Home — join a game, start one, or open the map. Gemma keeps noticing.

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Avatar, GemmaMark } from '../components/Avatar';
import { TabBar } from '../components/TabBar';
import { BehindSheet } from '../components/sheets/BehindSheet';
import { JoinSheet } from '../components/sheets/JoinSheet';
import { SettingsSheet } from '../components/sheets/SettingsSheet';
import { Btn, Heading, Icon, Kicker, StreamedText } from '../components/ui';
import { unionOverlaps } from '../game/engine';
import { homeNotice } from '../gemma/service';
import { floorPeople, useAppStore } from '../store/AppStore';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

const noticeCache: Record<string, string> = {};

function MiniMap({ met }: { met: boolean }) {
  const { t } = useTheme();
  return (
    <Svg width={74} height={74} viewBox="0 0 92 92">
      {[
        [16, 24],
        [80, 20],
        [12, 62],
        [78, 66],
        [46, 84],
      ].map(([x, y], i) => (
        <Path key={i} d={`M46 46 ${x} ${y}`} stroke={t.accent2} strokeWidth={2.4} opacity={met ? 0.75 : 0.35} />
      ))}
      {[
        [16, 24, 6],
        [80, 20, 7.5],
        [12, 62, 5],
        [78, 66, 6.5],
        [46, 84, 5.5],
      ].map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill={t.accent2_600} opacity={met ? 1 : 0.5} />
      ))}
      <Circle cx={46} cy={46} r={10} fill={t.accent} />
    </Svg>
  );
}

export default function Home() {
  const { t, sh } = useTheme();
  const { profile, world, plans, removePlan } = useAppStore();
  const router = useRouter();
  const [sheet, setSheet] = useState<null | 'set' | 'join' | 'behind'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const people = floorPeople(world);
  const unmet = people.filter((p) => !p.met);
  const played = world.gamesPlayed;
  const allOverlaps = unionOverlaps(
    Object.fromEntries(people.map((p) => [`me|${p.bot.id}`, p.overlaps])),
  );

  useEffect(() => {
    const key = `${played}|${unmet.length}`;
    if (noticeCache[key]) {
      setNotice(noticeCache[key]);
      return;
    }
    let alive = true;
    homeNotice(profile.name, played, unmet.map((u) => u.bot.name), allOverlaps, 'chaotic').then((line) => {
      noticeCache[key] = line;
      if (alive) setNotice(line);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played, unmet.length]);

  const hour = new Date().getHours();
  const daypart = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const latestPlan = plans[plans.length - 1];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 66, paddingHorizontal: 22, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <View>
            <Kicker>{weekday} · {profile.floor}</Kicker>
            <Heading size={31} style={{ marginTop: 2 }}>
              {daypart}, {profile.name || 'you'}
            </Heading>
          </View>
          <Pressable
            onPress={() => setSheet('set')}
            style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: t.accent, overflow: 'hidden' }}
          >
            <Avatar sym={profile.sym} size={48} />
          </Pressable>
        </View>

        {/* join hero */}
        <Pressable
          onPress={() => setSheet('join')}
          style={({ pressed }) => [
            { borderRadius: 30, backgroundColor: pressed ? t.accent600 : t.accent, padding: 22, overflow: 'hidden' },
            sh.md,
          ]}
        >
          <View
            style={{ position: 'absolute', right: -34, top: -34, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.16)' }}
          />
          <Kicker color="rgba(255,255,255,0.8)">someone read you a code</Kicker>
          <Text style={{ fontFamily: fonts.heading, fontSize: 27, color: t.bg, marginTop: 8, marginBottom: 6 }}>Join a game</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: t.bg, opacity: 0.9, maxWidth: 230, marginBottom: 16 }}>
            Four characters, shouted across a common room. That's the whole sign-up.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ backgroundColor: t.bg, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999 }}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: t.accent700 }}>Enter a code</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {[2, 3, 4].map((s, i) => (
                <View
                  key={s}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    borderWidth: 2,
                    borderColor: t.accent,
                    overflow: 'hidden',
                    marginLeft: i ? -11 : 0,
                    backgroundColor: t.bg,
                  }}
                >
                  <Avatar sym={s} size={30} />
                </View>
              ))}
            </View>
          </View>
        </Pressable>

        {/* start new */}
        <Pressable
          onPress={() => router.push('/create')}
          style={({ pressed }) => ({
            marginTop: 12,
            borderRadius: 24,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: t.divider,
            padding: 17,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: pressed ? 'rgba(127,127,127,0.07)' : 'transparent',
          })}
        >
          <Icon name="plus" size={19} color={t.accent} />
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: t.text }}>Start a new game</Text>
        </Pressable>

        {/* map card */}
        <Pressable
          onPress={() => router.replace('/map')}
          style={({ pressed }) => ({
            marginTop: 12,
            borderRadius: 28,
            backgroundColor: pressed ? t.divider : t.surface,
            padding: 18,
            flexDirection: 'row',
            gap: 16,
            alignItems: 'center',
          })}
        >
          <MiniMap met={played > 0} />
          <View style={{ flex: 1 }}>
            <Kicker>{profile.floor}</Kicker>
            <Text style={{ fontFamily: fonts.heading, fontSize: 19, color: t.text, marginVertical: 3 }}>
              {played ? `${allOverlaps.length} overlap${allOverlaps.length === 1 ? '' : 's'} so far` : 'your map starts tonight'}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.textMuted }}>Open your overlap map</Text>
          </View>
        </Pressable>

        {/* tonight's plan — added from your gemma card */}
        {latestPlan && (
          <View style={{ marginTop: 12, borderRadius: 28, backgroundColor: t.accent2_100, padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Kicker color={t.accent2_800}>tonight · from your card</Kicker>
              <Pressable onPress={() => removePlan(latestPlan.id)} hitSlop={10}>
                <Icon name="x" size={13} color={t.accent2_800} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
              <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: t.accent2_600, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.heading, fontSize: 12, lineHeight: 14, color: t.bg, textAlign: 'center' }}>
                  {latestPlan.when.replace(' ', '\n')}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.heading, fontSize: 18, color: t.accent2_800 }}>{latestPlan.title}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.accent2_800, opacity: 0.8 }} numberOfLines={2}>
                  {latestPlan.why}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* gemma noticed */}
        <View style={{ marginTop: 12, marginBottom: 14, borderRadius: 28, borderWidth: 1, borderColor: t.divider, padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <GemmaMark size={14} color={t.accent} />
            <Kicker>gemma noticed</Kicker>
          </View>
          <StreamedText
            text={notice}
            style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: t.text }}
            caretColor={t.accent}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <View style={{ flexDirection: 'row' }}>
              {(unmet.length ? unmet.slice(0, 3).map((u) => u.bot.sym) : [5, 6, 7]).map((s, i) => (
                <View key={s} style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', marginLeft: i ? -10 : 0, backgroundColor: t.bg }}>
                  <Avatar sym={s} size={32} />
                </View>
              ))}
            </View>
            <Btn
              label="Put us in a game →"
              variant="ghost"
              size="sm"
              onPress={() =>
                router.push(
                  unmet.length
                    ? { pathname: '/create', params: { invite: unmet.slice(0, 3).map((u) => u.bot.id).join(',') } }
                    : '/create',
                )
              }
            />
          </View>
        </View>
      </ScrollView>
      <TabBar current="home" />

      {/* close one modal fully before presenting the next — iOS can't swap them in one frame */}
      <SettingsSheet
        visible={sheet === 'set'}
        onClose={() => setSheet(null)}
        onOpenBehind={() => {
          setSheet(null);
          setTimeout(() => setSheet('behind'), 500);
        }}
      />
      <JoinSheet visible={sheet === 'join'} onClose={() => setSheet(null)} />
      <BehindSheet visible={sheet === 'behind'} onClose={() => setSheet(null)} />
    </View>
  );
}
