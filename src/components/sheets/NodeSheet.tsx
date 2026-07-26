// One person on your map — what you share, and Gemma's opener for them.

import { useAction } from 'convex/react';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../../convex/_generated/api';
import { FloorPerson } from '../../store/AppStore';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Avatar, GemmaMark } from '../Avatar';
import { Skeleton } from '../Skeleton';
import { Btn, RoundBtn, Sheet, StreamedText } from '../ui';

const openerCache: Record<string, string> = {};

export function NodeSheet({ node, onClose }: { node: FloorPerson | null; onClose: () => void }) {
  const { t } = useTheme();
  const router = useRouter();
  const openerAction = useAction(api.ai.openerAction);
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (!node) return;
    if (!node.met) {
      setLine('Never played together, so I have nothing on them yet. That is what a room is for.');
      return;
    }
    const cacheKey = `${node.key}|${node.overlaps.join(',')}`;
    if (openerCache[cacheKey]) {
      setLine(openerCache[cacheKey]);
      return;
    }
    setLine(null);
    let alive = true;
    openerAction({ name: node.name, items: node.overlaps })
      .then((l) => {
        openerCache[cacheKey] = l;
        if (alive) setLine(l);
      })
      .catch(() => alive && setLine(`Ask ${node.name} what they answered tonight.`));
    return () => {
      alive = false;
    };
  }, [node, openerAction]);

  if (!node) return null;

  return (
    <Sheet visible={!!node} onClose={onClose}>
      <View style={{ padding: 22, paddingBottom: 34 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 16 }}>
          <Avatar sym={node.sym} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 23, color: t.text }}>{node.name}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.textMuted }}>
              {node.isAi ? 'AI floor-mate' : 'real person'} ·{' '}
              {node.met ? `played ${node.games} game${node.games === 1 ? '' : 's'} together` : 'never met'}
            </Text>
          </View>
          <RoundBtn icon="x" size={34} onPress={onClose} />
        </View>
        {node.overlaps.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
            {node.overlaps.map((it) => (
              <View key={it} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.accent2_100 }}>
                <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: t.accent2_800 }}>{it}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 9, marginBottom: 18, alignItems: 'flex-start' }}>
          <View style={{ marginTop: 3 }}>
            <GemmaMark size={14} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            {line == null ? (
              <View style={{ gap: 7 }}>
                <Skeleton width="95%" height={13} />
                <Skeleton width="60%" height={13} />
              </View>
            ) : (
              <StreamedText
                text={line}
                style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, fontStyle: 'italic', color: t.text, opacity: 0.9 }}
                caretColor={t.accent}
              />
            )}
          </View>
        </View>
        <Btn
          label={node.met ? 'Say hi' : 'Add to next game'}
          onPress={() => {
            onClose();
            if (!node.met && node.isAi) router.push({ pathname: '/create', params: { invite: node.key } });
          }}
        />
      </View>
    </Sheet>
  );
}
