// Pure game logic, ported from the Venn design prototype.
// Nothing here talks to the network or the UI; Gemma's judgments and
// commentary are injected by the caller.

import { CL, NEAR } from './data';
import { Judgment, PairOverlaps, Player, PlayerId, RevealCard, RevealRow, Spot } from './types';

/** Deterministic "how good is this bot's guess" hash — same spread as the design. */
export function h(r: number, sidIdx: number, bidIdx: number): number {
  return (r * 3 + (sidIdx + 1) * 5 + (bidIdx + 1) * 2) % 7;
}

export function botGuess(
  r: number,
  archetype: 'tap' | 'type' | 'whose',
  spot: Spot,
  botId: PlayerId,
  players: Player[],
  answers: Record<PlayerId, string>,
): string {
  const sidIdx = players.findIndex((p) => p.id === spot.sid);
  const bidIdx = players.findIndex((p) => p.id === botId);
  const hh = h(r, sidIdx, bidIdx);
  const right = hh <= 3;
  if (archetype === 'tap') {
    if (right) return spot.truth;
    if (hh === 4 && spot.planted) return spot.planted;
    const pool = spot.decoys.length ? spot.decoys : [spot.truth];
    return pool[(hh - 5 + pool.length * 2) % pool.length];
  }
  if (archetype === 'type') {
    if (right) return hh === 1 || hh === 3 ? NEAR[spot.truth] || spot.truth : spot.truth;
    const others = players.filter((p) => p.id !== spot.sid).map((p) => answers[p.id]).filter(Boolean);
    if (!others.length) return spot.truth;
    return others[hh % others.length];
  }
  // whose: value is a player id
  if (right) return spot.sid;
  const pool = players.filter((p) => p.id !== botId && p.id !== spot.sid);
  return pool.length ? pool[hh % pool.length].id : spot.sid;
}

/** The spotlight's own side-move for bots (call count / blame prediction / planted lie). */
export function botSelf(
  r: number,
  archetype: 'tap' | 'type' | 'whose',
  spot: Spot,
  players: Player[],
): string | null {
  const sidIdx = players.findIndex((p) => p.id === spot.sid);
  if (archetype === 'type') return String((sidIdx + 1) % players.length);
  if (archetype === 'whose') {
    const pool = players.filter((p) => p.id !== spot.sid);
    return pool.length ? pool[(sidIdx + 1) % pool.length].id : null;
  }
  return spot.planted;
}

// ── fallback semantic judge (design's token-jaccard) ──────────────────────

function toks(s: string | null | undefined): string[] {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !['the', 'and', 'some', 'from', 'jar', 'straight'].includes(w));
}

function bestKnown(text: string): string | null {
  const t = toks(text);
  let best: string | null = null;
  let bs = 0;
  Object.keys(CL.snack).forEach((k) => {
    const kt = toks(k);
    const hit = kt.filter((w) => t.includes(w)).length / Math.max(1, kt.length);
    if (hit > bs) {
      bs = hit;
      best = k;
    }
  });
  return bs >= 0.34 ? best : null;
}

export function fallbackJudge(guess: string | null | undefined, truth: string): Judgment {
  if (!guess) return { score: 0, ok: false, half: false, note: 'No answer came in before the timer.' };
  const a = toks(guess).join(' ');
  const b = toks(truth).join(' ');
  if (a === b) return { score: 1, ok: true, half: false, note: `“${guess}” — word for word.` };
  const near = NEAR[truth];
  if (near && toks(near).join(' ') === a)
    return { score: 0.92, ok: true, half: false, note: `“${guess}” ≈ “${truth}”. Same thing at 2am. Counted.` };
  const jt = toks(guess);
  const bt = toks(truth);
  const inter = jt.filter((w) => bt.includes(w)).length;
  const jac = inter / Math.max(1, new Set(jt.concat(bt)).size);
  if (jac >= 0.4)
    return { score: 0.6 + jac * 0.35, ok: true, half: false, note: `Close enough — “${guess}” is the same thing in a different wrapper.` };
  const k = bestKnown(guess);
  if (k && CL.snack[k] && CL.snack[k] === CL.snack[truth])
    return { score: 0.62, ok: false, half: true, note: `Different snack, same craving — both are ${CL.snack[k]}. Half credit.` };
  return { score: Math.max(0.08, jac), ok: false, half: false, note: `Not close. It was ${truth}.` };
}

