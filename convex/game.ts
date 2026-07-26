// The room state machine. Server-authoritative: phases, deadlines, scoring.
// Clients are thin — they render roomState and call the mutations below.

import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
  ASK_MS,
  computeReveal,
  FALLBACK_ROUNDS,
  fallbackCommentary,
  fallbackPairs,
  guessMs,
  PlayerLite,
  randomCode,
  SpotLite,
} from './lib';

const ROUND_RESCUE_MS = 45_000; // a 'writing' round older than this gets the fallback spec
const JUDGING_RESCUE_MS = 90_000; // a 'judging' phase older than this reveals with pure fallbacks

const MAX_PLAYERS = 7;

type Ctx = { db: any; scheduler?: any };

async function getRoom(ctx: Ctx, roomId: Id<'rooms'>): Promise<Doc<'rooms'>> {
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error('room not found');
  return room;
}

async function roomPlayers(ctx: Ctx, roomId: Id<'rooms'>): Promise<Doc<'players'>[]> {
  return await ctx.db
    .query('players')
    .withIndex('by_room', (q: any) => q.eq('roomId', roomId))
    .collect();
}

async function roundDoc(ctx: Ctx, roomId: Id<'rooms'>, r: number): Promise<Doc<'rounds'> | null> {
  return await ctx.db
    .query('rounds')
    .withIndex('by_room_r', (q: any) => q.eq('roomId', roomId).eq('r', r))
    .unique();
}

async function roundMoves(ctx: Ctx, roomId: Id<'rooms'>, r: number): Promise<Doc<'moves'>[]> {
  return await ctx.db
    .query('moves')
    .withIndex('by_room_r', (q: any) => q.eq('roomId', roomId).eq('r', r))
    .collect();
}

async function myPlayer(ctx: Ctx, roomId: Id<'rooms'>, deviceId: string): Promise<Doc<'players'> | null> {
  return await ctx.db
    .query('players')
    .withIndex('by_room_device', (q: any) => q.eq('roomId', roomId).eq('deviceId', deviceId))
    .unique();
}

// ── room lifecycle ────────────────────────────────────────────────────────

export const createRoom = mutation({
  args: {
    deviceId: v.string(),
    name: v.string(),
    sym: v.number(),
    spice: v.string(),
  },
  handler: async (ctx, args) => {
    // unique fully-numeric code among active rooms
    let code = randomCode();
    for (let tries = 0; tries < 25; tries++) {
      const clash = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q) => q.eq('code', code))
        .filter((q) => q.eq(q.field('active'), true))
        .first();
      if (!clash) break;
      code = randomCode();
    }
    const roomId = await ctx.db.insert('rooms', {
      code,
      spice: args.spice,
      hostDevice: args.deviceId,
      phase: 'lobby',
      r: 0,
      deadline: null,
      pendingClose: false,
      scores: {},
      deltas: {},
      pairs: {},
      mid: '',
      active: true,
      createdAt: Date.now(),
    });
    await ctx.db.insert('players', {
      roomId,
      deviceId: args.deviceId,
      name: args.name || 'You',
      sym: args.sym,
      isAi: false,
      order: 0,
    });
    await ctx.db.insert('rounds', { roomId, r: 0, status: 'writing' });
    await ctx.scheduler.runAfter(0, internal.ai.writeRoundAction, { roomId, r: 0 });
    await ctx.scheduler.runAfter(ROUND_RESCUE_MS, internal.game.rescueRound, { roomId, r: 0 });
    return { roomId, code };
  },
});

export const joinRoom = mutation({
  args: { code: v.string(), deviceId: v.string(), name: v.string(), sym: v.number() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', args.code))
      .filter((q) => q.eq(q.field('active'), true))
      .first();
    if (!room) return { error: 'No room with that code. Codes die when the game ends.' };
    const existing = await myPlayer(ctx, room._id, args.deviceId);
    if (existing) return { roomId: room._id }; // rejoin
    if (room.phase !== 'lobby') return { error: 'That game already started. Ask them to run it back.' };
    const players = await roomPlayers(ctx, room._id);
    if (players.length >= MAX_PLAYERS) return { error: 'That room is full — seven is the cap.' };
    await ctx.db.insert('players', {
      roomId: room._id,
      deviceId: args.deviceId,
      name: args.name || 'Friend',
      sym: args.sym,
      isAi: false,
      order: players.length,
    });
    return { roomId: room._id };
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id('rooms'), deviceId: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;
    const me = await myPlayer(ctx, args.roomId, args.deviceId);
    if (!me) return;
    if (room.phase === 'lobby') {
      if (room.hostDevice === args.deviceId) {
        // host walked out — the room dies
        await ctx.db.patch(args.roomId, { active: false, phase: 'closed' });
      } else {
        await ctx.db.delete(me._id);
      }
    }
    // mid-game leaves are handled by deadlines; the seat stays
  },
});

