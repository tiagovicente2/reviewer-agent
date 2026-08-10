# 012 — Separate review transcript parsing and rendering

- **Status**: DONE
- **Commit**: `4c1804f`
- **Worktree snapshot**: `99c3495697f4f9fd94775b41b9a64c2f6a9372c7a24f45f80995c95f2813f1e5`
- **Severity**: LOW
- **Category**: Maintainability & architecture
- **Rule**: Beyond the scan
- **Estimated scope**: 4 files, focused refactor with helper tests

## Problem

`src/features/reviews/components/ReviewProgress.tsx:6-313` owns animation timing, scroll-follow behavior, transcript parsing, timestamps, line rendering, and tone configuration:

```tsx
export function ReviewProgress(...) { /* timer + follow + layout */ }
function getTranscriptLines(...) { ... }
function parseTranscriptLine(...) { ... }
function TranscriptLine(...) { ... }
const transcriptLineTone = { ... }
```

Parsing streamed agent output is domain logic with multiple prefixes and fallbacks, but it cannot be tested independently while private in the rendering file.

## Target

Create:

```text
components/review-progress/
  ReviewTranscript.tsx
  reviewTranscript.ts
  reviewTranscript.test.ts
```

`ReviewProgress.tsx` should own the animated frame, choice between empty/transcript states, and top-level layout. `ReviewTranscript.tsx` should own scroll-follow behavior and row rendering. `reviewTranscript.ts` should own line models, parsing, timestamp assignment, and tone metadata needed by rendering.

## Repo conventions to follow

- Preserve the current ref-based timestamp stability and scroll-follow semantics.
- Keep pure parsing free of React imports.
- Use Node Vitest for parser tests; do not add component rendering tests.

## Steps

1. Move `TranscriptLineKind`, `TranscriptLineModel`, `parseTranscriptLine`, `getTranscriptLines`, timestamp formatting, and tone mapping into `reviewTranscript.ts`.
2. Accept a timestamp provider or timestamp map in the pure API so tests can use deterministic times instead of mocking global time.
3. Add parser tests for `::` status, Thought, Finding with/without detail, Summary, Check with/without detail, Generate prompt, generic output, blank-line filtering, stable IDs, and timestamp reuse.
4. Move transcript scrolling and `TranscriptLine` rendering into `ReviewTranscript.tsx`; pass parsed lines or the raw output plus timestamp map through a narrow prop contract.
5. Keep `ReviewProgress` responsible for the 500ms frame interval and empty-state message.
6. Keep `ReviewFrame` private in `ReviewProgress.tsx` unless extraction leaves three or more meaningful components in that file.

## Boundaries

- Do NOT change accepted transcript syntax, labels, colors, timestamps, animation cadence, or auto-follow threshold (`8px`).
- Do NOT add browser/component tests or dependencies.
- Do NOT turn all transcript state into one opaque hook.
- STOP on source drift from the stamped snapshot.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `npx react-doctor@latest --scope changed` does not regress.
- **Helper tests**: deterministic transcript parser tests pass under Node Vitest.
- **Behavior check**: Generate a review, verify each streamed line type retains its label/tone, timestamps remain stable, follow-scroll stops when scrolled up, and resumes at the bottom.
- **Done when**: parsing, transcript rendering, and progress animation have distinct owners with unchanged behavior.