// ── reveal computation ────────────────────────────────────────────────────

export type RevealInput = {
  r: number;
  archetype: 'tap' | 'type' | 'whose';
  players: Player[];
  spots: Spot[];
  /** everyone's sealed answers this round */
  answers: Record<PlayerId, string>;
  /** everyone's self moves this round (me from UI, bots from botSelf) */
  selves: Record<PlayerId, string | null>;
  /** guesser -> spotlight -> value (bots filled via botGuess, me from picks) */
  guesses: Record<string, string | undefined>; // key `${gid}|${sid}`
  /** judge for type rounds; defaults to fallbackJudge */
  judge?: (guess: string | undefined, truth: string, gid: PlayerId, sid: PlayerId) => Judgment;
  aboutMe: string;
  aboutTemplate: string;
};

export type RevealResult = {
  cards: RevealCard[];
  scores: Record<PlayerId, number>;
  deltas: Record<PlayerId, number>;
};

export function computeReveal(inp: RevealInput, prevScores: Record<PlayerId, number>): RevealResult {
  const { r, archetype, players, spots, selves, guesses } = inp;
  const judge = inp.judge || ((g, t) => fallbackJudge(g, t));
  const scores: Record<PlayerId, number> = { ...prevScores };
  const deltas: Record<PlayerId, number> = {};
  players.forEach((p) => {
    if (scores[p.id] == null) scores[p.id] = 0;
    deltas[p.id] = 0;
  });
  const add = (id: PlayerId, v: number) => {
    scores[id] += v;
    deltas[id] += v;
  };

  const cards: RevealCard[] = spots.map((sp, i) => {
    const guessers = players.filter((p) => p.id !== sp.sid);
    const pts: string[] = [];
    const rows: RevealRow[] = guessers.map((g) => {
      const val = guesses[`${g.id}|${sp.sid}`];
      const row: RevealRow = {
        gid: g.id,
        sym: g.sym,
        who: g.id === 'me' ? 'you' : g.name,
        name: g.id === 'me' ? 'You' : g.name,
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
        if (j.ok || j.half) pts.push(`${row.name} ${row.tag}`);
      } else if (archetype === 'tap') {
        const ok = val === sp.truth;
        const isTrap = !!sp.planted && val === sp.planted;
        row.ok = ok;
        row.isTrap = isTrap;
        row.tag = ok ? '+100' : isTrap ? 'trapped' : 'miss';
        if (ok) {
          add(g.id, 100);
          pts.push(`${row.name} +100`);
        }
        if (isTrap) {
          add(sp.sid, 60);
          pts.push(`${sp.name} +60 trap`);
        }
      } else {
        const ok = val === sp.sid;
        const who = players.find((p) => p.id === val);
        row.value = who ? `blamed ${who.name}` : 'no answer';
        row.ok = ok;
        row.tag = ok ? '+100' : 'wrong';
        if (ok) {
          add(g.id, 100);
          pts.push(`${row.name} +100`);
        }
      }
      return row;
    });

    const selfVal = selves[sp.sid];
    let selfNote = '';
    const dispName = sp.sid === 'me' ? 'You' : sp.name;
    if (archetype === 'type') {
      const got = rows.filter((x) => x.ok).length;
      const called = parseInt(String(selfVal), 10);
      selfNote = isNaN(called) ? `${dispName} never called it.` : `${dispName} called ${called}, got ${got}.`;
      if (!isNaN(called) && called === got) {
        add(sp.sid, 80);
        pts.push(`${dispName} +80 called it`);
      }
    } else if (archetype === 'whose') {
      const counts: Record<string, number> = {};
      rows.forEach((x) => {
        const m = (x.value || '').replace('blamed ', '');
        counts[m] = (counts[m] || 0) + 1;
      });
      const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      const pred = players.find((p) => p.id === selfVal);
      selfNote = pred ? `${dispName} predicted the room would blame ${pred.name}.` : '';
      if (pred && top === pred.name) {
        add(sp.sid, 80);
        pts.push(`${dispName} +80 read the room`);
      }
    } else if (sp.planted) {
      selfNote = `${dispName} planted “${sp.planted}”.`;
    }

    return {
      i,
      sid: sp.sid,
      sym: sp.sym,
      kicker: archetype === 'whose' ? 'an anonymous take' : `about ${sp.sid === 'me' ? 'you' : sp.name}`,
      q: archetype === 'whose' ? `“${sp.truth}”` : sp.sid === 'me' ? inp.aboutMe : inp.aboutTemplate.replace('{name}', sp.name),
      truth: archetype === 'whose' ? `It was ${dispName}` : sp.truth,
      rows,
      pts,
      gemma: '', // filled by the caller (live Gemma line or fallback)
      selfNote,
      anyOk: rows.some((x) => x.ok),
      allMiss: rows.every((x) => !x.ok),
    };
  });

  return { cards, scores, deltas };
}

