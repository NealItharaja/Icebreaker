// Everything Gemma 4 does in Venn, in one place:
//   1. writes each round's question live (nothing pre-baked)
//   2. drafts lies relevant to a sealed answer (the "confuse them" mechanic)
//   3. answers in character for the simulated friends
//   4. judges typed guesses by meaning, not spelling
//   5. calls each reveal in the host's chosen spice
//   6. clusters answers into overlap regions
//   7. writes each player a private card + one concrete plan
//   8. writes the home notice and map openers
// Every function degrades to a deterministic fallback so the app works
// with no key and no network — and records which mode it used.

import { Bot, FALLBACK_ROUNDS, Spice } from '../game/data';
import { fallbackJudge, fallbackPairOverlap, pairKey } from '../game/engine';
import { BotMove, Judgment, PairOverlaps, Player, PlayerId, RevealCard, RoundSpec } from '../game/types';
import { chat, extractJSON, getKey, record, MODEL } from './client';

const MECHANICS: Record<string, string> = {
  tap: 'everyone answers the same question about themselves (tap a chip or type), then plants one fake answer among decoys; friends later pick from multiple choice',
  type: 'everyone answers about themselves, then friends must TYPE their guess from memory; you will judge guesses by meaning',
  whose: 'everyone submits a personal statement (a hot take / confession-lite); the statements go in anonymously and friends guess whose is whose',
};

function sys(spice: Spice, n: number): string {
  const tone =
    spice === 'cozy'
      ? 'warm, gentle, encouraging'
      : spice === 'unhinged'
        ? 'bold, roast-adjacent, theatrical — but never actually cruel'
        : 'playful, teasing, quick';
  return `You are Gemma 4 running "Venn", a same-room party game for ${n} college students who barely know each other. Your job is to get them talking. Voice: ${tone}. Hard rules: never mock appearance, money, grades, family, or identity; keep everything answerable in five words or less; reply with ONLY the JSON asked for, no prose around it.`;
}

function noteFallback(task: string, system: string, user: string, why: string) {
  record({ task, model: 'offline fallback', system, user, output: `(${why} — deterministic fallback used)`, ms: 0, tokens: 0, mode: 'fallback', at: Date.now() });
}

export async function gemmaMode(): Promise<'live' | 'offline'> {
  return (await getKey()) ? 'live' : 'offline';
}

// ── 1. write a round ──────────────────────────────────────────────────────

export type RoundContext = {
  priorTopics: string[];
  /** name -> answer for each prior round, in order */
  priorAnswers: Record<string, string>[];
};

