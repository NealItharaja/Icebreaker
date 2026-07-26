import AsyncStorage from '@react-native-async-storage/async-storage';

const K = {
  theme: 'venn.theme',
  profile: 'venn.profile',
  world: 'venn.world',
  plans: 'venn.plans',
  apiKey: 'venn.openrouter_key',
};

export type Profile = { name: string; sym: number; floor: string };

/** What survives between games: who you've played with and what you share. */
export type World = {
  gamesPlayed: number;
  /** per bot id: games played together + accumulated overlap labels */
  met: Record<string, { games: number; overlaps: string[] }>;
};

export type Plan = {
  id: string;
  when: string; // "8:30 pm"
  title: string;
  why: string;
  with?: string; // bot id
  createdAt: number;
};

async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function setJSON(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage is best-effort; the app must keep working without it
  }
}

export const loadTheme = () => getJSON<'light' | 'dark'>(K.theme);
export const saveTheme = (v: 'light' | 'dark') => setJSON(K.theme, v);

export const loadProfile = () => getJSON<Profile>(K.profile);
export const saveProfile = (p: Profile) => setJSON(K.profile, p);

export const loadWorld = () => getJSON<World>(K.world);
export const saveWorld = (w: World) => setJSON(K.world, w);

export const loadPlans = () => getJSON<Plan[]>(K.plans);
export const savePlans = (p: Plan[]) => setJSON(K.plans, p);

export const loadApiKey = async () => {
  try {
    return await AsyncStorage.getItem(K.apiKey);
  } catch {
    return null;
  }
};
export const saveApiKey = (v: string) => {
  try {
    return AsyncStorage.setItem(K.apiKey, v);
  } catch {
    return Promise.resolve();
  }
};
