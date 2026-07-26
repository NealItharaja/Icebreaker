// Thin OpenRouter client for Gemma 4 + a telemetry log.
// Every real exchange is recorded so "Behind the model" can show the truth:
// the actual prompt, the actual output, real latency and token counts.

import { loadApiKey } from '../store/persist';

export const MODEL = process.env.EXPO_PUBLIC_GEMMA_MODEL || 'google/gemma-4-31b-it';

export type GemmaLogEntry = {
  task: string;
  model: string;
  system: string;
  user: string;
  output: string;
  ms: number;
  tokens: number;
  mode: 'live' | 'fallback';
  at: number;
};

const log: GemmaLogEntry[] = [];
let runtimeKey: string | null | undefined;

export async function getKey(): Promise<string | null> {
  const env = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
  if (env) return env;
  if (runtimeKey === undefined) runtimeKey = await loadApiKey();
  return runtimeKey || null;
}

export function setRuntimeKey(k: string | null) {
  runtimeKey = k;
}

export function gemmaLog(): GemmaLogEntry[] {
  return log;
}

export function lastExchange(task?: string): GemmaLogEntry | null {
  if (task) {
    for (let i = log.length - 1; i >= 0; i--) if (log[i].task === task) return log[i];
  }
  return log[log.length - 1] || null;
}

export function p50Latency(): number | null {
  const live = log.filter((l) => l.mode === 'live').map((l) => l.ms).sort((a, b) => a - b);
  if (!live.length) return null;
  return live[Math.floor(live.length / 2)];
}

export function record(entry: GemmaLogEntry) {
  log.push(entry);
  if (log.length > 60) log.shift();
}

export class GemmaOffline extends Error {}

/**
 * One chat completion. Throws GemmaOffline when there is no key,
 * and plain Error on network/HTTP/timeout problems — callers fall back.
 */
export async function chat(
  task: string,
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const key = await getKey();
  if (!key) throw new GemmaOffline('no api key');

  const started = Date.now();
  // OpenRouter latency for Gemma 4 is spiky (seconds, sometimes tens of
  // seconds) — every call site has honest waiting UX, so be patient.
  const timeoutMs = opts.timeoutMs ?? 25000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  // AbortController isn't always honored by RN fetch — a hard race guarantees
  // the game never waits on a stalled socket.
  let hardTimer: ReturnType<typeof setTimeout> | null = null;
  const hardTimeout = new Promise<never>((_, reject) => {
    hardTimer = setTimeout(() => reject(new Error(`gemma timeout after ${timeoutMs + 2000}ms`)), timeoutMs + 2000);
  });
  try {
    const res = await Promise.race([hardTimeout, fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://venn.college',
        'X-Title': 'Venn',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: opts.maxTokens ?? 700,
        temperature: opts.temperature ?? 0.9,
        // Gemma 4 reasons by default; a party game needs snappy answers,
        // and unbounded reasoning would eat the whole token budget.
        reasoning: { enabled: false },
      }),
    })]);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`openrouter ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await Promise.race([hardTimeout, res.json()]);
    const text: string = json?.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) throw new Error('empty completion');
    record({
      task,
      model: json?.model || MODEL,
      system,
      user,
      output: text,
      ms: Date.now() - started,
      tokens: json?.usage?.total_tokens ?? 0,
      mode: 'live',
    at: Date.now(),
    });
    return text;
  } finally {
    clearTimeout(timer);
    if (hardTimer) clearTimeout(hardTimer);
  }
}

/** Pull the first JSON object/array out of a completion (Gemma loves ```json fences). */
export function extractJSON<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error('no json in completion');
  // walk to the matching close bracket
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
  // truncated output (hit max_tokens): salvage the complete entries
  const repaired = repairTruncated(candidate.slice(start));
  if (repaired != null) return repaired as T;
  throw new Error('unbalanced json in completion');
}

/**
 * Best-effort repair of JSON cut off mid-stream: rewind to the last position
 * where a value was complete, drop any dangling fragment, close open brackets.
 * Returns the parsed value, or null when no safe repair exists.
 */
function repairTruncated(s: string): unknown | null {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  let lastComplete = -1; // index just after the last fully-closed value
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
  // only closers remain unmatched after the cut point
  let cut = s.slice(0, lastComplete);
  const closers: string[] = [];
  {
    // recount the brackets still open within the cut
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
    for (let i = st2.length - 1; i >= 0; i--) closers.push(st2[i] === '{' ? '}' : ']');
  }
  try {
    return JSON.parse(cut + closers.join(''));
  } catch {
    return null;
  }
}