export const startGame = mutation({
  args: { roomId: v.id('rooms'), deviceId: v.string() },
  handler: async (ctx, args) => {
    const room = await getRoom(ctx, args.roomId);
    if (room.phase !== 'lobby' || room.hostDevice !== args.deviceId) return;
    const round = await roundDoc(ctx, args.roomId, 0);
    if (!round || round.status !== 'ready') return;
    const players = await roomPlayers(ctx, args.roomId);
    if (players.length < 2) return;
    const deadline = Date.now() + ASK_MS;
    await ctx.db.patch(args.roomId, { phase: 'ask', r: 0, deadline, pendingClose: false });
    await ctx.scheduler.runAfter(ASK_MS + 500, internal.game.checkDeadline, {
      roomId: args.roomId,
      phase: 'ask',
      r: 0,
    });
  },
});

// ── ask phase ─────────────────────────────────────────────────────────────

export const sealAnswer = mutation({
  args: { roomId: v.id('rooms'), deviceId: v.string(), answer: v.string() },
  handler: async (ctx, args) => {
    const room = await getRoom(ctx, args.roomId);
    if (room.phase !== 'ask') return;
    const me = await myPlayer(ctx, args.roomId, args.deviceId);
    if (!me || me.isAi) return;
    const round = await roundDoc(ctx, args.roomId, room.r);
    if (!round?.spec) return;
    const existing = await ctx.db
      .query('moves')
      .withIndex('by_room_r_player', (q) => q.eq('roomId', args.roomId).eq('r', room.r).eq('playerId', me._id))
      .unique();
    if (existing?.sealedAt) return; // sealed is sealed
    const answer = args.answer.trim().slice(0, 80);
    if (!answer) return;
    let moveId: Id<'moves'>;
    if (existing) {
      await ctx.db.patch(existing._id, { answer, sealedAt: Date.now() });
      moveId = existing._id;
    } else {
      moveId = await ctx.db.insert('moves', {
        roomId: args.roomId,
        r: room.r,
        playerId: me._id,
        answer,
        sealedAt: Date.now(),
      });
    }
    if (round.spec.archetype === 'tap') {
      await ctx.scheduler.runAfter(0, internal.ai.draftLiesAction, {
        roomId: args.roomId,
        moveId,
        r: room.r,
        answer,
      });
    }
  },
});

export const setSelfMove = mutation({
  args: { roomId: v.id('rooms'), deviceId: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const room = await getRoom(ctx, args.roomId);
    if (room.phase !== 'ask') return;
    const me = await myPlayer(ctx, args.roomId, args.deviceId);
    if (!me || me.isAi) return;
    const round = await roundDoc(ctx, args.roomId, room.r);
    if (!round?.spec) return;
    const move = await ctx.db
      .query('moves')
      .withIndex('by_room_r_player', (q) => q.eq('roomId', args.roomId).eq('r', room.r).eq('playerId', me._id))
      .unique();
    if (!move?.sealedAt || move.readyAt) return;
    if (round.spec.archetype === 'tap') {
      const drafts = move.lieDrafts || round.spec.chips.filter((c) => c !== move.answer).slice(0, 3);
      // the planted lie must be one of the drafted lies — and never the truth
      const value = args.value.trim();
      if (value.toLowerCase() === (move.answer || '').toLowerCase()) return;
      if (drafts.length && !drafts.some((d) => d.toLowerCase() === value.toLowerCase())) return;
      const decoys = drafts.filter((d) => d !== value).slice(0, 2);
      await ctx.db.patch(move._id, { planted: value, decoys, selfMove: value, readyAt: Date.now() });
    } else {
      await ctx.db.patch(move._id, { selfMove: args.value, readyAt: Date.now() });
    }
    await maybeCloseAsk(ctx, await getRoom(ctx, args.roomId));
  },
});

