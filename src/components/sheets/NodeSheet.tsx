// One person on the floor — what you share, and Gemma's opener for them.

import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bot, Spice } from '../../game/data';
import { nodeOpener } from '../../gemma/service';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Avatar, GemmaMark } from '../Avatar';
import { Btn, RoundBtn, Sheet, StreamedText } from '../ui';

export type NodeInfo = { bot: Bot; met: boolean; overlaps: string[]; games: number };

const openerCache: Record<string, string> = {};

export function NodeSheet({
  node,
  onClose,
  spice = 'chaotic',
}: {
  node: NodeInfo | null;
  onClose: () => void;
  spice?: Spice;
}) {
  const { t } = useTheme();
  const router = useRouter();
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (!node) return;
    const cacheKey = `${node.bot.id}|${node.met}|${node.overlaps.join(',')}`;
    if (openerCache[cacheKey]) {
      setLine(openerCache[cacheKey]);
      return;
    }
    setLine(null);
    let alive = true;
    nodeOpener(node.bot.name, node.met, node.overlaps, node.bot.hobby, spice).then((l) => {
      openerCache[cacheKey] = l;
      if (alive) setLine(l);
    });
    return () => {
      alive = false;
    };
  }, [node, spice]);

  if (!node) return null;
  const chips = node.overlaps.length ? node.overlaps : [node.bot.hobby, node.bot.snack];

  return (
    <Sheet visible={!!node} onClose={onClose}>
      <View style={{ padding: 22, paddingBottom: 34 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 16 }}>
          <Avatar sym={node.bot.sym} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 23, color: t.text }}>{node.bot.name}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.textMuted }}>
              {node.bot.from} · {node.met ? `played ${node.games} game${node.games === 1 ? '' : 's'} together` : 'never met'}
            </Text>
          </View>
          <RoundBtn icon="x" size={34} onPress={onClose} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {chips.map((it) => (
            <View key={it} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.accent2_100 }}>
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.accent2_800 }}>{it}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 9, marginBottom: 18, alignItems: 'flex-start' }}>
          <View style={{ marginTop: 3 }}>
            <GemmaMark size={14} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <StreamedText
              text={line}
              style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, fontStyle: 'italic', color: t.text, opacity: 0.9 }}
              caretColor={t.accent}
            />
          </View>
        </View>
        <Btn
          label={node.met ? 'Say hi' : 'Add to next game'}
          onPress={() => {
            onClose();
            if (!node.met) router.push({ pathname: '/create', params: { invite: node.bot.id } });
          }}
        />
      </View>
    </Sheet>
  );
}
