# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Venn

A same-room party game for college students — new students stop feeling lonely by
playing 3 fast rounds with the people on their floor. Showcases **Gemma 4 via
OpenRouter** (`google/gemma-4-31b-it`): it writes every round's question live,
drafts decoy lies relevant to each sealed answer, judges typed guesses by meaning,
calls the reveal in the host's chosen spice, clusters overlaps, and writes each
player a private card + one concrete plan. Design source: claude.ai/design project
`1d971864-092b-4100-93b6-9b4454c24e4d` (`Venn.dc.html`, "Organic" design system).

## Architecture

- Expo SDK 57 + expo-router (routes in `src/app`), reanimated 4, react-native-svg.
- No auth, no backend: friends are simulated bots (`src/game/data.ts`) so one phone
  can play solo. AsyncStorage persists profile / world (floor-map overlaps) / plans.
- `src/game/engine.ts` — pure game logic (scoring, bot guesses, overlap geometry).
- `src/game/GameContext.tsx` — controller class + useSyncExternalStore; all async
  continuations are epoch-guarded. Phases: lobby → ask → guess → judging → reveal →
  stand → final → share.
- `src/gemma/service.ts` — every Gemma task, live-first with a deterministic
  offline fallback; `src/gemma/client.ts` logs real prompts/latency/tokens for the
  in-app "Behind the model" sheet.
- Theme tokens in `src/theme/tokens.ts` (light + dark), Caprasimo + Figtree fonts.

## Conventions / gotchas

- API key: `.env` (`EXPO_PUBLIC_OPENROUTER_API_KEY`) or pasted at runtime in the
  Settings sheet (stored in AsyncStorage). No key → offline mode, still playable.
- Never present two RN `Modal`s in the same frame (close one, `setTimeout` ~500ms,
  open the next) — iOS wedges and swallows all touches otherwise.
- Run: `npx expo start --ios` (port 8081 may be taken by another project — use 8082).
- Typecheck: `npx tsc --noEmit`.