async function maybeCloseAsk(ctx: Ctx, room: Doc<'rooms'>) {
  if (room.phase !== 'ask') return;
  const players = await roomPlayers(ctx, room._id);
  const moves = await roundMoves(ctx, room._id, room.r);
  const everyoneDone = players.every((p) => moves.some((m) => m.playerId === p._id && m.readyAt));
  if (everyoneDone) await closeAsk(ctx, room._id);
}

async function closeAsk(ctx: Ctx, roomId: Id<'rooms'>) {
  const room = await getRoom(ctx, roomId);
  if (room.phase !== 'ask') return;
  const round = await roundDoc(ctx, roomId, room.r);
  const players = await roomPlayers(ctx, roomId);
  const moves = await roundMoves(ctx, roomId, room.r);
  // fill in decoys for sealed spotlights that never picked a lie
  if (round?.spec?.archetype === 'tap') {
    for (const m of moves) {
      if (m.sealedAt && (!m.decoys || !m.decoys.length)) {
        const drafts = m.lieDrafts || round.spec.chips.filter((c) => c !== m.answer);
        await ctx.db.patch(m._id, {
          decoys: drafts.filter((d) => d !== m.planted).slice(0, 2),
          planted: m.planted ?? null,
        });
      }
    }
  }
  const deadline = Date.now() + guessMs(players.length);
  await ctx.db.patch(roomId, { phase: 'guess', deadline, pendingClose: false });
  await ctx.scheduler.runAfter(guessMs(players.length) + 500, internal.game.checkDeadline, {
    roomId,
    phase: 'guess',
    r: room.r,
  });
}

// ── guess phase ───────────────────────────────────────────────────────────

export const submitGuess = mutation({
  // spotId is the spotlight's MOVE id — opaque, so whose-round authors stay
  // anonymous in every client payload until the reveal
  args: { roomId: v.id('rooms'), deviceId: v.string(), spotId: v.id('moves'), value: v.string() },
  handler: async (ctx, args) => {
    const room = await getRoom(ctx, args.roomId);
    if (room.phase !== 'guess') return;
    const me = await myPlayer(ctx, args.roomId, args.deviceId);
    if (!me || me.isAi) return;
    const spotMove = await ctx.db.get(args.spotId);
    if (!spotMove || spotMove.roomId !== args.roomId || spotMove.r !== room.r || !spotMove.sealedAt) return;
    const sid = spotMove.playerId;
    if (sid === me._id) return;
    const moves = await roundMoves(ctx, args.roomId, room.r);
    const mine = moves.find((m) => m.playerId === me._id);
    const guesses = { ...(mine?.guesses || {}), [sid]: args.value.trim().slice(0, 80) };
    const spotIds = moves.filter((m) => m.sealedAt && m.playerId !== me._id).map((m) => m.playerId);
    const all = spotIds.every((sidId) => guesses[sidId]);
    const patch = { guesses, lockedAt: all ? Date.now() : undefined };
    if (mine) await ctx.db.patch(mine._id, patch);
    else
      await ctx.db.insert('moves', {
        roomId: args.roomId,
        r: room.r,
        playerId: me._id,
        ...patch,
      });
    if (all) await maybeReveal(ctx, await getRoom(ctx, args.roomId));
  },
});

async function maybeReveal(ctx: Ctx, room: Doc<'rooms'>) {
  if (room.phase !== 'guess') return;
  const players = await roomPlayers(ctx, room._id);
  const moves = await roundMoves(ctx, room._id, room.r);
  const sealedIds = new Set(moves.filter((m) => m.sealedAt).map((m) => m.playerId));
  const done = players.every((p) => {
    const others = [...sealedIds].filter((id) => id !== p._id);
    if (!others.length) return true;
    const m = moves.find((mm) => mm.playerId === p._id);
    return !!m?.lockedAt;
  });
  if (done) await beginReveal(ctx, room._id);
}

