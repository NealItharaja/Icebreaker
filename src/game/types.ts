import { Bot, Archetype, Spice } from './data';

export type PlayerId = string; // 'me' or a bot id

export type Player = {
  id: PlayerId;
  name: string;
  sym: number;
  bot?: Bot;
};

/** One round's words — written live by Gemma, or the offline fallback. */
export type RoundSpec = {
  archetype: Archetype;
  topic: string;
  intro: string;
  q: string;
  hint: string;
  chips: string[];
  selfQ: string;
  selfHint: string;
  aboutMe: string;
  /** phrased about someone else; contains {name} */
  aboutTemplate: string;
  aboutHint: string;
  /** true when Gemma wrote it, false when canned */
  live: boolean;
};

/** A bot's whole move for one round (answer + the lies around it). */
export type BotMove = {
  answer: string;
  decoys: string[];
  planted: string | null;
};

/** One spotlight inside the guess phase. */
export type Spot = {
  sid: PlayerId;
  sym: number;
  name: string;
  truth: string;
  decoys: string[];
  planted: string | null;
};

export type Judgment = { score: number; ok: boolean; half: boolean; note: string };

export type RevealRow = {
  gid: PlayerId;
  sym: number;
  who: string; // 'you' or name — as shown in the row
  name: string;
  value: string;
  ok: boolean;
  half: boolean;
  isTrap: boolean;
  meter: number | null; // 0..100, only for type rounds
  tag: string; // '+100' | '+55' | 'trapped' | 'miss' | 'wrong'
};

export type RevealCard = {
  i: number;
  sid: PlayerId;
  sym: number;
  kicker: string;
  q: string;
  truth: string;
  rows: RevealRow[];
  pts: string[];
  gemma: string;
  selfNote: string;
  anyOk: boolean;
  allMiss: boolean;
};

export type PairOverlaps = Record<string, string[]>; // 'a|b' sorted key -> shared labels

export type GameConfig = {
  code: string;
  n: number;
  spice: Spice;
};