/** Fallback one-liner per reveal card, in the design's voice. */
export function fallbackCommentary(
  archetype: 'tap' | 'type' | 'whose',
  card: RevealCard,
  spice: string,
): string {
  const rows = card.rows;
  const wrong = rows.filter((x) => !x.ok);
  const right = rows.filter((x) => x.ok);
  const name = card.sid === 'me' ? 'You' : card.rows[0] ? card.kicker.replace('about ', '') : '';
  const spName = card.truth.startsWith('It was ') ? card.truth.replace('It was ', '') : name;
  if (archetype === 'tap') {
    const caught = rows.filter((x) => x.isTrap).map((x) => x.name);
    if (caught.length) return `${card.selfNote} ${caught.join(' and ')} walked straight in.`;
    if (!wrong.length) return `Nobody blinked. ${spName}, your friends are actually listening.`;
    return `${card.selfNote} Nobody bit — but ${wrong.map((x) => x.name).join(' and ')} still got it wrong on their own.`;
  }
  if (archetype === 'type') {
    if (!right.length) return `Zero. ${spName} snacks in complete secrecy.`;
    return `${right.length} of you had it. ${card.selfNote}${spice === 'cozy' ? ' Generous, but fair.' : ''}`;
  }
  if (!right.length) return `Nobody guessed ${spName}. That take was well hidden.`;
  return `${right.map((x) => x.name).join(' and ')} knew instantly. ${card.selfNote}`;
}

// ── overlaps ──────────────────────────────────────────────────────────────

export function pairKey(a: PlayerId, b: PlayerId): string {
  return [a, b].sort().join('|');
}

/** Fallback pair overlap: exact matches + shared CL cluster labels across played rounds. */
export function fallbackPairOverlap(
  a: PlayerId,
  b: PlayerId,
  fields: string[], // field name per played round ('food' | 'snack' | 'take' | ...)
  answersByRound: Record<PlayerId, string>[],
): string[] {
  const out: string[] = [];
  answersByRound.forEach((ans, r) => {
    const A = ans[a];
    const B = ans[b];
    if (!A || !B) return;
    if (String(A).toLowerCase() === String(B).toLowerCase()) {
      out.push(A);
      return;
    }
    const m = CL[fields[r]];
    if (m && m[A] && m[A] === m[B]) out.push(m[A]);
  });
  return out;
}

export function unionOverlaps(pairs: PairOverlaps): string[] {
  const seen: string[] = [];
  Object.values(pairs).forEach((items) =>
    items.forEach((o) => {
      if (!seen.includes(o)) seen.push(o);
    }),
  );
  return seen;
}

