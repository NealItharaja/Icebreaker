// The live game state machine. One controller instance drives the whole
// session; screens subscribe via useSyncExternalStore. Gemma calls are
// awaited at honest moments (lobby warm-up, closing a round, the reveal)
// and every async result is epoch-guarded so a restarted game can't be
// clobbered by a stale response.

import React, { createContext, useContext, useMemo, useRef, useSyncExternalStore } from 'react';
import * as Haptics from 'expo-haptics';
import { BOTS, randomCode, Spice } from './data';
import {
  botGuess,
  botSelf,
  computeReveal,
  fallbackCommentary,
  pairKey,
  unionOverlaps,
} from './engine';
import { BotMove, PairOverlaps, Player, PlayerId, RevealCard, RoundSpec, Spot } from './types';
import * as gemma from '../gemma/service';
import { Profile } from '../store/persist';

export type Phase = 'idle' | 'lobby' | 'ask' | 'guess' | 'judging' | 'reveal' | 'stand' | 'final' | 'share';

// round clocks — env-overridable for development/demo pacing
const ASK_SECS = Number(process.env.EXPO_PUBLIC_ASK_SECS) || 30;
const guessSecs = (n: number) => Number(process.env.EXPO_PUBLIC_GUESS_SECS) || 18 + 14 * (n - 1);

/** Bots for a new game — invited people first, then the rest of the floor. */
export function rosterFor(invites?: string[]) {
  if (!invites?.length) return BOTS;
  return [...BOTS.filter((b) => invites.includes(b.id)), ...BOTS.filter((b) => !invites.includes(b.id))];
}

export type LobbyLine = { mark: string; text: string; last: boolean };

export type GState = {
  phase: Phase;
  code: string;
  n: number;
  spice: Spice;
  players: Player[];
  lobbyLines: LobbyLine[];
  lobbyPct: number;
  ready: boolean;
  r: number;
  round: RoundSpec | null;
  roundsMeta: { topic: string; q: string; live: boolean }[];
  answersByRound: Record<PlayerId, string>[];
  askStep: number; // 0 answer · 1 self move · 2 sealed/waiting
  myAnswers: Record<number, string>;
  lieDrafts: string[] | null;
  lieLoading: boolean;
  mySelf: Record<number, string | null>;
  botSealed: Record<PlayerId, boolean>;
  spots: Spot[] | null;
  task: number;
  picks: Record<string, string>;
  botLocked: Record<PlayerId, boolean>;
  tleft: number;
  total: number;
  timedOut: boolean;
  nudged: boolean;
  closing: boolean;
  cards: RevealCard[] | null;
  midNote: string;
  scores: Record<PlayerId, number>;
  deltas: Record<PlayerId, number>;
  played: number;
  pairs: PairOverlaps;
  share: gemma.ShareResult | null;
  shareLoading: boolean;
  planned: boolean;
  recorded: boolean;
};

const initial = (): GState => ({
  phase: 'idle',
  code: 'V4KQ',
  n: 3,
  spice: 'chaotic',
  players: [],
  lobbyLines: [],
  lobbyPct: 0,
  ready: false,
  r: 0,
  round: null,
  roundsMeta: [],
  answersByRound: [],
  askStep: 0,
  myAnswers: {},
  lieDrafts: null,
  lieLoading: false,
  mySelf: {},
  botSealed: {},
  spots: null,
  task: 0,
  picks: {},
  botLocked: {},
  tleft: 30,
  total: 30,
  timedOut: false,
  nudged: false,
  closing: false,
  cards: null,
  midNote: '',
  scores: {},
  deltas: {},
  played: 0,
  pairs: {},
  share: null,
  shareLoading: false,
  planned: false,
  recorded: false,
});

export class GameController {
  state: GState = initial();
  private listeners = new Set<() => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private iv: ReturnType<typeof setInterval> | null = null;
  private epoch = 0;
  private roundPromises: Record<number, Promise<RoundSpec>> = {};
  private movesPromises: Record<number, Promise<Record<string, BotMove>>> = {};
  private closingAsk = false;
  private revealing = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;

