import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const roundSpec = v.object({
  archetype: v.string(), // tap | type | whose
  topic: v.string(),
  intro: v.string(),
  q: v.string(),
  hint: v.string(),
  chips: v.array(v.string()),
  selfQ: v.string(),
  selfHint: v.string(),
  aboutMe: v.string(),
  aboutTemplate: v.string(),
  aboutHint: v.string(),
  live: v.boolean(),
});

export default defineSchema({
  rooms: defineTable({
    code: v.string(), // 4 digits, unique among active rooms
    spice: v.string(),
    hostDevice: v.string(),
    phase: v.string(), // lobby | ask | guess | judging | reveal | stand | final | closed
    r: v.number(),
    deadline: v.union(v.number(), v.null()),
    pendingClose: v.boolean(), // humans done, waiting on AI moves
    scores: v.record(v.string(), v.number()), // playerId -> total
    deltas: v.record(v.string(), v.number()),
    pairs: v.record(v.string(), v.array(v.string())), // "a|b" sorted playerIds -> shared labels
    mid: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_code', ['code'])
    .index('by_active', ['active', 'createdAt']),

  players: defineTable({
    roomId: v.id('rooms'),
    deviceId: v.string(), // real device uuid, or "ai:<seed>" for seat-fillers
    name: v.string(),
    sym: v.number(),
    isAi: v.boolean(),
    order: v.number(),
    shareNote: v.optional(v.string()),
    sharePlan: v.optional(v.object({ when: v.string(), title: v.string(), why: v.string() })),
  })
    .index('by_room', ['roomId', 'order'])
    .index('by_room_device', ['roomId', 'deviceId'])
    .index('by_device', ['deviceId']),

  rounds: defineTable({
    roomId: v.id('rooms'),
    r: v.number(),
    status: v.string(), // writing | ready
    spec: v.optional(roundSpec),
  }).index('by_room_r', ['roomId', 'r']),

  moves: defineTable({
    roomId: v.id('rooms'),
    r: v.number(),
    playerId: v.id('players'),
    answer: v.optional(v.string()),
    sealedAt: v.optional(v.number()),
    lieDrafts: v.optional(v.array(v.string())), // gemma-drafted lies to pick from (tap round)
    decoys: v.optional(v.array(v.string())),
    planted: v.optional(v.union(v.string(), v.null())),
    selfMove: v.optional(v.union(v.string(), v.null())),
    readyAt: v.optional(v.number()), // sealed + self move done
    guesses: v.optional(v.record(v.string(), v.string())), // spotlight playerId -> value
    lockedAt: v.optional(v.number()),
  })
    .index('by_room_r', ['roomId', 'r'])
    .index('by_room_r_player', ['roomId', 'r', 'playerId']),

  reveals: defineTable({
    roomId: v.id('rooms'),
    r: v.number(),
    cards: v.any(), // neutral cards; client renders "you" per viewer
  }).index('by_room_r', ['roomId', 'r']),

  // real telemetry for the "Behind the model" sheet
  gemmaLog: defineTable({
    task: v.string(),
    model: v.string(),
    system: v.string(),
    user: v.string(),
    output: v.string(),
    ms: v.number(),
    tokens: v.number(),
    mode: v.string(), // live | fallback
    at: v.number(),
  }).index('by_at', ['at']),
});
