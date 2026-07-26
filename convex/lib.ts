// Pure server-side game logic — no Convex imports, unit-testable.
// Cards are computed neutrally (playerIds + names); each client renders
// "you" for its own player.

export type Archetype = 'tap' | 'type' | 'whose';
export type Spice = 'cozy' | 'chaotic' | 'unhinged';

export type RoundSpec = {
  archetype: string;
  topic: string;
  intro: string;
  q: string;
  hint: string;
  chips: string[];
  selfQ: string;
  selfHint: string;
  aboutMe: string;
  aboutTemplate: string;
  aboutHint: string;
  live: boolean;
};

export type PlayerLite = { id: string; name: string; sym: number; isAi: boolean; order: number };

export type SpotLite = {
  sid: string;
  name: string;
  sym: number;
  truth: string;
  decoys: string[];
  planted: string | null;
  selfMove: string | null;
};

export type Judgment = { score: number; ok: boolean; half: boolean; note: string };

export type NeutralRow = {
  gid: string;
  name: string;
  sym: number;
  value: string; // display value (quoted for type, "blamed <name>" for whose)
  ok: boolean;
  half: boolean;
  isTrap: boolean;
  meter: number | null;
  tag: string;
};

export type NeutralCard = {
  i: number;
  sid: string;
  name: string;
  sym: number;
  truth: string; // display truth ("It was <name>" for whose)
  take: string | null; // the anonymous take text (whose rounds)
  rows: NeutralRow[];
  pts: { pid: string; text: string }[];
  gemma: string;
  selfNote: string;
  anyOk: boolean;
  allMiss: boolean;
};

// ── AI seat-filler personas ───────────────────────────────────────────────

export type AiSeed = {
  key: string;
  name: string;
  sym: number;
  from: string;
  hobby: string;
  vibe: string;
  food: string;
  snack: string;
  take: string;
};

export const AI_SEEDS: AiSeed[] = [
  { key: 'maya', name: 'Maya', sym: 2, from: 'Tucson, AZ', hobby: 'thrifting', vibe: 'chronically early, aggressively friendly', food: 'breakfast burrito', snack: 'cold brew', take: 'pineapple belongs on everything, not just pizza' },
  { key: 'theo', name: 'Theo', sym: 3, from: 'Portland, ME', hobby: 'bass guitar', vibe: 'quiet until music comes up', food: 'pad thai', snack: 'iced coffee', take: '8am classes should be illegal' },
  { key: 'jalen', name: 'Jalen', sym: 4, from: 'Atlanta, GA', hobby: 'pickup basketball', vibe: 'knows everyone on the floor already', food: 'wings', snack: 'hot cheetos', take: 'the dining hall pasta is underrated' },
  { key: 'chloe', name: 'Chloe', sym: 5, from: 'Minneapolis, MN', hobby: 'film photography', vibe: 'dry humor, secretly sentimental', food: 'tater tot hotdish', snack: 'bubble tea', take: 'group projects are a scam' },
  { key: 'sam', name: 'Sam', sym: 6, from: 'San Diego, CA', hobby: 'skating', vibe: 'will befriend you at 7am whether you like it or not', food: 'carne asada fries', snack: 'churro', take: 'sunrise beats sunset, no debate' },
  { key: 'ava', name: 'Ava', sym: 7, from: 'Columbus, OH', hobby: 'chess', vibe: 'wins arguments on purpose, games by accident', food: 'chicken tenders', snack: 'ramen at 2am', take: 'cereal is a soup' },
];

// ── fallback round shells (offline / model failure) ───────────────────────