async function beginReveal(ctx: Ctx, roomId: Id<'rooms'>) {
  const room = await getRoom(ctx, roomId);
  if (room.phase !== 'guess') return;
  await ctx.db.patch(roomId, { phase: 'judging', deadline: null });
  await ctx.scheduler.runAfter(0, internal.ai.revealAction, { roomId, r: room.r });
  // if the action dies mid-flight, the room still reveals with pure fallbacks
  await ctx.scheduler.runAfter(JUDGING_RESCUE_MS, internal.game.rescueJudging, { roomId, r: room.r });
}

// ── advancing ─────────────────────────────────────────────────────────────

export const advance = mutation({
  // `from` is the phase the tapping client was looking at — a second tap
  // (same player or another phone) no-ops instead of double-advancing
  args: { roomId: v.id('rooms'), deviceId: v.string(), from: v.string() },
  handler: async (ctx, args) => {
    const room = await getRoom(ctx, args.roomId);
    const me = await myPlayer(ctx, args.roomId, args.deviceId);
    if (!me || room.phase !== args.from) return;
    if (room.phase === 'reveal') {
      await ctx.db.patch(args.roomId, { phase: 'stand' });
      return;
    }
    if (room.phase === 'stand') {
      if (room.r < 2) {
        const nextR = room.r + 1;
        const round = await roundDoc(ctx, args.roomId, nextR);
        if (!round) {
          await ctx.db.insert('rounds', { roomId: args.roomId, r: nextR, status: 'writing' });
          await ctx.scheduler.runAfter(0, internal.ai.writeRoundAction, { roomId: args.roomId, r: nextR });
          await ctx.scheduler.runAfter(ROUND_RESCUE_MS, internal.game.rescueRound, { roomId: args.roomId, r: nextR });
        }
        const ready = round?.status === 'ready';
        const deadline = ready ? Date.now() + ASK_MS : null;
        await ctx.db.patch(args.roomId, { phase: 'ask', r: nextR, deadline, pendingClose: false });
        if (ready)
          await ctx.scheduler.runAfter(ASK_MS + 500, internal.game.checkDeadline, {
            roomId: args.roomId,
            phase: 'ask',
            r: nextR,
          });
      } else {
        // the night is over — free the code, keep the memory
        await ctx.db.patch(args.roomId, { phase: 'final', deadline: null, active: false });
      }
    }
  },
});

// ── deadline enforcement ──────────────────────────────────────────────────

export const checkDeadline = internalMutation({
  args: { roomId: v.id('rooms'), phase: v.string(), r: v.number() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.phase !== args.phase || room.r !== args.r) return;
    if (room.deadline == null || Date.now() < room.deadline - 250) return;
    if (args.phase === 'ask') {
      // time's up: whoever sealed plays, everyone else sits this one out
      await closeAsk(ctx, args.roomId);
    } else if (args.phase === 'guess') {
      await beginReveal(ctx, args.roomId);
    }
  },
});

// ── internal writes for actions ───────────────────────────────────────────

export const logGemma = internalMutation({
  args: {
    roomId: v.optional(v.id('rooms')),
    task: v.string(),
    model: v.string(),
    system: v.string(),
    user: v.string(),
    output: v.string(),
    ms: v.number(),
    tokens: v.number(),
    mode: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('gemmaLog', { ...args, at: Date.now() });
    // keep the table bounded
    const oldest = await ctx.db.query('gemmaLog').withIndex('by_at').order('asc').take(60);
    if (oldest.length === 60) {
      for (const doc of oldest.slice(0, 20)) await ctx.db.delete(doc._id);
    }
  },
});

async function markRoundReady(ctx: Ctx, roomId: Id<'rooms'>, r: number, spec: any) {
  const round = await roundDoc(ctx, roomId, r);
  if (!round || round.status === 'ready') return;
  await ctx.db.patch(round._id, { status: 'ready', spec });
  const room = await ctx.db.get(roomId);
  if (room && room.phase === 'ask' && room.r === r && room.deadline == null) {
    const deadline = Date.now() + ASK_MS;
    await ctx.db.patch(roomId, { deadline });
    await ctx.scheduler.runAfter(ASK_MS + 500, internal.game.checkDeadline, {
      roomId,
      phase: 'ask',
      r,
    });
  }
}

