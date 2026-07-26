import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AI_SEEDS } from '../../convex/lib';
import { DEFAULT_FLOOR } from '../game/data';
import {
  loadPlans,
  loadProfile,
  loadWorld,
  MetPerson,
  Plan,
  Profile,
  savePlans,
  saveProfile,
  saveWorld,
  World,
} from './persist';

type CoPlayer = { key: string; name: string; sym: number; isAi: boolean };

type AppStoreCtx = {
  ready: boolean;
  profile: Profile;
  setProfile: (patch: Partial<Profile>) => void;
  onboarded: boolean;
  world: World;
  /** merge one finished game into the persistent world */
  recordGame: (coPlayers: CoPlayer[], overlapsByKey: Record<string, string[]>) => void;
  plans: Plan[];
  addPlan: (p: Omit<Plan, 'id' | 'createdAt'>) => void;
  removePlan: (id: string) => void;
};

const EMPTY_WORLD: World = { gamesPlayed: 0, met: {} };

const Ctx = createContext<AppStoreCtx | null>(null);

/** old installs stored bot ids with no name/sym — upgrade them in place */
function migrateWorld(w: World): World {
  const met: Record<string, MetPerson> = {};
  Object.entries(w.met || {}).forEach(([key, entry]: [string, any]) => {
    if (entry?.name) {
      met[key] = entry;
      return;
    }
    const seed = AI_SEEDS.find((s) => s.key === key || `ai:${s.key}` === key);
    if (seed) {
      met[`ai:${seed.key}`] = {
        name: seed.name,
        sym: seed.sym,
        isAi: true,
        games: entry?.games ?? 1,
        overlaps: entry?.overlaps ?? [],
      };
    }
  });
  return { gamesPlayed: w.gamesPlayed || 0, met };
}

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
      if (w) setWorld(migrateWorld(w));
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
      recordGame: (coPlayers, overlapsByKey) => {
        setWorld((prev) => {
          const met = { ...prev.met };
          coPlayers.forEach((p) => {
            const cur = met[p.key] || { name: p.name, sym: p.sym, isAi: p.isAi, games: 0, overlaps: [] };
            const mine = overlapsByKey[p.key] || [];
            const merged = [...cur.overlaps];
            mine.forEach((o) => {
              if (!merged.some((x) => x.toLowerCase() === o.toLowerCase())) merged.push(o);
            });
            met[p.key] = {
              name: p.name,
              sym: p.sym,
              isAi: p.isAi,
              games: cur.games + 1,
              overlaps: merged.slice(0, 8),
            };
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

export type FloorPerson = {
  key: string;
  name: string;
  sym: number;
  isAi: boolean;
  met: boolean;
  games: number;
  overlaps: string[];
};

/** People on your map: everyone you've met, plus AI floor-mates you haven't. */
export function floorPeople(world: World): FloorPerson[] {
  const metEntries: FloorPerson[] = Object.entries(world.met).map(([key, m]) => ({
    key,
    name: m.name,
    sym: m.sym,
    isAi: m.isAi,
    met: true,
    games: m.games,
    overlaps: m.overlaps,
  }));
  const unmetAi: FloorPerson[] = AI_SEEDS.filter((s) => !world.met[`ai:${s.key}`]).map((s) => ({
    key: `ai:${s.key}`,
    name: s.name,
    sym: s.sym,
    isAi: true,
    met: false,
    games: 0,
    overlaps: [],
  }));
  return [...metEntries, ...unmetAi];
}
