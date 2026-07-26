import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BOTS, DEFAULT_FLOOR } from '../game/data';
import { PairOverlaps } from '../game/types';
import { pairKey } from '../game/engine';
import { loadPlans, loadProfile, loadWorld, Plan, Profile, savePlans, saveProfile, saveWorld, World } from './persist';

type AppStoreCtx = {
  ready: boolean;
  profile: Profile;
  setProfile: (patch: Partial<Profile>) => void;
  /** whether onboarding (name screen) has been completed at least once */
  onboarded: boolean;
  world: World;
  /** merge one finished game into the persistent world */
  recordGame: (botIds: string[], overlaps: PairOverlaps) => void;
  plans: Plan[];
  addPlan: (p: Omit<Plan, 'id' | 'createdAt'>) => void;
  removePlan: (id: string) => void;
};

const EMPTY_WORLD: World = { gamesPlayed: 0, met: {} };

const Ctx = createContext<AppStoreCtx | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile>({ name: '', sym: 1, floor: DEFAULT_FLOOR });
  const [onboarded, setOnboarded] = useState(false);
  const [world, setWorld] = useState<World>(EMPTY_WORLD);
  const [plans, setPlans] = useState<Plan[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    Promise.all([loadProfile(), loadWorld(), loadPlans()]).then(([p, w, pl]) => {
      if (p) {
        setProfileState({ ...p, floor: p.floor || DEFAULT_FLOOR });
        setOnboarded(!!p.name);
      }
      if (w) setWorld({ ...EMPTY_WORLD, ...w });
      if (pl) setPlans(pl);
      setReady(true);
    });
  }, []);

  const value = useMemo<AppStoreCtx>(
    () => ({
      ready,
      profile,
      onboarded,
      setProfile: (patch) => {
        setProfileState((prev) => {
          const next = { ...prev, ...patch };
          saveProfile(next);
          if (next.name) setOnboarded(true);
          return next;
        });
      },
      world,
      recordGame: (botIds, overlaps) => {
        setWorld((prev) => {
          const met = { ...prev.met };
          botIds.forEach((id) => {
            const cur = met[id] || { games: 0, overlaps: [] };
            const mine = overlaps[pairKey('me', id)] || [];
            const merged = [...cur.overlaps];
            mine.forEach((o) => {
              if (!merged.some((x) => x.toLowerCase() === o.toLowerCase())) merged.push(o);
            });
            met[id] = { games: cur.games + 1, overlaps: merged.slice(0, 8) };
          });
          const next: World = { gamesPlayed: prev.gamesPlayed + 1, met };
          saveWorld(next);
          return next;
        });
      },
      plans,
      addPlan: (p) => {
        setPlans((prev) => {
          const next = [...prev, { ...p, id: String(Date.now()), createdAt: Date.now() }];
          savePlans(next);
          return next;
        });
      },
      removePlan: (id) => {
        setPlans((prev) => {
          const next = prev.filter((x) => x.id !== id);
          savePlans(next);
          return next;
        });
      },
    }),
    [ready, profile, onboarded, world, plans],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppStore outside provider');
  return v;
}

/** Everyone on the floor, met or not — the map is built from this. */
export function floorPeople(world: World) {
  return BOTS.map((b) => ({
    bot: b,
    met: !!world.met[b.id] && world.met[b.id].games > 0,
    overlaps: world.met[b.id]?.overlaps ?? [],
    games: world.met[b.id]?.games ?? 0,
  }));
}