export const roundReady = internalMutation({
  args: { roomId: v.id('rooms'), r: v.number(), spec: v.any() },
  handler: async (ctx, args) => {
    await markRoundReady(ctx, args.roomId, args.r, args.spec);
  },
});

/** watchdog: a round stuck in 'writing' (dead action) gets the canned spec */
export const rescueRound = internalMutation({
  args: { roomId: v.id('rooms'), r: v.number() },
  handler: async (ctx, args) => {
    const round = await roundDoc(ctx, args.roomId, args.r);
    if (!round || round.status === 'ready') return;
    const room = await ctx.db.get(args.roomId);
    if (!room || !room.active) return;
    await markRoundReady(ctx, args.roomId, args.r, { ...FALLBACK_ROUNDS[args.r] });
  },
});

export const saveLieDrafts = internalMutation({
  args: { moveId: v.id('moves'), lies: v.array(v.string()) },
  handler: async (ctx, args) => {
    const move = await ctx.db.get(args.moveId);
    if (!move || move.readyAt) return;
    await ctx.db.patch(args.moveId, { lieDrafts: args.lies });
  },
});

type RevealPayload = {
  roomId: Id<'rooms'>;
  r: number;
  cards: any;
  scores: Record<string, number>;
  deltas: Record<string, number>;
  mid: string;
  pairs: Record<string, string[]>;
};

async function commitReveal(ctx: Ctx, args: RevealPayload) {
  const room = await ctx.db.get(args.roomId);
  if (!room || room.phase !== 'judging' || room.r !== args.r) return;
  const prior = await ctx.db
    .query('reveals')
    .withIndex('by_room_r', (q: any) => q.eq('roomId', args.roomId).eq('r', args.r))
    .unique();
  if (prior) return;
  await ctx.db.insert('reveals', { roomId: args.roomId, r: args.r, cards: args.cards });
  await ctx.db.patch(args.roomId, {
    phase: 'reveal',
    scores: args.scores,
    deltas: args.deltas,
    mid: args.mid,
    pairs: args.pairs,
  });
  // prefetch the next round while the room reads the reveal
  if (args.r < 2) {
    const next = await roundDoc(ctx, args.roomId, args.r + 1);
    if (!next) {
      await ctx.db.insert('rounds', { roomId: args.roomId, r: args.r + 1, status: 'writing' });
      await ctx.scheduler.runAfter(0, internal.ai.writeRoundAction, { roomId: args.roomId, r: args.r + 1 });
      await ctx.scheduler.runAfter(ROUND_RESCUE_MS, internal.game.rescueRound, {
        roomId: args.roomId,
        r: args.r + 1,
      });
    }
  }
}

export const finishReveal = internalMutation({
  args: {
    roomId: v.id('rooms'),
    r: v.number(),
    cards: v.any(),
    scores: v.record(v.string(), v.number()),
    deltas: v.record(v.string(), v.number()),
    mid: v.string(),
    pairs: v.record(v.string(), v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await commitReveal(ctx, args);
  },
});

/** watchdog: a room stuck in 'judging' (dead action) reveals with fallbacks */
export const rescueJudging = internalMutation({
  args: { roomId: v.id('rooms'), r: v.number() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.phase !== 'judging' || room.r !== args.r) return;
    const round = await roundDoc(ctx, args.roomId, args.r);
    if (!round?.spec) return;
    const spec = round.spec;
    const playersDocs = await roomPlayers(ctx, args.roomId);
    const players: PlayerLite[] = playersDocs.map((p) => ({
      id: p._id,
      name: p.name,
      sym: p.sym,
      isAi: p.isAi,
      order: p.order,
    }));
    const moves = await roundMoves(ctx, args.roomId, args.r);
    const spots: SpotLite[] = moves
      .filter((m) => m.sealedAt)
      .map((m) => {
        const p = playersDocs.find((pp) => pp._id === m.playerId)!;
        return {
          sid: m.playerId,
          name: p?.name || '?',
          sym: p?.sym || 1,
          truth: m.answer!,
          decoys: m.decoys || [],
          planted: m.planted ?? null,
          selfMove: m.selfMove ?? null,
        };
      });
    const guesses: Record<string, string | undefined> = {};
    players.forEach((g) => {
      spots.forEach((sp) => {
        if (g.id === sp.sid) return;
        guesses[`${g.id}|${sp.sid}`] = moves.find((m) => m.playerId === g.id)?.guesses?.[sp.sid];
      });
    });
    const { cards, scores, deltas } = computeReveal(
      { r: args.r, archetype: spec.archetype, players, spots, guesses },
      room.scores,
    );
    cards.forEach((c) => (c.gemma = fallbackCommentary(spec.archetype, c)));
    const answersByRound: Record<string, string>[] = [];
    const allMoves = await ctx.db
      .query('moves')
      .withIndex('by_room_r', (q: any) => q.eq('roomId', args.roomId))
      .collect();
    for (let rr = 0; rr <= args.r; rr++) {
      const byId: Record<string, string> = {};
      allMoves.filter((m: any) => m.r === rr && m.answer).forEach((m: any) => (byId[m.playerId] = m.answer));
      answersByRound.push(byId);
    }
    await commitReveal(ctx, {
      roomId: args.roomId,
      r: args.r,
      cards,
      scores,
      deltas,
      mid: '',
      pairs: fallbackPairs(players, answersByRound),
    });
  },
});

