// Client-side constants. All live content comes from the server; the maps
// below only back the offline overlap fallback used for final-screen geometry.

export const DEFAULT_FLOOR = 'kerr hall · 3rd floor';

export type Spice = 'cozy' | 'chaotic' | 'unhinged';

export type Archetype = 'tap' | 'type' | 'whose';

/** Fallback overlap clusters — Gemma clusters live when it can. */
export const CL: Record<string, Record<string, string>> = {
  food: {
    'breakfast burrito': 'handheld breakfast',
    'carne asada fries': 'late-night tex-mex',
    wings: 'sauce and napkins',
    'chicken tenders': 'fried and honest',
    'pad thai': 'noodle bowls',
    pho: 'noodle bowls',
    'tater tot hotdish': 'midwest casserole',
    'deep dish pizza': 'pizza with a fork',
  },
  snack: {
    'cold brew': 'cold caffeine after midnight',
    'iced coffee': 'cold caffeine after midnight',
    'bubble tea': 'cold caffeine after midnight',
    'ramen at 2am': 'two-minute carbs',
    'peanut butter, spoon': 'two-minute carbs',
    'hot cheetos': 'salty, red fingers',
    churro: 'a sweet tooth',
  },
  take: {
    '8am classes should be illegal': 'sleep advocacy',
    'sunrise beats sunset, no debate': 'morning people',
    'cereal is a soup': 'food taxonomy crimes',
    'pineapple belongs on everything, not just pizza': 'food taxonomy crimes',
    'the dining hall pasta is underrated': 'dining hall apologists',
    'group projects are a scam': 'academic grievances',
  },
};

/** Near-miss synonyms the fallback judge forgives. */
export const NEAR: Record<string, string> = {
  'ramen at 2am': 'instant noodles',
  'cold brew': 'iced coffee',
  'iced coffee': 'cold brew',
  'hot cheetos': 'flamin hot cheetos',
  'bubble tea': 'boba',
  churro: 'a cinnamon sugar churro',
  'peanut butter, spoon': 'peanut butter straight from the jar',
};