export const FALLBACK_ROUNDS: RoundSpec[] = [
  {
    archetype: 'tap',
    topic: 'comfort order',
    intro: 'Round 1. One question, everyone at once. Nobody has said anything yet.',
    q: 'The week has beaten you. What are you ordering?',
    hint: 'Tap one or type your own. Your friends are about to guess this.',
    chips: ['breakfast burrito', 'wings', 'pad thai', 'carne asada fries', 'chicken tenders', 'tater tot hotdish', 'deep dish pizza', 'pho'],
    selfQ: 'Now plant a lie in your own options.',
    selfHint: 'I drafted three. 60 points for every friend who bites.',
    aboutMe: 'The week has beaten you. What did you order?',
    aboutTemplate: 'The week has beaten {name}. What did they order?',
    aboutHint: 'One of these is real. One was planted by them.',
    live: false,
  },
  {
    archetype: 'type',
    topic: '2am reach',
    intro: 'Round 2. New question — and now I know what you all said.',
    q: "It's 2am and you're starving. What are you reaching for?",
    hint: 'Type it. Spelling will be forgiven later.',
    chips: ['ramen at 2am', 'cold brew', 'hot cheetos', 'bubble tea', 'churro', 'peanut butter, spoon'],
    selfQ: 'How many of them will get yours right?',
    selfHint: 'Call it now. Exactly right is worth 80.',
    aboutMe: "It's 2am and you're starving. What did you reach for?",
    aboutTemplate: "It's 2am and {name} is starving. What are they reaching for?",
    aboutHint: 'Type it. Gemma judges by meaning — brand names are forgiven.',
    live: false,
  },
  {
    archetype: 'whose',
    topic: 'indefensible take',
    intro: 'Round 3. Last one, and this one goes in anonymously.',
    q: 'Your most indefensible take. Go.',
    hint: 'It goes in anonymously. They have to work out it was you.',
    chips: ['cereal is a soup', '8am classes should be illegal', 'group projects are a scam', 'sunrise beats sunset, no debate', 'the dining hall pasta is underrated'],
    selfQ: 'Who will they blame for yours?',
    selfHint: 'Read the room. 80 points if you call it.',
    aboutMe: 'Whose take is this?',
    aboutTemplate: 'Whose take is this?',
    aboutHint: 'Someone in this room said it out loud once, and regretted it.',
    live: false,
  },
];

// ── timers ────────────────────────────────────────────────────────────────

export const ASK_MS = 60_000;
export const guessMs = (n: number) => (25 + 15 * (n - 1)) * 1000;

// ── room codes: fully numeric, 4 digits ───────────────────────────────────

export function randomCode(rand: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 4; i++) out += Math.floor(rand() * 10);
  return out;
}

// ── deterministic AI guessing (same spread as the design) ─────────────────

export function h(r: number, sidIdx: number, bidIdx: number): number {
  return (r * 3 + (sidIdx + 1) * 5 + (bidIdx + 1) * 2) % 7;
}

export function aiGuess(
  r: number,
  archetype: string,
  spot: SpotLite,
  ai: PlayerLite,
  players: PlayerLite[],
  answers: Record<string, string>,
): string {
  const sidIdx = players.findIndex((p) => p.id === spot.sid);
  const bidIdx = players.findIndex((p) => p.id === ai.id);
  const hh = h(r, sidIdx, bidIdx);
  const right = hh <= 3;
  if (archetype === 'tap') {
    if (right) return spot.truth;
    if (hh === 4 && spot.planted) return spot.planted;
    const pool = spot.decoys.length ? spot.decoys : [spot.truth];
    return pool[(hh - 5 + pool.length * 2) % pool.length];
  }
  if (archetype === 'type') {
    if (right) return spot.truth;
    const others = players
      .filter((p) => p.id !== spot.sid)
      .map((p) => answers[p.id])
      .filter(Boolean);
    if (!others.length) return spot.truth;
    return others[hh % others.length];
  }
  if (right) return spot.sid;
  const pool = players.filter((p) => p.id !== ai.id && p.id !== spot.sid);
  return pool.length ? pool[hh % pool.length].id : spot.sid;
}