export const saveShare = internalMutation({
  args: {
    playerId: v.id('players'),
    note: v.string(),
    plan: v.object({ when: v.string(), title: v.string(), why: v.string() }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, { shareNote: args.note, sharePlan: args.plan });
  },
});

// ── internal reads for actions ────────────────────────────────────────────

export const gather = internalMutation({
  // written as a mutation so actions can atomically read a snapshot
  args: { roomId: v.id('rooms'), r: v.number() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    const players = room ? await roomPlayers(ctx, args.roomId) : [];
    const round = room ? await roundDoc(ctx, args.roomId, args.r) : null;
    const moves = room ? await roundMoves(ctx, args.roomId, args.r) : [];
    const allMoves = room
      ? await ctx.db
          .query('moves')
          .withIndex('by_room_r', (q) => q.eq('roomId', args.roomId))
          .collect()
      : [];
    const rounds = room
      ? await ctx.db
          .query('rounds')
          .withIndex('by_room_r', (q) => q.eq('roomId', args.roomId))
          .collect()
      : [];
    return { room, players, round, moves, allMoves, rounds };
  },
});

// ── the one reactive query driving the client ─────────────────────────────

export const roomState = query({
  args: { roomId: v.id('rooms'), deviceId: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;
    const players = await roomPlayers(ctx, args.roomId);
    const me = players.find((p) => p.deviceId === args.deviceId) || null;
    const round = await roundDoc(ctx, args.roomId, room.r);
    const moves = await roundMoves(ctx, args.roomId, room.r);
    const myMove = me ? moves.find((m) => m.playerId === me._id) || null : null;
    const reveal =
      room.phase === 'reveal' || room.phase === 'stand' || room.phase === 'final'
        ? await ctx.db
            .query('reveals')
            .withIndex('by_room_r', (q) => q.eq('roomId', args.roomId).eq('r', room.r))
            .unique()
        : null;
    const round0 = room.phase === 'lobby' ? await roundDoc(ctx, args.roomId, 0) : null;
    // my sealed answers across all rounds (for the "only you" region at the end)
    const myAnswers: string[] = [];
    if (me) {
      for (let rr = 0; rr <= room.r; rr++) {
        const m =
          rr === room.r
            ? moves.find((mm) => mm.playerId === me._id)
            : await ctx.db
                .query('moves')
                .withIndex('by_room_r_player', (q) =>
                  q.eq('roomId', args.roomId).eq('r', rr).eq('playerId', me._id),
                )
                .unique();
        if (m?.answer) myAnswers.push(m.answer);
      }
    }

    const sealed: Record<string, boolean> = {};
    const ready: Record<string, boolean> = {};
    const locked: Record<string, boolean> = {};
    players.forEach((p) => {
      const m = moves.find((mm) => mm.playerId === p._id);
      sealed[p._id] = !!m?.sealedAt;
      ready[p._id] = !!m?.readyAt;
      locked[p._id] = !!m?.lockedAt;
    });

    // guessable spotlights, keyed by opaque move id — never reveals which
    // option is the truth, and whose-round authors stay anonymous
    const whose = round?.spec?.archetype === 'whose';
    const spots =
      room.phase === 'guess' || room.phase === 'judging'
        ? moves
            .filter((m) => m.sealedAt)
            .map((m) => {
              const p = players.find((pp) => pp._id === m.playerId)!;
              const opts =
                round?.spec?.archetype === 'tap'
                  ? [m.answer!, ...(m.decoys || []), ...(m.planted ? [m.planted] : [])]
                      .filter((x, i, arr) => arr.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i)
                      .sort((a, b) => (a + m.playerId).length - (b + m.playerId).length || a.localeCompare(b))
                  : undefined;
              return {
                spotId: m._id,
                isMe: !!me && m.playerId === me._id,
                name: whose ? undefined : p?.name || '?',
                sym: whose ? undefined : p?.sym || 1,
                quote: whose ? m.answer : undefined,
                options: opts,
              };
            })
        : [];
    // my guesses, re-keyed by the opaque spot ids
    const guessesBySpot: Record<string, string> = {};
    if (myMove?.guesses) {
      moves
        .filter((m) => m.sealedAt)
        .forEach((m) => {
          const gv = myMove.guesses?.[m.playerId];
          if (gv) guessesBySpot[m._id] = gv;
        });
    }

    return {
      room: {
        id: room._id,
        code: room.code,
        spice: room.spice,
        phase: room.phase,
        r: room.r,
        deadline: room.deadline,
        scores: room.scores,
        deltas: room.deltas,
        pairs: room.pairs,
        mid: room.mid,
        active: room.active,
        isHost: room.hostDevice === args.deviceId,
      },
      players: players
        .sort((a, b) => a.order - b.order)
        .map((p) => ({
          id: p._id,
          key: p.deviceId, // stable identity across games (uuid or ai:<seed>)
          name: p.name,
          sym: p.sym,
          isAi: p.isAi,
          isMe: !!me && p._id === me._id,
        })),
      meId: me?._id ?? null,
      round: round?.spec ?? null,
      roundStatus: round?.status ?? 'writing',
      lobbyReady: room.phase !== 'lobby' || round0?.status === 'ready',
      myMove: myMove
        ? {
            answer: myMove.answer ?? null,
            sealed: !!myMove.sealedAt,
            lieDrafts: myMove.lieDrafts ?? null,
            planted: myMove.planted ?? null,
            selfMove: myMove.selfMove ?? null,
            ready: !!myMove.readyAt,
            guesses: guessesBySpot,
            locked: !!myMove.lockedAt,
          }
        : null,
      sealed,
      ready,
      locked,
      spots,
      cards: reveal?.cards ?? null,
      myAnswers,
      myShare: me?.shareNote ? { note: me.shareNote, plan: me.sharePlan } : null,
    };
  },
});

