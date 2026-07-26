// Live room plumbing: one reactive Convex query drives every screen.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from 'convex/react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

const DEVICE_KEY = 'venn.device';
const ROOM_KEY = 'venn.activeRoom';

export function makeDeviceId(): string {
  return 'd-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export type RoomPlayer = {
  id: string;
  key: string;
  name: string;
  sym: number;
  isAi: boolean;
  isMe: boolean;
};

export type RoomState = NonNullable<ReturnType<typeof useRoomStateQuery>>;

function useRoomStateQuery(roomId: Id<'rooms'> | null, deviceId: string | null) {
  return useQuery(
    api.game.roomState,
    roomId && deviceId ? { roomId, deviceId } : 'skip',
  );
}

type RoomCtx = {
  deviceId: string | null;
  roomId: Id<'rooms'> | null;
  enterRoom: (id: Id<'rooms'>) => void;
  clearRoom: () => void;
};

const Ctx = createContext<RoomCtx | null>(null);

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<Id<'rooms'> | null>(null);

  useEffect(() => {
    (async () => {
      let d = await AsyncStorage.getItem(DEVICE_KEY).catch(() => null);
      if (!d) {
        d = makeDeviceId();
        AsyncStorage.setItem(DEVICE_KEY, d).catch(() => {});
      }
      setDeviceId(d);
      const r = await AsyncStorage.getItem(ROOM_KEY).catch(() => null);
      if (r) setRoomId(r as Id<'rooms'>);
    })();
  }, []);

  const enterRoom = useCallback((id: Id<'rooms'>) => {
    setRoomId(id);
    AsyncStorage.setItem(ROOM_KEY, id).catch(() => {});
  }, []);

  const clearRoom = useCallback(() => {
    setRoomId(null);
    AsyncStorage.removeItem(ROOM_KEY).catch(() => {});
  }, []);

  const value = useMemo(() => ({ deviceId, roomId, enterRoom, clearRoom }), [deviceId, roomId, enterRoom, clearRoom]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRoomSession(): RoomCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRoomSession outside RoomProvider');
  return v;
}

/** The live room state (undefined while loading, null if room gone). */
export function useRoom() {
  const { roomId, deviceId } = useRoomSession();
  return useRoomStateQuery(roomId, deviceId);
}

/** Countdown against a server deadline. */
export function useCountdown(deadline: number | null | undefined, totalMs: number): { tleft: number; pct: number } {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (deadline == null) return;
    setNow(Date.now()); // a stale `now` from before the deadline existed would inflate the clock
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [deadline]);
  if (deadline == null) return { tleft: 0, pct: 100 };
  const leftMs = Math.max(0, deadline - Math.max(now, Date.now() - 1500));
  return {
    tleft: Math.ceil(leftMs / 1000),
    pct: Math.max(0, Math.min(100, (leftMs / totalMs) * 100)),
  };
}