  private set(patch: Partial<GState> | ((s: GState) => Partial<GState>)) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.iv) {
      clearInterval(this.iv);
      this.iv = null;
    }
  }

  private later(ms: number, fn: () => void) {
    const ep = this.epoch;
    this.timers.push(
      setTimeout(() => {
        if (ep === this.epoch) fn();
      }, ms),
    );
  }

  /** run an async continuation only if the game hasn't been reset since */
  private guard<T>(p: Promise<T>, fn: (v: T) => void) {
    const ep = this.epoch;
    p.then((v) => {
      if (ep === this.epoch) fn(v);
    });
  }

  private startClock(secs: number, onZero: () => void) {
    if (this.iv) clearInterval(this.iv);
    this.set({ tleft: secs, total: secs, timedOut: false });
    this.iv = setInterval(() => {
      const t = this.state.tleft - 1;
      if (t <= 0) {
        if (this.iv) clearInterval(this.iv);
        this.iv = null;
        this.set({ tleft: 0, timedOut: true });
        this.later(500, onZero);
      } else {
        this.set({ tleft: t });
      }
    }, 1000);
  }

  private bots(): Player[] {
    return this.state.players.filter((p) => p.id !== 'me');
  }

  // ── lobby ───────────────────────────────────────────────────────────────

  createGame(profile: Profile, n: number, spice: Spice, code?: string, invites?: string[]) {
    this.epoch++;
    this.clearTimers();
    this.closingAsk = false;
    this.revealing = false;
    this.roundPromises = {};
    this.movesPromises = {};
    const me: Player = { id: 'me', name: profile.name || 'You', sym: profile.sym };
    const pool = rosterFor(invites);
    const players = [me, ...pool.slice(0, Math.max(1, n - 1)).map((b) => ({ id: b.id, name: b.name, sym: b.sym, bot: b }))];
    this.state = {
      ...initial(),
      phase: 'lobby',
      code: code || randomCode(),
      n,
      spice,
      players,
    };
    this.listeners.forEach((l) => l());

    // Warm-up is real work: Gemma writes round 1 while the room fills.
    this.roundPromises[0] = gemma.writeRound(0, spice, n, { priorTopics: [], priorAnswers: [] });

    const steps = [
      { mark: '01', text: `${n} phones in the room. No profiles to read — good.`, pct: 25 },
      { mark: '02', text: 'I write one question per round and ask everybody at once.', pct: 52 },
      { mark: '03', text: 'Nothing is pre-baked. Round 2 depends on what round 1 says.', pct: 80 },
    ];
    steps.forEach((s, i) =>
      this.later(520 * (i + 1), () =>
        this.set((st) => ({
          lobbyLines: [...st.lobbyLines, { mark: s.mark, text: s.text, last: false }],
          lobbyPct: s.pct,
        })),
      ),
    );
    // The final line lands only when round 1 is genuinely written.
    const minWait = new Promise<void>((res) => this.later(520 * 4, () => res()));
    this.guard(Promise.all([this.roundPromises[0], minWait]), ([spec]) => {
      const label = spice.charAt(0).toUpperCase() + spice.slice(1);
      this.set((st) => ({
        lobbyLines: [
          ...st.lobbyLines,
          { mark: '✓', text: `Ready. ${label} mode${spec.live ? '' : ' — offline, canned questions tonight'}.`, last: true },
        ],
        lobbyPct: 100,
        ready: true,
      }));
    });
  }

  joinGame(profile: Profile, code: string) {
    this.createGame(profile, 3, 'chaotic', code);
  }

  // ── ask phase ───────────────────────────────────────────────────────────

  startGame() {
    if (this.state.phase !== 'lobby') return;
    this.beginRound(0);
  }

  private prefetchRound(r: number): Promise<RoundSpec> {
    if (!this.roundPromises[r]) {
      const st = this.state;
      const priorTopics = st.roundsMeta.map((m) => m.topic);
      const priorAnswers = st.answersByRound.map((ans) => {
        const byName: Record<string, string> = {};
        st.players.forEach((p) => {
          if (ans[p.id]) byName[p.name] = ans[p.id];
        });
        return byName;
      });
      this.roundPromises[r] = gemma.writeRound(r, st.spice, st.n, { priorTopics, priorAnswers });
    }
    return this.roundPromises[r];
  }

  private beginRound(r: number) {
    this.clearTimers();
    this.closingAsk = false;
    this.revealing = false;
    this.set({
      phase: 'ask',
      r,
      round: null,
      askStep: 0,
      lieDrafts: null,
      lieLoading: false,
      spots: null,
      task: 0,
      timedOut: false,
      nudged: false,
      closing: false,
      cards: null,
      botSealed: {},
      botLocked: {},
      tleft: 30,
      total: 30,
    });
    this.guard(this.prefetchRound(r), (spec) => {
      if (this.state.phase !== 'ask' || this.state.r !== r) return;
      this.set({ round: spec });
      // bots start answering only once the question exists
      const botList = this.bots();
      this.movesPromises[r] = gemma.botMoves(spec, r, botList.map((b) => b.bot!).filter(Boolean), this.state.spice, this.state.n);
      botList.forEach((p, i) =>
        this.later(2400 + i * 1700, () => {
          this.set((st) => ({ botSealed: { ...st.botSealed, [p.id]: true } }));
          this.maybeCloseAsk();
        }),
      );
      this.startClock(ASK_SECS, () => this.forceCloseAsk());
    });
  }

  sealAnswer(v: string) {
    const st = this.state;
    if (!st.round || st.askStep !== 0) return;
    const r = st.r;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    this.set({ myAnswers: { ...st.myAnswers, [r]: v } });
    if (st.round.archetype === 'tap') {
      this.set({ lieLoading: true });
      this.guard(gemma.draftLies(st.round, v, st.spice, st.n), (lies) => {
        if (this.state.r === r) this.set({ lieDrafts: lies, lieLoading: false });
      });
    }
    this.later(220, () => this.set({ askStep: 1 }));
  }

  setSelfMove(v: string) {
    const st = this.state;
    if (st.askStep !== 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    this.set({ mySelf: { ...st.mySelf, [st.r]: v } });
    this.later(260, () => {
      this.set({ askStep: 2 });
      this.maybeCloseAsk();
    });
  }

  /** design parity: you can skip the self move only by timeout */
  private forceCloseAsk() {
    const st = this.state;
    if (st.phase !== 'ask') return;
    const patch: Partial<GState> = { askStep: 2 };
    if (st.round && st.myAnswers[st.r] == null) {
      // timer beat them to it — seal the first chip so the round can close
      patch.myAnswers = { ...st.myAnswers, [st.r]: st.round.chips[0] };
    }
    // remaining bots seal instantly
    const sealed: Record<string, boolean> = { ...st.botSealed };
    this.bots().forEach((p) => (sealed[p.id] = true));
    patch.botSealed = sealed;
    this.set(patch);
    this.maybeCloseAsk(true);
  }

  private maybeCloseAsk(force = false) {
    const st = this.state;
    if (st.phase !== 'ask' || this.closingAsk) return;
    const meDone = st.askStep >= 2 || force;
    const botsDone = this.bots().every((p) => st.botSealed[p.id]);
    if (!meDone || !botsDone) return;
    this.closingAsk = true;
    this.later(650, () => this.closeAsk());
  }

  private async closeAsk() {
    const st = this.state;
    if (st.phase !== 'ask' || !st.round) return;
    const r = st.r;
    const round = st.round;
    const ep = this.epoch;
    this.set({ closing: true });
    if (this.iv) {
      clearInterval(this.iv);
      this.iv = null;
    }
    const moves = await (this.movesPromises[r] ??
      gemma.botMoves(round, r, this.bots().map((b) => b.bot!), st.spice, st.n));
    if (ep !== this.epoch || this.state.phase !== 'ask' || this.state.r !== r) return;

    const myTruth = this.state.myAnswers[r] ?? round.chips[0];
    const myPlanted = round.archetype === 'tap' ? this.state.mySelf[r] ?? null : null;
    const myDecoys =
      round.archetype === 'tap'
        ? (this.state.lieDrafts || round.chips.filter((c) => c !== myTruth).slice(0, 3)).filter((d) => d !== myPlanted).slice(0, 2)
        : [];

    const spots: Spot[] = this.state.players.map((p) => {
      if (p.id === 'me') {
        return { sid: 'me', sym: p.sym, name: p.name, truth: myTruth, decoys: myDecoys, planted: myPlanted };
      }
      const m = moves[p.id];
      return {
        sid: p.id,
        sym: p.sym,
        name: p.name,
        truth: m?.answer ?? round.chips[0],
        decoys: (m?.decoys ?? []).slice(0, 2),
        planted: round.archetype === 'tap' ? m?.planted ?? null : null,
      };
    });

    this.clearTimers();
    this.set({ phase: 'guess', spots, task: 0, botLocked: {}, nudged: false, closing: false });
    this.bots().forEach((p, i) =>
      this.later(2600 + i * 1800, () => {
        this.set((s) => ({ botLocked: { ...s.botLocked, [p.id]: true } }));
        this.maybeReveal();
      }),
    );
    this.startClock(guessSecs(this.state.n), () => this.toReveal());
  }

  // ── guess phase ─────────────────────────────────────────────────────────

  tasks(): { kind: 'spectate' | 'guess'; sid: PlayerId; spot?: Spot }[] {
    const spots = this.state.spots || [];
    return [
      { kind: 'spectate' as const, sid: 'me' as PlayerId },
      ...spots.filter((s) => s.sid !== 'me').map((s) => ({ kind: 'guess' as const, sid: s.sid, spot: s })),
    ];
  }

  leaveSpectate() {
    if (this.state.task === 0) this.set({ task: 1 });
  }

  guess(sid: PlayerId, value: string) {
    const st = this.state;
    if (st.phase !== 'guess') return;
    // only the card on screen can be answered
    const cur = this.tasks()[st.task];
    if (!cur || cur.sid !== sid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    this.set({ picks: { ...st.picks, [`${st.r}|${sid}`]: value } });
    // advance once per card — a re-tap inside the window only changes the pick
    const captured = st.task;
    this.later(260, () => {
      if (this.state.task !== captured) return;
      this.set({ task: captured + 1 });
      this.maybeReveal();
    });
  }

  nudge() {
    const st = this.state;
    this.set({ nudged: true });
    const askPhase = st.phase === 'ask';
    const pending = this.bots().filter((p) => !(askPhase ? st.botSealed : st.botLocked)[p.id]);
    pending.forEach((p, i) =>
      this.later(320 * (i + 1), () => {
        if (askPhase) {
          this.set((s) => ({ botSealed: { ...s.botSealed, [p.id]: true } }));
          this.maybeCloseAsk();
        } else {
          this.set((s) => ({ botLocked: { ...s.botLocked, [p.id]: true } }));
          this.maybeReveal();
        }
      }),
    );
  }

  private maybeReveal() {
    const st = this.state;
    if (st.phase !== 'guess' || this.revealing) return;
    const meDone = st.task >= this.tasks().length;
    const botsDone = this.bots().every((p) => st.botLocked[p.id]);
    if (meDone && botsDone) {
      this.revealing = true;
      this.later(700, () => this.toReveal());
    }
  }

  // ── reveal ──────────────────────────────────────────────────────────────

  private async toReveal() {
    const st = this.state;
    if (st.phase !== 'guess' || !st.spots || !st.round) return;
    this.clearTimers();
    const { r, round, spots, players, spice, n } = { ...st, round: st.round!, spots: st.spots! };
    const ep = this.epoch;
    this.set({ phase: 'judging' });

    const answers: Record<PlayerId, string> = {};
    spots.forEach((sp) => (answers[sp.sid] = sp.truth));

    // everyone's guesses about everyone
    const guesses: Record<string, string | undefined> = {};
    players.forEach((g) => {
      spots.forEach((sp) => {
        if (g.id === sp.sid) return;
        guesses[`${g.id}|${sp.sid}`] =
          g.id === 'me' ? st.picks[`${r}|${sp.sid}`] : botGuess(r, round.archetype, sp, g.id, players, answers);
      });
    });

    // self moves: mine from UI, bots deterministic
    const selves: Record<PlayerId, string | null> = {};
    spots.forEach((sp) => {
      selves[sp.sid] = sp.sid === 'me' ? st.mySelf[r] ?? null : botSelf(r, round.archetype, sp, players);
    });

    try {
    // Gemma judges typed rounds by meaning (batched, one call)
    let judgeFn;
    if (round.archetype === 'type') {
      const pairsList: gemma.JudgePair[] = [];
      const keys: string[] = [];
      players.forEach((g) =>
        spots.forEach((sp) => {
          if (g.id === sp.sid) return;
          keys.push(`${g.id}|${sp.sid}`);
          pairsList.push({ i: pairsList.length, truth: sp.truth, guess: guesses[`${g.id}|${sp.sid}`] || null });
        }),
      );
      const results = await gemma.judgeBatch(round.q, pairsList, spice, n);
      if (ep !== this.epoch || this.state.phase !== 'judging') return;
      const map: Record<string, (typeof results)[number]> = {};
      keys.forEach((k, i) => (map[k] = results[i]));
      judgeFn = (guess: string | undefined, truth: string, gid: PlayerId, sid: PlayerId) =>
        map[`${gid}|${sid}`] ?? { score: 0, ok: false, half: false, note: 'No answer came in before the timer.' };
    }

    const { cards, scores, deltas } = computeReveal(
      {
        r,
        archetype: round.archetype,
        players,
        spots,
        answers,
        selves,
        guesses,
        judge: judgeFn,
        aboutMe: round.aboutMe,
        aboutTemplate: round.aboutTemplate,
      },
      st.scores,
    );

    // Gemma calls the reveal — one line per card + a room-level read, in the chosen spice
    const { lines, mid } = await gemma.revealLines(cards, round.archetype, spice, n, r);
    if (ep !== this.epoch || this.state.phase !== 'judging') return;
    cards.forEach((c, i) => {
      c.gemma = lines[i] || fallbackCommentary(round.archetype, c, spice);
    });

    const answersByRound = [...st.answersByRound];
    answersByRound[r] = answers;
    const roundsMeta = [...st.roundsMeta];
    roundsMeta[r] = { topic: round.topic, q: round.q, live: round.live };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    this.set({ phase: 'reveal', cards, scores, deltas, played: r + 1, answersByRound, roundsMeta, midNote: mid });

    // overlap clustering runs behind the reveal; standings pick it up when ready
    this.guard(gemma.clusterOverlaps(players, roundsMeta, answersByRound, spice), (pairs) =>
      this.set({ pairs }),
    );
    } catch {
      // whatever went wrong, the round still reveals — pure fallbacks only
      if (ep !== this.epoch || this.state.phase !== 'judging') return;
      const { cards, scores, deltas } = computeReveal(
        { r, archetype: round.archetype, players, spots, answers, selves, guesses, aboutMe: round.aboutMe, aboutTemplate: round.aboutTemplate },
        st.scores,
      );
      cards.forEach((c) => {
        c.gemma = fallbackCommentary(round.archetype, c, spice);
      });
      const answersByRound = [...st.answersByRound];
      answersByRound[r] = answers;
      const roundsMeta = [...st.roundsMeta];
      roundsMeta[r] = { topic: round.topic, q: round.q, live: round.live };
      this.set({ phase: 'reveal', cards, scores, deltas, played: r + 1, answersByRound, roundsMeta, midNote: '' });
    }
  }

  toStandings() {
    if (this.state.phase !== 'reveal') return;
    this.set({ phase: 'stand' });
    if (this.state.r < 2) this.prefetchRound(this.state.r + 1);
  }

  nextRound() {
    const st = this.state;
    if (st.r < 2) this.beginRound(st.r + 1);
    else {
      this.clearTimers();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      this.set({ phase: 'final' });
    }
  }

  // ── share ───────────────────────────────────────────────────────────────

  overlap = (a: PlayerId, b: PlayerId): string[] => this.state.pairs[pairKey(a, b)] || [];

  bestMatch(): { player: Player; items: string[] } | null {
    let best: Player | null = null;
    let bs = -1;
    this.state.players
      .filter((p) => p.id !== 'me')
      .forEach((p) => {
        const nn = this.overlap('me', p.id).length;
        if (nn > bs) {
          bs = nn;
          best = p;
        }
      });
    return bs > 0 && best ? { player: best, items: this.overlap('me', (best as Player).id) } : null;
  }

  buildShare() {
    const st = this.state;
    if (st.phase === 'share' && (st.share || st.shareLoading)) return;
    this.set({ phase: 'share', shareLoading: true, share: null });
    const best = this.bestMatch();
    this.guard(
      gemma.shareCard(
        st.players.find((p) => p.id === 'me')?.name || 'You',
        best ? { name: best.player.name, items: best.items } : null,
        unionOverlaps(st.pairs),
        st.spice,
        st.n,
      ),
      (share) => this.set({ share, shareLoading: false }),
    );
  }

  markPlanned() {
    this.set({ planned: true });
  }

  /** returns what to persist exactly once per game */
  takeRecord(): { botIds: string[]; pairs: PairOverlaps } | null {
    if (this.state.recorded || !this.state.played) return null;
    this.set({ recorded: true });
    return { botIds: this.bots().map((b) => b.id), pairs: this.state.pairs };
  }

  reset() {
    this.epoch++;
    this.clearTimers();
    this.closingAsk = false;
    this.revealing = false;
    this.roundPromises = {};
    this.movesPromises = {};
    this.state = initial();
    this.listeners.forEach((l) => l());
  }
}

const Ctx = createContext<GameController | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<GameController | null>(null);
  if (!ref.current) ref.current = new GameController();
  const value = useMemo(() => ref.current!, []);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): [GState, GameController] {
  const ctrl = useContext(Ctx);
  if (!ctrl) throw new Error('useGame outside GameProvider');
  const state = useSyncExternalStore(ctrl.subscribe, ctrl.getState, ctrl.getState);
  return [state, ctrl];
}
