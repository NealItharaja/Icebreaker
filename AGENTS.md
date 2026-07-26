# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Venn

A real-time multiplayer party game for college students — new students stop
feeling lonely by playing 3 fast rounds with the people on their floor.
Showcases **Gemma 4 via OpenRouter** (`google/gemma-4-31b-it`): it writes every
round's question + chips live, drafts decoy lies around each sealed answer,
judges typed guesses by meaning,
calls the reveal in the host's spice, clusters overlaps, and writes each player
a private card + plan. Design source: claude.ai/design project
`1d971864-092b-4100-93b6-9b4454c24e4d` (`Venn.dc.html`, "Organic" system).

## Architecture

- **Convex backend** (deployment `woozy-yak-834`, url in `.env.local`):
  - `convex/schema.ts` — rooms (4-digit numeric codes, unique among active),
    players (anonymous deviceId identity, real humans only — no AI players),
    rounds, moves, reveals, gemmaLog.
  - `convex/lib.ts` — pure logic: neutral reveal computation, fallback
    judge/cluster/rounds, timers (ASK_MS / guessMs).
  - `convex/gemma.ts` — OpenRouter client (key = Convex env
    `OPENROUTER_API_KEY`, never in the app bundle; `reasoning: {enabled:false}`
    always) + all prompts; logs to gemmaLog for the Behind-the-model sheet.
  - `convex/game.ts` — mutations/queries; server-authoritative phases
    lobby→ask→guess→judging→reveal→stand→final; deadlines enforced by
    `ctx.scheduler` (`checkDeadline`); one reactive `roomState` query drives
    the whole client.
  - `convex/ai.ts` — actions: writeRoundAction, draftLiesAction,
    revealAction (judge+lines+cluster), shareAction, noticeAction,
    openerAction. Watchdogs (rescueRound / rescueJudging) recover any room
    whose action died mid-flight.
- **Client**: `src/game/room.tsx` (RoomProvider: persisted deviceId + active
  roomId, `useRoom()` = the reactive query, `useCountdown`). Screens in
  `src/app`, game views in `src/components/game`. Skeleton shimmer components
  (`src/components/Skeleton.tsx`) show wherever Gemma is writing — no
  full-screen waits. Floor map persists real co-players (by deviceId key) in
  AsyncStorage (`src/store/AppStore.tsx`).

## Conventions / gotchas

- Gemma 4 on OpenRouter is a reasoning model — always disable reasoning or
  small max_tokens returns null content. Latency is spiky (2–25s); every call
  site has waiting UX (skeletons); client never calls OpenRouter directly.
- Never present two RN `Modal`s in the same frame (close, wait ~500ms, open).
- Run: `npx convex dev` (backend watch) + `npx expo start --ios` (port 8081 is
  often taken by another project — use 8082). Typecheck: `npx tsc --noEmit`;
  backend push also typechecks: `npx convex dev --once`.
- Two-simulator testing: boot a second sim, install Expo Go from
  `~/.expo/ios-simulator-app-cache`, drive with `maestro --udid <id>`.
