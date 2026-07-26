// The floor map — the real people you've played rooms with.
// Thicker line, more in common. It survives the night.

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { Avatar } from '../components/Avatar';
import { TabBar } from '../components/TabBar';
import { NodeSheet } from '../components/sheets/NodeSheet';
import { Btn, Heading, Kicker } from '../components/ui';
import { FloorPerson, floorPeople, useAppStore } from '../store/AppStore';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

export default function Map() {
  const { t } = useTheme();
  const { profile, world } = useAppStore();
  const router = useRouter();
  const [node, setNode] = useState<FloorPerson | null>(null);

  const people = floorPeople(world).slice(0, 10);
  const played = world.gamesPlayed > 0;
  const R = 92;
  // an empty map still deserves a shape — ghost seats until you play
  const ghostCount = people.length ? 0 : 5;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 66, paddingHorizontal: 22, paddingBottom: 8 }}>
        <Kicker>{profile.floor}</Kicker>
        <Heading size={31} style={{ marginTop: 3, marginBottom: 4 }}>
          Your overlap map
        </Heading>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: t.textMuted, marginBottom: 8 }}>
          {played
            ? 'Thicker line, more in common. It grows every room you play.'
            : 'Nothing here yet. Play one room and the lines appear.'}
        </Text>
        <Svg width="100%" height={300} viewBox="0 0 260 240">
          {Array.from({ length: ghostCount }, (_, i) => {
            const a = -Math.PI / 2 + (i / ghostCount) * Math.PI * 2;
            const x = 130 + Math.cos(a) * R;
            const y = 120 + Math.sin(a) * R;
            return (
              <React.Fragment key={`g${i}`}>
                <Line x1={130} y1={120} x2={x} y2={y} stroke={t.neutral400} strokeWidth={1.5} strokeDasharray="3 6" strokeOpacity={0.5} />
                <Circle cx={x} cy={y} r={8} fill={t.neutral500} fillOpacity={0.3} />
              </React.Fragment>
            );
          })}
          {people.map((p, i) => {
            const a = -Math.PI / 2 + (i / Math.max(1, people.length)) * Math.PI * 2;
            const x = 130 + Math.cos(a) * R;
            const y = 120 + Math.sin(a) * R;
            const shN = p.met ? p.overlaps.length : 0;
            return (
              <Line
                key={p.key}
                x1={130}
                y1={120}
                x2={x}
                y2={y}
                stroke={p.met ? t.accent2 : t.neutral400}
                strokeWidth={p.met ? 2 + shN * 2.6 : 1.5}
                strokeLinecap="round"
                strokeDasharray={p.met ? undefined : '3 6'}
                strokeOpacity={0.65}
              />
            );
          })}
          {people.map((p, i) => {
            const a = -Math.PI / 2 + (i / Math.max(1, people.length)) * Math.PI * 2;
            const x = 130 + Math.cos(a) * R;
            const y = 120 + Math.sin(a) * R;
            const shN = p.met ? p.overlaps.length : 0;
            return (
              <Circle
                key={p.key}
                cx={x}
                cy={y}
                r={p.met ? 11 + shN * 2.2 : 8}
                fill={p.met ? t.accent2_600 : t.neutral500}
                fillOpacity={p.met ? 1 : 0.45}
              />
            );
          })}
          <Circle cx={130} cy={120} r={26} fill={t.accent} />
          <SvgText x={130} y={125.5} textAnchor="middle" fontFamily={fonts.heading} fontSize={15} fill={t.bg}>
            you
          </SvgText>
        </Svg>
        <View style={{ gap: 9, marginTop: 12 }}>
          {people.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setNode(p)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: t.divider,
                backgroundColor: p.met ? t.vRaise : pressed ? 'rgba(127,127,127,0.06)' : 'transparent',
              })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', opacity: p.met ? 1 : 0.45 }}>
                <Avatar sym={p.sym} size={40} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: t.text }}>{p.name}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted }} numberOfLines={1}>
                  {p.overlaps.slice(0, 2).join(' · ') || 'played a room · no overlap yet'}
                </Text>
              </View>
              <View
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: p.met ? t.accent2_100 : t.divider,
                }}
              >
                <Text style={{ fontFamily: fonts.body, fontSize: 11, color: p.met ? t.accent2_800 : t.text }}>
                  {p.met ? `${p.overlaps.length} shared` : 'new'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
        <View style={{ borderRadius: 26, backgroundColor: t.accent2_100, padding: 17, marginVertical: 14 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 19, color: t.accent2_800, marginBottom: 6 }}>
            {people.length ? 'Run it back — the map sharpens every game' : 'Your map starts with one room'}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: t.accent2_800, opacity: 0.85 }}>
            Open a room and read the four digits across the hallway. Everyone who joins ends up on this map, with what you share.
          </Text>
          <Btn
            label="Open a room"
            size="sm"
            onPress={() => router.push('/create')}
            style={{ marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 18 }}
          />
        </View>
      </ScrollView>
      <TabBar current="map" />
      <NodeSheet node={node} onClose={() => setNode(null)} />
    </View>
  );
}
