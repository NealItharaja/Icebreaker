// "Behind the model" — the real prompt, the real output, real latency.
// Nothing mocked: this reads the actual telemetry log of the session.

import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { gemmaLog, lastExchange, MODEL, p50Latency } from '../../gemma/client';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { GemmaMark } from '../Avatar';
import { Kicker, RoundBtn, Sheet } from '../ui';

export function BehindSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const last = lastExchange();
  const p50 = p50Latency();
  const liveCalls = gemmaLog().filter((l) => l.mode === 'live').length;
  const stats = [
    { v: MODEL.replace('google/', '').replace('-it', ''), k: 'model' },
    { v: p50 != null ? `${p50}ms` : '—', k: 'p50 latency' },
    { v: last ? (last.tokens ? `${last.tokens >= 1000 ? (last.tokens / 1000).toFixed(1) + 'k' : last.tokens}` : last.mode) : '—', k: 'tokens last call' },
  ];
  const mono = { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 18.5 } as const;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ paddingTop: 16, paddingHorizontal: 22, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <GemmaMark size={18} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 20, color: t.text }}>Behind the model</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: t.textMuted }}>
            {MODEL} · via openrouter · {liveCalls ? `${liveCalls} live calls` : 'offline — no key yet'}
          </Text>
        </View>
        <RoundBtn icon="x" size={34} onPress={onClose} />
      </View>
      <ScrollView style={{ paddingHorizontal: 22 }} contentContainerStyle={{ paddingBottom: 34, paddingTop: 6 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {stats.map((m) => (
            <View key={m.k} style={{ flex: 1, borderRadius: 18, backgroundColor: t.surface, padding: 11 }}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: t.text }} numberOfLines={1}>
                {m.v}
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 10, color: t.textMuted, marginTop: 3 }}>{m.k}</Text>
            </View>
          ))}
        </View>
        {last ? (
          <>
            <Kicker style={{ marginBottom: 8 }}>what we sent · {last.task}</Kicker>
            <View style={{ borderRadius: 18, backgroundColor: t.vSunk, padding: 14, marginBottom: 16 }}>
              <Text style={[mono, { color: t.text }]}>
                {`system: ${last.system}\n\nuser: ${last.user}`.slice(0, 1200)}
              </Text>
            </View>
            <Kicker style={{ marginBottom: 8 }}>what came back · {last.mode === 'live' ? `${last.ms}ms` : 'fallback'}</Kicker>
            <View style={{ borderRadius: 18, backgroundColor: t.accent2_100, padding: 14 }}>
              <Text style={[mono, { color: t.accent2_800 }]}>{last.output.slice(0, 1200)}</Text>
            </View>
          </>
        ) : (
          <View style={{ borderRadius: 18, backgroundColor: t.surface, padding: 16 }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: t.textMuted, lineHeight: 20 }}>
              Nothing yet. Start a game — every question, lie, judgment and card in Venn is one visible call to Gemma 4, and the latest one shows up here.
            </Text>
          </View>
        )}
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.textMuted, lineHeight: 18, marginTop: 14 }}>
          Answers are sent one round at a time and dropped when the game ends. Nothing is kept, and there is no profile to leak.
        </Text>
      </ScrollView>
    </Sheet>
  );
}