export function aiSelf(r: number, archetype: string, spot: SpotLite, players: PlayerLite[]): string | null {
  const sidIdx = players.findIndex((p) => p.id === spot.sid);
  if (archetype === 'type') return String((sidIdx + 1) % players.length);
  if (archetype === 'whose') {
    const pool = players.filter((p) => p.id !== spot.sid);
    return pool.length ? pool[(sidIdx + 1) % pool.length].id : null;
  }
  return spot.planted;
}

// ── fallback judge (token overlap) ────────────────────────────────────────

function toks(s: string | null | undefined): string[] {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !['the', 'and', 'some', 'from'].includes(w));
}

export function fallbackJudge(guess: string | null | undefined, truth: string): Judgment {
  if (!guess) return { score: 0, ok: false, half: false, note: 'No answer came in before the timer.' };
  const a = toks(guess).join(' ');
  const b = toks(truth).join(' ');
  if (a === b) return { score: 1, ok: true, half: false, note: `“${guess}” — word for word.` };
  const jt = toks(guess);
  const bt = toks(truth);
  const inter = jt.filter((w) => bt.includes(w)).length;
  const jac = inter / Math.max(1, new Set(jt.concat(bt)).size);
  if (jac >= 0.4) return { score: 0.6 + jac * 0.35, ok: true, half: false, note: `Close enough — same thing in a different wrapper.` };
  if (jac >= 0.2) return { score: 0.5, ok: false, half: true, note: 'Half credit — same neighborhood.' };
  return { score: Math.max(0.08, jac), ok: false, half: false, note: `Not close. It was ${truth}.` };
}

// ── neutral reveal computation ────────────────────────────────────────────

export type RevealInput = {
  r: number;
  archetype: string;
  players: PlayerLite[];
  spots: SpotLite[]; // only players who actually sealed an answer
  guesses: Record<string, string | undefined>; // `${gid}|${sid}` -> value
  judge?: (guess: string | undefined, truth: string, gid: string, sid: string) => Judgment;
};

export function computeReveal(
  inp: RevealInput,
  prevScores: Record<string, number>,
): { cards: NeutralCard[]; scores: Record<string, number>; deltas: Record<string, number> } {
  const { r, archetype, players, spots, guesses } = inp;
  const judge = inp.judge || ((g, t) => fallbackJudge(g, t));
  const scores: Record<string, number> = { ...prevScores };
  const deltas: Record<string, number> = {};
  players.forEach((p) => {
    if (scores[p.id] == null) scores[p.id] = 0;
    deltas[p.id] = 0;
  });
  const add = (id: string, vv: number) => {
    scores[id] += vv;
    deltas[id] += vv;
  };
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name || '?';

  const cards: NeutralCard[] = spots.map((sp, i) => {
    const guessers = players.filter((p) => p.id !== sp.sid);
    const pts: { pid: string; text: string }[] = [];
    const rows: NeutralRow[] = guessers.map((g) => {
      const val = guesses[`${g.id}|${sp.sid}`];
      const row: NeutralRow = {
        gid: g.id,
        name: g.name,
        sym: g.sym,
        value: val || 'no answer',
        ok: false,
        half: false,
        isTrap: false,
        meter: null,
        tag: 'miss',
      };
      if (archetype === 'type') {
        const j = judge(val, sp.truth, g.id, sp.sid);
        row.value = val ? `“${val}”` : 'no answer';
        row.meter = Math.round(j.score * 100);
        row.ok = j.ok;
        row.half = j.half;
        row.tag = j.ok ? '+100' : j.half ? '+55' : 'miss';
        if (j.ok) add(g.id, 100);
        else if (j.half) add(g.id, 55);
        if (j.ok || j.half) pts.push({ pid: g.id, text: `${g.name} ${row.tag}` });
      } else if (archetype === 'tap') {
        const ok = val === sp.truth;
        const isTrap = !!sp.planted && val === sp.planted;
        row.ok = ok;
        row.isTrap = isTrap;
        row.tag = ok ? '+100' : isTrap ? 'trapped' : 'miss';
        if (ok) {
          add(g.id, 100);
          pts.push({ pid: g.id, text: `${g.name} +100` });
        }
        if (isTrap) {
          add(sp.sid, 60);
          pts.push({ pid: sp.sid, text: `${sp.name} +60 trap` });
        }
      } else {
        const ok = val === sp.sid;
        row.value = val ? `blamed ${nameOf(val)}` : 'no answer';
        row.ok = ok;
        row.tag = ok ? '+100' : 'wrong';
        if (ok) {
          add(g.id, 100);
          pts.push({ pid: g.id, text: `${g.name} +100` });
        }
      }
      return row;
    });

    const selfVal = sp.selfMove;
    let selfNote = '';
    if (archetype === 'type') {
      const got = rows.filter((x) => x.ok).length;
      const called = parseInt(String(selfVal), 10);
      selfNote = isNaN(called) ? `${sp.name} never called it.` : `${sp.name} called ${called}, got ${got}.`;
      if (!isNaN(called) && called === got) {
        add(sp.sid, 80);
        pts.push({ pid: sp.sid, text: `${sp.name} +80 called it` });
      }
    } else if (archetype === 'whose') {
      const counts: Record<string, number> = {};
      rows.forEach((x) => {
        const m = (x.value || '').replace('blamed ', '');
        counts[m] = (counts[m] || 0) + 1;
      });
      const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      const predName = selfVal ? nameOf(selfVal) : null;
      selfNote = predName ? `${sp.name} predicted the room would blame ${predName}.` : '';
      if (predName && top === predName) {
        add(sp.sid, 80);
        pts.push({ pid: sp.sid, text: `${sp.name} +80 read the room` });
      }
    } else if (sp.planted) {
      selfNote = `${sp.name} planted “${sp.planted}”.`;
    }

    return {
      i,
      sid: sp.sid,
      name: sp.name,
      sym: sp.sym,
      truth: archetype === 'whose' ? `It was ${sp.name}` : sp.truth,
      take: archetype === 'whose' ? sp.truth : null,
      rows,
      pts,
      gemma: '',
      selfNote,
      anyOk: rows.some((x) => x.ok),
      allMiss: rows.every((x) => !x.ok),
    };
  });

  return { cards, scores, deltas };
}