export const activeRoomFor = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const mine = await ctx.db
      .query('players')
      .withIndex('by_device', (q) => q.eq('deviceId', args.deviceId))
      .order('desc')
      .take(10);
    for (const p of mine) {
      const room = await ctx.db.get(p.roomId);
      if (room?.active) return { roomId: room._id, code: room.code, phase: room.phase };
    }
    return null;
  },
});

export const gemmaStatus = query({
  args: {},
  handler: async () => ({
    live: !!process.env.OPENROUTER_API_KEY,
    model: process.env.GEMMA_MODEL || 'google/gemma-4-31b-it',
  }),
});

export const gemmaLast = query({
  args: { roomId: v.optional(v.id('rooms')), deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const recent = await ctx.db.query('gemmaLog').withIndex('by_at').order('desc').take(40);
    const live = recent.filter((l) => l.mode === 'live').map((l) => l.ms).sort((a, b) => a - b);
    // full prompts only for rooms you're actually in — otherwise the latest
    // non-room call (home notices, map openers) so nothing leaks across rooms
    let member = false;
    if (args.roomId && args.deviceId) {
      member = !!(await myPlayer(ctx, args.roomId, args.deviceId));
    }
    const last =
      recent.find((l) => (l.roomId ? member && l.roomId === args.roomId : true)) || null;
    return {
      last,
      p50: live.length ? live[Math.floor(live.length / 2)] : null,
      liveCalls: live.length,
    };
  },
});
