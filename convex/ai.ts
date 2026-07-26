// Actions: every Gemma 4 call in Venn happens here, server-side.

import { v } from 'convex/values';
import { action, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import * as gemma from './gemma';
import {
  computeReveal,
  fallbackCommentary,
  fallbackPairs,
  pairKey,
  PlayerLite,
  SpotLite,
} from './lib';

function logger(ctx: { runMutation: any }, roomId?: Id<'rooms'>): gemma.LogFn {
  return (entry) => ctx.runMutation(internal.game.logGemma, { ...entry, roomId });
}

const toLite = (p: any): PlayerLite => ({
  id: p._id,
  name: p.name,
  sym: p.sym,
  isAi: p.isAi,
  order: p.order,
});

export const writeRoundAction = internalAction({
  args: { roomId: v.id('rooms'), r: v.number() },
  handler: async (ctx, args) => {
    const snap = await ctx.runMutation(internal.game.gather, { roomId: args.roomId, r: args.r });
    if (!snap.room) return;
    const players = snap.players.map(toLite);
    const priorRounds = snap.rounds
      .filter((rr: any) => rr.r < args.r && rr.spec)
      .sort((a: any, b: any) => a.r - b.r);
    const priorTopics = priorRounds.map((rr: any) => rr.spec.topic);
    const priorAnswers = priorRounds.map((rr: any) => {
      const byName: Record<string, string> = {};
      snap.allMoves
        .filter((m: any) => m.r === rr.r && m.answer)
        .forEach((m: any) => {
          const p = snap.players.find((pp: any) => pp._id === m.playerId);
          if (p) byName[p.name] = m.answer;
        });
      return byName;
    });
    const spec = await gemma.writeRound(
      logger(ctx, args.roomId),
      args.r,
      snap.room.spice,
      Math.max(players.length, 2),
      priorTopics,
      priorAnswers,
    );
    await ctx.runMutation(internal.game.roundReady, { roomId: args.roomId, r: args.r, spec });
  },
});

export const draftLiesAction = internalAction({
  args: { roomId: v.id('rooms'), moveId: v.id('moves'), r: v.number(), answer: v.string() },
  handler: async (ctx, args) => {
    const snap = await ctx.runMutation(internal.game.gather, { roomId: args.roomId, r: args.r });
    if (!snap.room || !snap.round?.spec) return;
    const lies = await gemma.draftLies(
      logger(ctx, args.roomId),
      snap.round.spec,
      args.answer,
      snap.room.spice,
      snap.players.length,
    );
    await ctx.runMutation(internal.game.saveLieDrafts, { moveId: args.moveId, lies });
  },
});

export const revealAction = internalAction({
  args: { roomId: v.id('rooms'), r: v.number() },
  handler: async (ctx, args) => {
    const snap = await ctx.runMutation(internal.game.gather, { roomId: args.roomId, r: args.r });
    if (!snap.room || !snap.round?.spec) return;
    const spec = snap.round.spec;
    const players: PlayerLite[] = snap.players.map(toLite);
    const sealedMoves = snap.moves.filter((m: any) => m.sealedAt);

    const spots: SpotLite[] = sealedMoves.map((m: any) => {
      const p = snap.players.find((pp: any) => pp._id === m.playerId)!;
      return {
        sid: m.playerId,
        name: p.name,
        sym: p.sym,
        truth: m.answer,
        decoys: m.decoys || [],
        planted: m.planted ?? null,
        selfMove: m.selfMove ?? null,
      };
    });

    // everyone's guesses, straight from their moves
    const guesses: Record<string, string | undefined> = {};
    players.forEach((g) => {
      spots.forEach((sp) => {
        if (g.id === sp.sid) return;
        const m = snap.moves.find((mm: any) => mm.playerId === g.id);
        guesses[`${g.id}|${sp.sid}`] = m?.guesses?.[sp.sid];
      });
    });

    // Gemma judges typed rounds by meaning
    let judgeFn;
    if (spec.archetype === 'type') {
      const pairsList: { truth: string; guess: string | null }[] = [];
      const keys: string[] = [];
      players.forEach((g) =>
        spots.forEach((sp) => {
          if (g.id === sp.sid) return;
          keys.push(`${g.id}|${sp.sid}`);
          pairsList.push({ truth: sp.truth, guess: guesses[`${g.id}|${sp.sid}`] || null });
        }),
      );
      const results = await gemma.judgeBatch(logger(ctx, args.roomId), spec.q, pairsList, snap.room.spice, players.length);
      const map: Record<string, (typeof results)[number]> = {};
      keys.forEach((k, i) => (map[k] = results[i]));
      judgeFn = (guess: string | undefined, truth: string, gid: string, sid: string) =>
        map[`${gid}|${sid}`] ?? { score: 0, ok: false, half: false, note: 'No answer came in before the timer.' };
    }

    const { cards, scores, deltas } = computeReveal(
      { r: args.r, archetype: spec.archetype, players, spots, guesses, judge: judgeFn },
      snap.room.scores,
    );

    const { lines, mid } = await gemma.revealLines(
      logger(ctx, args.roomId),
      cards,
      snap.room.spice,
      players.length,
      args.r,
      spec.aboutTemplate,
    );
    cards.forEach((c, i) => {
      c.gemma = lines[i] || fallbackCommentary(spec.archetype, c);
    });

    // cluster overlaps across everything played so far
    const answersByRound: Record<string, string>[] = [];
    for (let rr = 0; rr <= args.r; rr++) {
      const byId: Record<string, string> = {};
      snap.allMoves
        .filter((m: any) => m.r === rr && m.answer)
        .forEach((m: any) => (byId[m.playerId] = m.answer));
      answersByRound.push(byId);
    }
    const qs = snap.rounds
      .filter((rr: any) => rr.spec)
      .sort((a: any, b: any) => a.r - b.r)
      .map((rr: any) => ({ q: rr.spec.q }));
    const pairs = await gemma.clusterPairs(
      logger(ctx, args.roomId),
      players.map((p) => ({ id: p.id, name: p.name })),
      qs,
      answersByRound,
      snap.room.spice,
      fallbackPairs(players, answersByRound),
    );

    await ctx.runMutation(internal.game.finishReveal, {
      roomId: args.roomId,
      r: args.r,
      cards,
      scores,
      deltas,
      mid,
      pairs,
    });
  },
});

type ShareResult = { note: string; plan: { when: string; title: string; why: string } } | null;

export const shareAction = action({
  args: { roomId: v.id('rooms'), deviceId: v.string() },
  handler: async (ctx, args): Promise<ShareResult> => {
    const snap: any = await ctx.runMutation(internal.game.gather, { roomId: args.roomId, r: 0 });
    if (!snap.room) return null;
    const me = snap.players.find((p: any) => p.deviceId === args.deviceId);
    if (!me) return null;
    if (me.shareNote) return { note: me.shareNote, plan: me.sharePlan };
    const pairs: Record<string, string[]> = snap.room.pairs || {};
    let best: { name: string; items: string[] } | null = null;
    let bs = 0;
    snap.players
      .filter((p: any) => p._id !== me._id)
      .forEach((p: any) => {
        const items = pairs[pairKey(me._id, p._id)] || [];
        if (items.length > bs) {
          bs = items.length;
          best = { name: p.name, items };
        }
      });
    const all = Array.from(new Set(Object.values(pairs).flat()));
    const card = await gemma.shareCard(
      logger(ctx, args.roomId),
      me.name,
      best,
      all,
      snap.room.spice,
      snap.players.length,
    );
    await ctx.runMutation(internal.game.saveShare, { playerId: me._id, note: card.note, plan: card.plan });
    return card;
  },
});

export const noticeAction = action({
  args: {
    name: v.string(),
    played: v.number(),
    metNames: v.array(v.string()),
    overlaps: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await gemma.homeNotice(logger(ctx), args.name, args.played, args.metNames, args.overlaps);
  },
});

export const openerAction = action({
  args: { name: v.string(), items: v.array(v.string()) },
  handler: async (ctx, args) => {
    return await gemma.nodeOpener(logger(ctx), args.name, args.items);
  },
});
