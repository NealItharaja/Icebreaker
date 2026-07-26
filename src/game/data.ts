// The simulated floor. Bots exist so one phone can play a full game —
// their personas seed Gemma's in-character answers (and the offline fallback).

export type Bot = {
  id: string;
  name: string;
  sym: number;
  from: string;
  food: string;
  snack: string;
  take: string;
  hobby: string;
  vibe: string;
};

export const BOTS: Bot[] = [
  { id: 'maya', name: 'Maya', sym: 2, from: 'Tucson, AZ', food: 'breakfast burrito', snack: 'cold brew', take: 'pineapple belongs on everything, not just pizza', hobby: 'thrifting', vibe: 'chronically early, aggressively friendly' },
  { id: 'theo', name: 'Theo', sym: 3, from: 'Portland, ME', food: 'pad thai', snack: 'iced coffee', take: '8am classes should be illegal', hobby: 'bass guitar', vibe: 'quiet until music comes up' },
  { id: 'jalen', name: 'Jalen', sym: 4, from: 'Atlanta, GA', food: 'wings', snack: 'hot cheetos', take: 'the dining hall pasta is underrated', hobby: 'pickup basketball', vibe: 'knows everyone on the floor already' },
  { id: 'chloe', name: 'Chloe', sym: 5, from: 'Minneapolis, MN', food: 'tater tot hotdish', snack: 'bubble tea', take: 'group projects are a scam', hobby: 'film photography', vibe: 'dry humor, secretly sentimental' },
  { id: 'sam', name: 'Sam', sym: 6, from: 'San Diego, CA', food: 'carne asada fries', snack: 'churro', take: 'sunrise beats sunset, no debate', hobby: 'skating', vibe: 'will befriend you at 7am whether you like it or not' },
  { id: 'ava', name: 'Ava', sym: 7, from: 'Columbus, OH', food: 'chicken tenders', snack: 'ramen at 2am', take: 'cereal is a soup', hobby: 'chess', vibe: 'wins arguments on purpose, games by accident' },
];

export const FOODS = ['breakfast burrito', 'wings', 'pad thai', 'carne asada fries', 'chicken tenders', 'tater tot hotdish', 'deep dish pizza', 'pho'];
export const SNACKS = ['ramen at 2am', 'cold brew', 'hot cheetos', 'bubble tea', 'churro', 'peanut butter, spoon'];
export const TAKES = ['cereal is a soup', '8am classes should be illegal', 'group projects are a scam', 'sunrise beats sunset, no debate', 'the dining hall pasta is underrated'];

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

export const DEFAULT_FLOOR = 'kerr hall · 3rd floor';

export type Spice = 'cozy' | 'chaotic' | 'unhinged';

export type Archetype = 'tap' | 'type' | 'whose';

/** Static round shells — Gemma rewrites all the words live; these are the offline fallback. */
export const FALLBACK_ROUNDS = [
  {
    archetype: 'tap' as Archetype,
    field: 'food',
    intro: 'Round 1. One question, everyone at once. Nobody has said anything yet.',
    q: 'The week has beaten you. What are you ordering?',
    hint: 'Tap one or type your own. Your friends are about to guess this.',
    chips: FOODS,
    selfQ: 'Now plant a lie in your own options.',
    selfHint: 'I drafted three. 60 points for every friend who bites.',
    aboutMe: 'The week has beaten you. What did you order?',
    about: (n: string) => `The week has beaten ${n}. What did they order?`,
    aboutHint: 'One of these is real. One was planted by them.',
  },
  {
    archetype: 'type' as Archetype,
    field: 'snack',
    intro: 'Round 2. New question — and now I know what you all ordered.',
    q: "It's 2am and you're starving. What are you reaching for?",
    hint: 'Type it or tap one. Spelling will be forgiven later.',
    chips: SNACKS,
    selfQ: 'How many of them will get yours right?',
    selfHint: 'Call it now. Exactly right is worth 80.',
    aboutMe: "It's 2am and you're starving. What did you reach for?",
    about: (n: string) => `It's 2am and ${n} is starving. What are they reaching for?`,
    aboutHint: 'Type it. Gemma judges by meaning — brand names are forgiven.',
  },
  {
    archetype: 'whose' as Archetype,
    field: 'take',
    intro: 'Round 3. Last one, and this one goes in anonymously.',
    q: 'Your most indefensible take. Go.',
    hint: 'It goes in anonymously. They have to work out it was you.',
    chips: TAKES,
    selfQ: 'Who will they blame for yours?',
    selfHint: 'Read the room. 80 points if you call it.',
    aboutMe: 'Whose take is this?',
    about: () => 'Whose take is this?',
    aboutHint: 'Someone in this room said it out loud once, and regretted it.',
  },
];

export const CODE_KEYS = ['V', '4', 'K', 'Q', '7', 'M', '2', 'X', '9', '⌫', 'B', 'go'];

export function randomCode(): string {
  const chars = 'V4KQ7M2X9B';
  let out = '';
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
