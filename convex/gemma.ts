// Server-side Gemma 4 via OpenRouter. The API key lives in Convex env
// (OPENROUTER_API_KEY) and never ships in the app bundle. Every exchange is
// logged so the in-app "Behind the model" sheet stays honest.

import { AiSeed, Judgment, NeutralCard, RoundSpec, Spice, FALLBACK_ROUNDS, FALLBACK_MIDS } from './lib';

export const MODEL = () => process.env.GEMMA_MODEL || 'google/gemma-4-31b-it';

export type LogFn = (entry: {
  task: string;
  model: string;
  system: string;
  user: string;
  output: string;
  ms: number;
  tokens: number;
  mode: string;
}) => Promise<void>;

class GemmaOffline extends Error {}

async function chat(
  log: LogFn,
  task: string,
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new GemmaOffline('no api key');
  const timeoutMs = opts.timeoutMs ?? 25000;
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://venn.college',
        'X-Title': 'Venn',
      },
      body: JSON.stringify({
        model: MODEL(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: opts.maxTokens ?? 700,
        temperature: opts.temperature ?? 0.9,
        // Gemma 4 reasons by default; a party game needs snappy answers.
        reasoning: { enabled: false },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`openrouter ${res.status}: ${body.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) throw new Error('empty completion');
    await log({
      task,
      model: json?.model || MODEL(),
      system,
      user,
      output: text,
      ms: Date.now() - started,
      tokens: json?.usage?.total_tokens ?? 0,
      mode: 'live',
    });
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function noteFallback(log: LogFn, task: string, system: string, user: string, why: string) {
  await log({
    task,
    model: 'offline fallback',
    system,
    user,
    output: `(${why} — deterministic fallback used)`,
    ms: 0,
    tokens: 0,
    mode: 'fallback',
  }).catch(() => {});
}

// ── json extraction with truncation salvage ───────────────────────────────

export function extractJSON<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error('no json in completion');
  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1)) as T;
    }
  }
  const repaired = repairTruncated(candidate.slice(start));
  if (repaired != null) return repaired as T;
  throw new Error('unbalanced json in completion');
}

function repairTruncated(s: string): unknown | null {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  let lastComplete = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      stack.pop();
      lastComplete = i + 1;
    }
  }
  if (!stack.length || lastComplete <= 0) return null;
  const cut = s.slice(0, lastComplete);
  const st2: string[] = [];
  let in2 = false;
  let e2 = false;
  for (const ch of cut) {
    if (e2) { e2 = false; continue; }
    if (ch === '\\') { e2 = true; continue; }
    if (ch === '"') { in2 = !in2; continue; }
    if (in2) continue;
    if (ch === '{' || ch === '[') st2.push(ch);
    else if (ch === '}' || ch === ']') st2.pop();
  }
  const closers = st2.reverse().map((c) => (c === '{' ? '}' : ']')).join('');
  try {
    return JSON.parse(cut + closers);
  } catch {
    return null;
  }
}

// ── voice ─────────────────────────────────────────────────────────────────

const MECHANICS: Record<string, string> = {
  tap: 'everyone answers the same question about themselves (tap a chip or type), then plants one fake answer among decoys; friends later pick from multiple choice',
  type: 'everyone answers about themselves, then friends must TYPE their guess from memory; you will judge guesses by meaning',
  whose: 'everyone submits a personal statement (a hot take / confession-lite); the statements go in anonymously and friends guess whose is whose',
};

function sys(spice: string, n: number): string {
  const tone =
    spice === 'cozy'
      ? 'warm, gentle, encouraging'
      : spice === 'unhinged'
        ? 'bold, roast-adjacent, theatrical — but never actually cruel'
        : 'playful, teasing, quick';
  return `You are Gemma 4 running "Venn", a same-room party game for ${n} college students who barely know each other. Your job is to get them talking. Voice: ${tone}. Hard rules: never mock appearance, money, grades, family, or identity; keep everything answerable in five words or less; reply with ONLY the JSON asked for, no prose around it.`;
}

// ── tasks ─────────────────────────────────────────────────────────────────

export async function writeRound(
  log: LogFn,
  r: number,
  spice: string,
  n: number,
  priorTopics: string[],
  priorAnswers: Record<string, string>[],
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
    priorTopics.length ? `Topics already used (do not repeat): ${priorTopics.join('; ')}.` : '',
    priorAnswers.length
      ? `What the room answered so far (use it — reference it in your intro): ${JSON.stringify(priorAnswers)}`
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
    const out = await chat(log, `round${r + 1}`, system, user, { maxTokens: 600, temperature: 1.0, timeoutMs: 35000 });
    const j = extractJSON<any>(out);
    const chips = Array.isArray(j.chips) ? j.chips.map(String).filter(Boolean).slice(0, 8) : [];
    if (!j.question || chips.length < 4) throw new Error('round json incomplete');
    return {
      archetype: shell.archetype,
      topic: String(j.topic || shell.topic),
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
    await noteFallback(log, `round${r + 1}`, system, user, e?.message || 'error');
    return { ...shell };
  }
}

export async function draftLies(
  log: LogFn,
  round: RoundSpec,
  answer: string,
  spice: string,
  n: number,
): Promise<string[]> {
  const system = sys(spice, n);
  const user = `The question was "${round.q}". A player sealed the true answer "${answer}". Draft 3 fake answers to sit beside it in a multiple-choice list. They must be the SAME KIND of thing as the truth (same cuisine family, same region if it is a place, same genre) so friends genuinely hesitate — near misses, not random. <=5 words each, all different from the truth and from each other. Reply with only JSON: {"lies":["...","...","..."]}`;
  try {
    const out = await chat(log, 'lies', system, user, { maxTokens: 160, temperature: 1.0 });
    const j = extractJSON<{ lies: string[] }>(out);
    const lies = (j.lies || []).map(String).filter((x) => x && x.toLowerCase() !== answer.toLowerCase());
    if (lies.length < 3) throw new Error('need 3 lies');
    return lies.slice(0, 3);
  } catch (e: any) {
    await noteFallback(log, 'lies', system, user, e?.message || 'error');
    const pool = round.chips.filter((c) => c.toLowerCase() !== answer.toLowerCase());
    return [pool[2 % pool.length], pool[4 % pool.length], pool[6 % pool.length]].filter(
      (vv, i, arr) => vv && arr.indexOf(vv) === i,
    );
  }
}

export type AiMove = { key: string; answer: string; decoys: string[]; planted: string | null };

export async function aiMoves(
  log: LogFn,
  round: RoundSpec,
  r: number,
  seeds: AiSeed[],
  spice: string,
  n: number,
): Promise<Record<string, AiMove>> {
  const system = sys(spice, n);
  const personas = seeds.map((b) => ({ id: b.key, name: b.name, from: b.from, hobby: b.hobby, vibe: b.vibe }));
  const user = `Question to the room: "${round.q}" (topic: ${round.topic}). Answer it in character for each person below — short (<=5 words), specific, true to the persona. Also give 2 near-miss decoys per person (same kind of thing as their answer) and 1 planted lie they would choose to trick friends with. Personas: ${JSON.stringify(personas)}. Reply with only JSON: {"moves":[{"id":"...","answer":"...","decoys":["...","..."],"planted":"..."}]}`;
  const fallback = (): Record<string, AiMove> => {
    const map: Record<string, AiMove> = {};
    seeds.forEach((b, i) => {
      const persona = [b.food, b.snack, b.take][r] || b.snack;
      const answer = round.live ? round.chips[(i * 3 + r) % round.chips.length] : persona;
      const pool = round.chips.filter((c) => c.toLowerCase() !== answer.toLowerCase());
      map[b.key] = {
        key: b.key,
        answer,
        decoys: [pool[(i * 2) % pool.length], pool[(i * 2 + 3) % pool.length]].filter(Boolean),
        planted: pool[(i * 2 + 5) % pool.length] || null,
      };
    });
    return map;
  };
  try {
    const out = await chat(log, 'aiMoves', system, user, {
      maxTokens: Math.min(1600, 200 + 90 * seeds.length),
      temperature: 1.0,
    });
    const j = extractJSON<{ moves: { id: string; answer: string; decoys: string[]; planted: string }[] }>(out);
    const map: Record<string, AiMove> = {};
    for (const m of j.moves || []) {
      if (!m.id || !m.answer) continue;
      const answer = String(m.answer);
      const seen = [answer.toLowerCase()];
      const clean = (x: unknown) => {
        const vv = String(x || '').trim();
        if (!vv || seen.includes(vv.toLowerCase())) return null;
        seen.push(vv.toLowerCase());
        return vv;
      };
      const decoys = (m.decoys || []).map(clean).filter((x): x is string => !!x).slice(0, 2);
      map[m.id] = { key: m.id, answer, decoys, planted: clean(m.planted) };
    }
    if (seeds.some((b) => !map[b.key])) throw new Error('missing ai move');
    return map;
  } catch (e: any) {
    await noteFallback(log, 'aiMoves', system, user, e?.message || 'error');
    return fallback();
  }
}

export async function judgeBatch(
  log: LogFn,
  question: string,
  pairs: { truth: string; guess: string | null }[],
  spice: string,
  n: number,
): Promise<Judgment[]> {
  const { fallbackJudge } = await import('./lib');
  const out: Judgment[] = pairs.map((p) => fallbackJudge(p.guess, p.truth));
  const real = pairs.map((p, orig) => ({ ...p, orig })).filter((p) => p.guess);
  if (!real.length) return out;
  const system = `You are Gemma 4 judging a guessing game between college friends. Judge each guess against the truth by MEANING, not spelling — "instant noodles" ≈ "ramen at 2am" is a hit; same category but different thing is half credit; unrelated is a miss. Be generous with brands and phrasing. Reply with only JSON.`;
  const user = `Question was "${question}". Pairs: ${JSON.stringify(real.map((p, j) => ({ i: j, truth: p.truth, guess: p.guess })))}. Reply with one result per pair, echoing its i exactly: {"results":[{"i":0,"score":0.0,"verdict":"hit|near|half|miss","note":"<=10 words, spoken to the room"}]}`;
  try {
    const raw = await chat(log, 'judge', system, user, {
      maxTokens: Math.min(2000, 120 + 45 * real.length),
      temperature: 0.2,
    });
    const j = extractJSON<{ results: { i: number; score: number; verdict: string; note: string }[] }>(raw);
    for (const res of j.results || []) {
      const idx = Number(res.i);
      if (!Number.isInteger(idx) || idx < 0 || idx >= real.length) continue;
      const score = Math.max(0, Math.min(1, Number(res.score) || 0));
      const vv = String(res.verdict || '');
      const ok = vv === 'hit' || vv === 'near' || score >= 0.75;
      const half = !ok && (vv === 'half' || score >= 0.5);
      out[real[idx].orig] = { score, ok, half, note: String(res.note || '') };
    }
    return out;
  } catch (e: any) {
    await noteFallback(log, 'judge', system, user, e?.message || 'error');
    return out;
  }
}

export async function revealLines(
  log: LogFn,
  cards: NeutralCard[],
  spice: string,
  n: number,
  roundNo: number,
  aboutTemplate: string,
): Promise<{ lines: string[]; mid: string }> {
  const system = sys(spice, n);
  const compact = cards.map((c) => ({
    i: c.i,
    about: c.name,
    question: aboutTemplate.replace('{name}', c.name),
    truth: c.truth,
    self: c.selfNote,
    guesses: c.rows.map((row) => ({ who: row.name, said: row.value, result: row.tag })),
  }));
  const user = `Round ${roundNo + 1} of 3 just revealed. For each card, write ONE line (<=22 words) calling the result — name names, land the joke, stay kind underneath. Then one room-level observation (<=20 words) about what this round revealed about the group. Cards: ${JSON.stringify(compact)}. Reply with only JSON: {"lines":[{"i":0,"line":"..."}],"mid":"..."}`;
  const fallbackMid = FALLBACK_MIDS[roundNo] || '';
  try {
    const raw = await chat(log, 'reveal', system, user, {
      maxTokens: Math.min(1400, 200 + 60 * cards.length),
      temperature: 0.95,
    });
    const j = extractJSON<{ lines: { i: number; line: string }[]; mid?: string }>(raw);
    const out = cards.map(() => '');
    for (const l of j.lines || []) {
      if (typeof l.i === 'number' && l.line && l.i >= 0 && l.i < out.length) out[l.i] = String(l.line);
    }
    return { lines: out, mid: String(j.mid || fallbackMid) };
  } catch (e: any) {
    await noteFallback(log, 'reveal', system, user, e?.message || 'error');
    return { lines: cards.map(() => ''), mid: fallbackMid };
  }
}

export async function clusterPairs(
  log: LogFn,
  players: { id: string; name: string }[],
  rounds: { q: string }[],
  answersByRound: Record<string, string>[],
  spice: string,
  fallback: Record<string, string[]>,
): Promise<Record<string, string[]>> {
  const { pairKey } = await import('./lib');
  const system = `You find what two people genuinely share, from their answers in a party game. A shared thing can be an exact match or a real category both fit ("both noodle people", "both from the desert"). Short human labels, <=4 words, lowercase. No stretches — an empty list is fine. Reply with only JSON.`;
  const byName = answersByRound.map((ans, i) => {
    const o: Record<string, string> = {};
    players.forEach((p) => {
      if (ans[p.id]) o[p.name] = ans[p.id];
    });
    return { question: rounds[i]?.q, answers: o };
  });
  const pairsWanted: { a: string; b: string }[] = [];
  players.forEach((a, i) => players.slice(i + 1).forEach((b) => pairsWanted.push({ a: a.name, b: b.name })));
  const user = `Rounds so far: ${JSON.stringify(byName)}. For each pair, list what they share (possibly nothing): ${JSON.stringify(pairsWanted)}. Reply: {"pairs":[{"a":"Name","b":"Name","shared":["label"]}]}`;
  try {
    const raw = await chat(log, 'cluster', system, user, {
      maxTokens: Math.min(2000, 150 + 45 * pairsWanted.length),
      temperature: 0.4,
    });
    const j = extractJSON<{ pairs: { a: string; b: string; shared: string[] }[] }>(raw);
    const out = { ...fallback };
    for (const p of j.pairs || []) {
      const A = players.find((x) => x.name === p.a);
      const B = players.find((x) => x.name === p.b);
      if (!A || !B) continue;
      out[pairKey(A.id, B.id)] = (p.shared || []).map(String).filter(Boolean).slice(0, 4);
    }
    return out;
  } catch (e: any) {
    await noteFallback(log, 'cluster', system, user, e?.message || 'error');
    return fallback;
  }
}

export async function shareCard(
  log: LogFn,
  meName: string,
  best: { name: string; items: string[] } | null,
  allOverlaps: string[],
  spice: string,
  n: number,
): Promise<{ note: string; plan: { when: string; title: string; why: string } }> {
  const system = sys(spice, n);
  const user = best
    ? `Write ${meName}'s private end-of-game card. Their strongest overlap is with ${best.name}: ${JSON.stringify(best.items)}. Room-wide overlaps: ${JSON.stringify(allOverlaps.slice(0, 6))}. The card: {"note":"<=55 words, second person, specific, warm, a little funny — tell them something true about tonight they did not notice","plan":{"when":"a time tonight like 8:30 pm","title":"<=6 words, concrete tiny plan with ${best.name}","why":"<=25 words, why it will not be awkward"}}`
    : `Write ${meName}'s private end-of-game card. They had no big overlap with anyone — frame being the outlier as a position, not a problem, and point them at one specific person to ask about something. {"note":"<=55 words","plan":{"when":"a time tonight","title":"<=6 words","why":"<=25 words"}}`;
  try {
    const raw = await chat(log, 'share', system, user, { maxTokens: 300, temperature: 0.95 });
    const j = extractJSON<{ note: string; plan: { when: string; title: string; why: string } }>(raw);
    if (!j.note || !j.plan?.title) throw new Error('incomplete share');
    return {
      note: String(j.note),
      plan: { when: String(j.plan.when || '8:30 pm'), title: String(j.plan.title), why: String(j.plan.why || '') },
    };
  } catch (e: any) {
    await noteFallback(log, 'share', system, user, e?.message || 'error');
    if (best) {
      const it = best.items;
      return {
        note: `You and ${best.name} are the same person after midnight — ${it[0] || 'same taste'}${it[1] ? ' and ' + it[1] : ''}. Neither of you said it out loud once tonight, which is exactly why I am telling you now.`,
        plan: {
          when: '8:30 pm',
          title: `Dining hall run with ${best.name}`,
          why: 'You picked the same thing tonight without knowing. Ten minutes, no commitment.',
        },
      };
    }
    return {
      note: 'You are the outlier in this room, and that is a position, not a problem. Ask someone about their answer and watch what happens.',
      plan: { when: '8:30 pm', title: 'Common room hang', why: 'Ten minutes, no commitment, and you already have a question to ask.' },
    };
  }
}

export async function homeNotice(
  log: LogFn,
  meName: string,
  played: number,
  metNames: string[],
  overlaps: string[],
): Promise<string> {
  const system = sys('chaotic', 2);
  const user = `Write the one-line nudge on ${meName}'s home screen (<=30 words, second person, concrete). Games played: ${played}. People they have met through games: ${JSON.stringify(metNames.slice(0, 8))}. Known overlaps: ${JSON.stringify(overlaps.slice(0, 5))}. Nudge them to start or join a room tonight. Reply: {"line":"..."}`;
  try {
    const raw = await chat(log, 'notice', system, user, { maxTokens: 120, temperature: 0.9 });
    return String(extractJSON<{ line: string }>(raw).line || '');
  } catch (e: any) {
    await noteFallback(log, 'notice', system, user, e?.message || 'error');
    return played
      ? `${metNames.length} people know your 2am order now. The rest of the floor doesn't — four questions fixes that.`
      : 'Nobody on this floor knows a single thing about you yet. Four questions is usually enough to find out why that is a shame.';
  }
}

export async function nodeOpener(
  log: LogFn,
  name: string,
  items: string[],
): Promise<string> {
  const system = sys('chaotic', 2);
  const user = `One sentence (<=22 words) telling the user the safest conversation opener with ${name}. They share: ${JSON.stringify(items)}. ${items.length ? '' : 'No overlaps found — suggest asking what they answered tonight.'} Reply: {"line":"..."}`;
  try {
    const raw = await chat(log, 'opener', system, user, { maxTokens: 100, temperature: 0.9 });
    return String(extractJSON<{ line: string }>(raw).line || '');
  } catch (e: any) {
    await noteFallback(log, 'opener', system, user, e?.message || 'error');
    return items.length
      ? `Safest opener: ask about ${items[0]}. You will not have to fake interest.`
      : 'You share nothing on paper yet, which is its own kind of interesting. Ask what they answered tonight.';
  }
}