export function fallbackCommentary(archetype: string, card: NeutralCard): string {
  const wrong = card.rows.filter((x) => !x.ok);
  const right = card.rows.filter((x) => x.ok);
  if (archetype === 'tap') {
    const caught = card.rows.filter((x) => x.isTrap).map((x) => x.name);
    if (caught.length) return `${card.selfNote} ${caught.join(' and ')} walked straight in.`;
    if (!wrong.length) return `Nobody blinked. ${card.name}, your friends are actually listening.`;
    return `${card.selfNote} Nobody bit — but ${wrong.map((x) => x.name).join(' and ')} still got it wrong on their own.`;
  }
  if (archetype === 'type') {
    if (!right.length) return `Zero. ${card.name} lives in complete secrecy.`;
    return `${right.length} of the room had it. ${card.selfNote}`;
  }
  if (!right.length) return `Nobody guessed ${card.name}. That take was well hidden.`;
  return `${right.map((x) => x.name).join(' and ')} knew instantly. ${card.selfNote}`;
}

export const FALLBACK_MIDS = [
  'Two of you answered the same thing and have never spoken. Noted.',
  'Half this room shares a 2am habit and thinks it is a private one.',
  'Last round. The takes are where friendships get tested.',
];

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/** exact-match fallback clustering across played rounds */
export function fallbackPairs(
  players: PlayerLite[],
  answersByRound: Record<string, string>[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  players.forEach((a, i) =>
    players.slice(i + 1).forEach((b) => {
      const shared: string[] = [];
      answersByRound.forEach((ans) => {
        const A = ans[a.id];
        const B = ans[b.id];
        if (A && B && A.toLowerCase() === B.toLowerCase() && !shared.includes(A)) shared.push(A);
      });
      out[pairKey(a.id, b.id)] = shared;
    }),
  );
  return out;
}