// ── final-screen geometry (ported verbatim) ───────────────────────────────

export type VennGeo = {
  circles: { cx: number; cy: number; r: number; role: 'a' | 'b' | 'c' }[];
  labels: { x: number; y: number; fs: number; role: string; text: string }[];
};

export function vennGeo(players: Player[], overlap: (a: PlayerId, b: PlayerId) => string[]): VennGeo {
  const [A, B, C] = players;
  if (!B) return { circles: [], labels: [] };
  if (!C) {
    const ab = overlap(A.id, B.id);
    return {
      circles: [
        { cx: 96, cy: 115, r: 68, role: 'a' },
        { cx: 164, cy: 115, r: 68, role: 'b' },
      ],
      labels: [
        { x: 56, y: 118, fs: 17, role: 'a', text: 'you' },
        { x: 204, y: 118, fs: 17, role: 'b', text: B.name },
        { x: 130, y: 118, fs: 30, role: 'text', text: String(ab.length) },
      ],
    };
  }
  const ab = overlap(A.id, B.id);
  const ac = overlap(A.id, C.id);
  const bc = overlap(B.id, C.id);
  const tri = ab.filter((x) => ac.includes(x) && bc.includes(x));
  return {
    circles: [
      { cx: 96, cy: 92, r: 62, role: 'a' },
      { cx: 164, cy: 92, r: 62, role: 'b' },
      { cx: 130, cy: 150, r: 62, role: 'c' },
    ],
    labels: [
      { x: 56, y: 56, fs: 15, role: 'a', text: 'you' },
      { x: 206, y: 56, fs: 15, role: 'b', text: B.name },
      { x: 130, y: 206, fs: 15, role: 'c', text: C.name },
      { x: 130, y: 58, fs: 24, role: 'text', text: String(ab.length) },
      { x: 80, y: 138, fs: 24, role: 'text', text: String(ac.length) },
      { x: 180, y: 138, fs: 24, role: 'text', text: String(bc.length) },
      { x: 130, y: 112, fs: 16, role: 'bg', text: tri.length ? String(tri.length) : '·' },
    ],
  };
}

export type RingGeo = {
  nodes: { id: PlayerId; x: number; y: number; r: number; me: boolean }[];
  edges: { x1: number; y1: number; x2: number; y2: number; w: number }[];
};

export function ringGeo(players: Player[], overlap: (a: PlayerId, b: PlayerId) => string[]): RingGeo {
  const R = 84;
  const nodes = players.map((p, i) => {
    const a = -Math.PI / 2 + (i / players.length) * Math.PI * 2;
    return {
      id: p.id,
      x: +(130 + Math.cos(a) * R).toFixed(1),
      y: +(115 + Math.sin(a) * R).toFixed(1),
      r: p.id === 'me' ? 16 : 12,
      me: p.id === 'me',
    };
  });
  const edges: RingGeo['edges'] = [];
  nodes.forEach((a, i) =>
    nodes.slice(i + 1).forEach((b) => {
      const n = overlap(a.id, b.id).length;
      if (n) edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: 1 + n * 2.2 });
    }),
  );
  return { nodes, edges };
}

export type Region = { title: string; items: string[]; mine: boolean };

export function regionList(
  players: Player[],
  overlap: (a: PlayerId, b: PlayerId) => string[],
  myAnswers: string[],
): Region[] {
  const out: Region[] = [];
  players.forEach((a, i) =>
    players.slice(i + 1).forEach((b) => {
      const items = overlap(a.id, b.id);
      if (items.length) out.push({ title: `${a.id === 'me' ? 'you' : a.name} + ${b.name}`, items, mine: false });
    }),
  );
  const sharedAll = new Set(out.flatMap((o) => o.items).map((s) => s.toLowerCase()));
  const mine = myAnswers.filter((a) => a && !sharedAll.has(a.toLowerCase()));
  if (mine.length) out.push({ title: 'only you', items: mine, mine: true });
  return out;
}