export async function writeRound(
  r: number,
  spice: Spice,
  n: number,
  ctx: RoundContext,
): Promise<RoundSpec> {
  const shell = FALLBACK_ROUNDS[r];
  const system = sys(spice, n);
  const user = [
    `Write round ${r + 1} of 3. Mechanic: ${MECHANICS[shell.archetype]}.`,
    r === 0
      ? 'Pick ONE fresh get-to-know-you topic a stranger could answer instantly: examples — comfort food order, hometown, most-used app, first thing unpacked, karaoke song. Not all food.'
      : r === 1
        ? 'Pick a topic with texture, answerable in a few typed words (a 2am habit, a guilty pleasure, a weekend ritual).'
        : 'The answer should be an opinionated personal TAKE they would half-regret saying out loud.',
    ctx.priorTopics.length ? `Topics already used (do not repeat): ${ctx.priorTopics.join('; ')}.` : '',
    ctx.priorAnswers.length
      ? `What the room answered so far (use it — reference it in your intro): ${JSON.stringify(ctx.priorAnswers)}`
      : 'Nobody has said anything yet.',
    `Reply with only JSON: {"topic":"2-4 words","intro":"<=20 words, you speaking to the room as the round opens","question":"<=14 words, second person, about themselves","hint":"<=12 words","chips":["8 short distinct plausible answers"],"self_question":"<=10 words — ${
      shell.archetype === 'tap'
        ? 'ask them to plant a lie in their own options'
        : shell.archetype === 'type'
          ? 'ask how many friends will guess theirs right'
          : 'ask who the room will blame for theirs'
    }","self_hint":"<=12 words","about_me":"the question re-asked to the answerer in past tense","about_template":"the question asked about {name} to their friends, containing {name}","about_hint":"<=12 words for the guesser"}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const out = await chat(`round${r + 1}`, system, user, { maxTokens: 600, temperature: 1.0, timeoutMs: 35000 });
    const j = extractJSON<any>(out);
    const chips = Array.isArray(j.chips) ? j.chips.map(String).filter(Boolean).slice(0, 8) : [];
    if (!j.question || chips.length < 4) throw new Error('round json incomplete');
    return {
      archetype: shell.archetype,
      topic: String(j.topic || shell.field),
      intro: String(j.intro || shell.intro),
      q: String(j.question),
      hint: String(j.hint || shell.hint),
      chips,
      selfQ: String(j.self_question || shell.selfQ),
      selfHint: String(j.self_hint || shell.selfHint),
      aboutMe: String(j.about_me || j.question),
      aboutTemplate: String(j.about_template || '{name} — ' + j.question),
      aboutHint: String(j.about_hint || shell.aboutHint),
      live: true,
    };
  } catch (e: any) {
    noteFallback(`round${r + 1}`, system, user, e?.message || 'error');
    return {
      archetype: shell.archetype,
      topic: shell.field,
      intro: shell.intro,
      q: shell.q,
      hint: shell.hint,
      chips: shell.chips,
      selfQ: shell.selfQ,
      selfHint: shell.selfHint,
      aboutMe: shell.aboutMe,
      aboutTemplate: shell.about('{name}'),
      aboutHint: shell.aboutHint,
      live: false,
    };
  }
}

// ── 2. draft lies around a sealed answer ─────────────────────────────────

export async function draftLies(round: RoundSpec, answer: string, spice: Spice, n: number): Promise<string[]> {
  const system = sys(spice, n);
  const user = `The question was "${round.q}". A player sealed the true answer "${answer}". Draft 3 fake answers to sit beside it in a multiple-choice list. They must be the SAME KIND of thing as the truth (same cuisine family, same region if it is a place, same genre) so friends genuinely hesitate — near misses, not random. <=5 words each, all different from the truth and from each other. Reply with only JSON: {"lies":["...","...","..."]}`;
  try {
    const out = await chat('lies', system, user, { maxTokens: 160, temperature: 1.0 });
    const j = extractJSON<{ lies: string[] }>(out);
    const lies = (j.lies || []).map(String).filter((x) => x && x.toLowerCase() !== answer.toLowerCase());
    if (lies.length < 3) throw new Error('need 3 lies');
    return lies.slice(0, 3);
  } catch (e: any) {
    noteFallback('lies', system, user, e?.message || 'error');
    const pool = round.chips.filter((c) => c.toLowerCase() !== answer.toLowerCase());
    return [pool[2 % pool.length], pool[4 % pool.length], pool[6 % pool.length]].filter(
      (v, i, arr) => v && arr.indexOf(v) === i,
    );
  }
}

// ── 3. bots answer in character ──────────────────────────────────────────

export async function botMoves(
  round: RoundSpec,
  r: number,
  bots: Bot[],
  spice: Spice,
  n: number,
): Promise<Record<string, BotMove>> {
  const system = sys(spice, n);
  const personas = bots.map((b) => ({ id: b.id, name: b.name, from: b.from, hobby: b.hobby, vibe: b.vibe }));
  const user = `Question to the room: "${round.q}" (topic: ${round.topic}). Answer it in character for each person below — short (<=5 words), specific, true to the persona. Also give 2 near-miss decoys per person (same kind of thing as their answer) and 1 planted lie they would choose to trick friends with. Personas: ${JSON.stringify(personas)}. Reply with only JSON: {"moves":[{"id":"...","answer":"...","decoys":["...","..."],"planted":"..."}]}`;
  try {
    const out = await chat('botMoves', system, user, { maxTokens: Math.min(1600, 200 + 90 * bots.length), temperature: 1.0 });
    const j = extractJSON<{ moves: { id: string; answer: string; decoys: string[]; planted: string }[] }>(out);
    const map: Record<string, BotMove> = {};
    for (const m of j.moves || []) {
      if (!m.id || !m.answer) continue;
      const answer = String(m.answer);
      const seen = [answer.toLowerCase()];
      const clean = (x: unknown) => {
        const v = String(x || '').trim();
        if (!v || seen.includes(v.toLowerCase())) return null;
        seen.push(v.toLowerCase());
        return v;
      };
      // a lie identical to the truth would double-score and duplicate options
      const decoys = (m.decoys || []).map(clean).filter((x): x is string => !!x).slice(0, 2);
      map[m.id] = { answer, decoys, planted: clean(m.planted) };
    }
    if (bots.some((b) => !map[b.id])) throw new Error('missing bot move');
    return map;
  } catch (e: any) {
    noteFallback('botMoves', system, user, e?.message || 'error');
    const field = ['food', 'snack', 'take'][r] as 'food' | 'snack' | 'take';
    const map: Record<string, BotMove> = {};
    bots.forEach((b, i) => {
      // canned rounds use the persona field; live rounds fall back to chips by hash
      const answer = round.live ? round.chips[(i * 3 + r) % round.chips.length] : b[field];
      const pool = round.chips.filter((c) => c.toLowerCase() !== answer.toLowerCase());
      map[b.id] = {
        answer,
        decoys: [pool[(i * 2) % pool.length], pool[(i * 2 + 3) % pool.length]].filter(Boolean),
        planted: pool[(i * 2 + 5) % pool.length] || null,
      };
    });
    return map;
  }
}

// ── 4. judge typed guesses by meaning ────────────────────────────────────

export type JudgePair = { i: number; truth: string; guess: string | null };

export async function judgeBatch(question: string, pairs: JudgePair[], spice: Spice, n: number): Promise<Judgment[]> {
  const out: Judgment[] = pairs.map((p) => fallbackJudge(p.guess, p.truth));
  // only pairs with an actual guess go to the model, re-indexed densely so
  // the echoed ids can't collide with the no-answer pairs we kept local
  const real = pairs.map((p, orig) => ({ ...p, orig })).filter((p) => p.guess);
  if (!real.length) return out;
  const system = `You are Gemma 4 judging a guessing game between college friends. Judge each guess against the truth by MEANING, not spelling — "instant noodles" ≈ "ramen at 2am" is a hit; same category but different thing is half credit; unrelated is a miss. Be generous with brands and phrasing. Reply with only JSON.`;
  const user = `Question was "${question}". Pairs: ${JSON.stringify(real.map((p, j) => ({ i: j, truth: p.truth, guess: p.guess })))}. Reply with one result per pair, echoing its i exactly: {"results":[{"i":0,"score":0.0,"verdict":"hit|near|half|miss","note":"<=10 words, spoken to the room"}]}`;
  try {
    const raw = await chat('judge', system, user, {
      maxTokens: Math.min(2000, 120 + 45 * real.length),
      temperature: 0.2,
    });
    const j = extractJSON<{ results: { i: number; score: number; verdict: string; note: string }[] }>(raw);
    for (const res of j.results || []) {
      const idx = Number(res.i);
      if (!Number.isInteger(idx) || idx < 0 || idx >= real.length) continue;
      const score = Math.max(0, Math.min(1, Number(res.score) || 0));
      const v = String(res.verdict || '');
      const ok = v === 'hit' || v === 'near' || score >= 0.75;
      const half = !ok && (v === 'half' || score >= 0.5);
      out[real[idx].orig] = { score, ok, half, note: String(res.note || '') };
    }
    return out;
  } catch (e: any) {
    noteFallback('judge', system, user, e?.message || 'error');
    return out;
  }
}

// ── 5. call the reveal ───────────────────────────────────────────────────

export async function revealLines(
  cards: RevealCard[],
  archetype: 'tap' | 'type' | 'whose',
  spice: Spice,
  n: number,
  roundNo: number,
): Promise<{ lines: string[]; mid: string }> {
  const system = sys(spice, n);
  const compact = cards.map((c) => ({
    i: c.i,
    about: c.kicker,
    question: c.q,
    truth: c.truth,
    self: c.selfNote,
    guesses: c.rows.map((row) => ({ who: row.name, said: row.value, result: row.tag })),
  }));
  const user = `Round ${roundNo + 1} of 3 just revealed. For each card, write ONE line (<=22 words) calling the result — name names, land the joke, stay kind underneath. Then one room-level observation (<=20 words) about what this round revealed about the group — something they share, or a pattern worth noticing. Cards: ${JSON.stringify(compact)}. Reply with only JSON: {"lines":[{"i":0,"line":"..."}],"mid":"..."}`;
  const fallbackMid = [
    'Two of you ordered the same thing and have never spoken. Noted.',
    'Half this room eats the same thing at 2am and thinks it is a private habit.',
    'Last round. The takes are where friendships get tested.',
  ][roundNo] || '';
  try {
    const raw = await chat('reveal', system, user, {
      maxTokens: Math.min(1400, 200 + 60 * cards.length),
      temperature: 0.95,
    });
    const j = extractJSON<{ lines: { i: number; line: string }[]; mid?: string }>(raw);
    const out = cards.map(() => '');
    for (const l of j.lines || []) {
      if (typeof l.i === 'number' && l.line && l.i >= 0 && l.i < out.length) out[l.i] = String(l.line);
    }
    // partial is fine — the caller backfills any empty line per card
    return { lines: out, mid: String(j.mid || fallbackMid) };
  } catch (e: any) {
    noteFallback('reveal', system, user, e?.message || 'error');
    return { lines: cards.map(() => ''), mid: fallbackMid };
  }
}

// ── 6. cluster overlaps ──────────────────────────────────────────────────

export async function clusterOverlaps(
  players: Player[],
  rounds: { topic: string; q: string; live: boolean }[],
  answersByRound: Record<PlayerId, string>[],
  spice: Spice,
): Promise<PairOverlaps> {
  const fallback: PairOverlaps = {};
  const fields = rounds.map((r, i) => (r.live ? `live${i}` : ['food', 'snack', 'take'][i]));
  players.forEach((a, i) =>
    players.slice(i + 1).forEach((b) => {
      fallback[pairKey(a.id, b.id)] = fallbackPairOverlap(a.id, b.id, fields, answersByRound);
    }),
  );
  const system = `You find what two people genuinely share, from their answers in a party game. A shared thing can be an exact match or a real category both fit ("both noodle people", "both from the desert"). Short human labels, <=4 words, lowercase. No stretches — an empty list is fine. Reply with only JSON.`;
  const byName = answersByRound.map((ans, i) => {
    const o: Record<string, string> = {};
    players.forEach((p) => {
      if (ans[p.id]) o[p.name] = ans[p.id];
    });
    return { question: rounds[i]?.q, answers: o };
  });
  const pairsWanted = [] as { a: string; b: string }[];
  players.forEach((a, i) => players.slice(i + 1).forEach((b) => pairsWanted.push({ a: a.name, b: b.name })));
  const user = `Rounds so far: ${JSON.stringify(byName)}. For each pair, list what they share (possibly nothing): ${JSON.stringify(pairsWanted)}. Reply: {"pairs":[{"a":"Name","b":"Name","shared":["label"]}]}`;
  try {
    const raw = await chat('cluster', system, user, {
      maxTokens: Math.min(2000, 150 + 45 * pairsWanted.length),
      temperature: 0.4,
    });
    const j = extractJSON<{ pairs: { a: string; b: string; shared: string[] }[] }>(raw);
    const out: PairOverlaps = { ...fallback };
    for (const p of j.pairs || []) {
      const A = players.find((x) => x.name === p.a);
      const B = players.find((x) => x.name === p.b);
      if (!A || !B) continue;
      out[pairKey(A.id, B.id)] = (p.shared || []).map(String).filter(Boolean).slice(0, 4);
    }
    return out;
  } catch (e: any) {
    noteFallback('cluster', system, user, e?.message || 'error');
    return fallback;
  }
}

// ── 7. the private card + plan ───────────────────────────────────────────

export type ShareResult = {
  note: string;
  plan: { when: string; title: string; why: string };
};

export async function shareCard(
  meName: string,
  best: { name: string; items: string[] } | null,
  allOverlaps: string[],
  spice: Spice,
  n: number,
): Promise<ShareResult> {
  const system = sys(spice, n);
  const user = best
    ? `Write ${meName}'s private end-of-game card. Their strongest overlap is with ${best.name}: ${JSON.stringify(best.items)}. Room-wide overlaps: ${JSON.stringify(allOverlaps.slice(0, 6))}. The card: {"note":"<=55 words, second person, specific, warm, a little funny — tell them something true about tonight they did not notice","plan":{"when":"a time tonight like 8:30 pm","title":"<=6 words, concrete tiny plan with ${best.name}","why":"<=25 words, why it will not be awkward"}}`
    : `Write ${meName}'s private end-of-game card. They had no big overlap with anyone — frame being the outlier as a position, not a problem, and point them at one specific person to ask about something. {"note":"<=55 words","plan":{"when":"a time tonight","title":"<=6 words","why":"<=25 words"}}`;
  try {
    const raw = await chat('share', system, user, { maxTokens: 300, temperature: 0.95 });
    const j = extractJSON<ShareResult>(raw);
    if (!j.note || !j.plan?.title) throw new Error('incomplete share');
    return { note: String(j.note), plan: { when: String(j.plan.when || '8:30 pm'), title: String(j.plan.title), why: String(j.plan.why || '') } };
  } catch (e: any) {
    noteFallback('share', system, user, e?.message || 'error');
    if (best) {
      const it = best.items;
      return {
        note: `You and ${best.name} are the same person after midnight — ${it[0] || 'same taste'}${it[1] ? ' and ' + it[1] : ''}. Neither of you said it out loud once tonight, which is exactly why I am telling you now.`,
        plan: { when: '8:30 pm', title: `Dining hall run with ${best.name}`, why: 'You picked the same thing tonight without knowing. Ten minutes, no commitment, and you already have something to say.' },
      };
    }
    return {
      note: 'You are the outlier in this room, and that is a position, not a problem. Ask Maya about Tucson and watch what happens.',
      plan: { when: '8:30 pm', title: 'Coffee with Maya', why: 'Ten minutes, no commitment, and you already have a question to ask.' },
    };
  }
}

// ── 8. ambient lines (home + map) ────────────────────────────────────────

export async function homeNotice(
  meName: string,
  played: number,
  unmetNames: string[],
  overlaps: string[],
  spice: Spice,
): Promise<string> {
  const system = sys(spice, 2);
  const user = `Write the one-line nudge on ${meName}'s home screen (<=30 words, second person, concrete). Games played: ${played}. People on the floor never played with: ${JSON.stringify(unmetNames)}. Known overlaps: ${JSON.stringify(overlaps.slice(0, 5))}. Reply: {"line":"..."}`;
  try {
    const raw = await chat('notice', system, user, { maxTokens: 120, temperature: 0.9 });
    return String(extractJSON<{ line: string }>(raw).line || '');
  } catch (e: any) {
    noteFallback('notice', system, user, e?.message || 'error');
    return played
      ? `${unmetNames.length} people on this floor you still have not been in a game with. Two of them answered the way you did tonight.`
      : `${unmetNames.length} people on this floor you have never been in a game with. Four questions is usually enough to find out why that is a shame.`;
  }
}

export async function nodeOpener(
  name: string,
  met: boolean,
  items: string[],
  hobby: string,
  spice: Spice,
): Promise<string> {
  const system = sys(spice, 2);
  const user = met
    ? `One sentence (<=22 words) telling the user the safest conversation opener with ${name}. They share: ${JSON.stringify(items)}. ${items.length ? '' : `No overlaps found — suggest asking about ${hobby}.`} Reply: {"line":"..."}`
    : `One sentence (<=20 words): the user has never played with ${name}; nudge them to put ${name} in the next game. Reply: {"line":"..."}`;
  try {
    const raw = await chat('opener', system, user, { maxTokens: 100, temperature: 0.9 });
    return String(extractJSON<{ line: string }>(raw).line || '');
  } catch (e: any) {
    noteFallback('opener', system, user, e?.message || 'error');
    if (!met) return 'Never played together, so I have nothing on them yet. That is what a game is for.';
    return items.length
      ? `Safest opener: ask about ${items[0]}. You will not have to fake interest.`
      : `You share nothing on paper, which is its own kind of interesting. Ask about ${hobby}.`;
  }
}

export { MODEL };
