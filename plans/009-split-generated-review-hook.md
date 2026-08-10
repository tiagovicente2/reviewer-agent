# 009 — Split generated review workflows behind a facade

- **Status**: DONE
- **Commit**: `4c1804f`
- **Worktree snapshot**: `99c3495697f4f9fd94775b41b9a64c2f6a9372c7a24f45f80995c95f2813f1e5`
- **Severity**: MEDIUM
- **Category**: Maintainability & architecture
- **Rule**: Beyond the scan
- **Estimated scope**: 5–7 files, medium refactor

## Problem

`src/features/reviews/hooks/useGeneratedReview.ts:42-349` is a 349-line hook that owns unrelated workflows:

```tsx
const [generatedReview, setGeneratedReview] = useState(...)
// generation state/message/output/job polling
// finding publish/discard state
// unused publish-all state and callback
// approve/request-changes submission state
```

It contains ten state values, generation restore/poll effects, generation RPC orchestration, finding mutation and publication, and final review submission. A change to GitHub submission requires navigating generation polling internals, while unused `publishAll` and `publishingAll` remain in its public return value with no callers.

## Target

Keep `useGeneratedReview` as a compatibility facade while composing focused hooks:

```ts
export function useGeneratedReview(params: UseGeneratedReviewParams) {
  const generation = useReviewGeneration(params)
  const findings = useFindingPublishing({
    detail: params.detail,
    generatedReview: generation.generatedReview,
    setGeneratedReview: generation.setGeneratedReview,
  })
  const submission = useReviewSubmission({
    detail: params.detail,
    generatedReview: generation.generatedReview,
  })

  return { ...generation.publicState, ...findings, ...submission }
}
```

Suggested files:

```text
hooks/generated-review/
  reviewGenerationUtils.ts
  reviewGenerationUtils.test.ts
  useReviewGeneration.ts
  useFindingPublishing.ts
  useReviewSubmission.ts
```

The facade must preserve current caller names. Remove `publishAll`/`publishingAll` because repository search confirms they are returned but never consumed.

## Repo conventions to follow

- Follow cancellation and `getErrorMessage` patterns already used in `usePullRequestDiff.ts`.
- Keep RPC calls in hooks, not components.
- Keep pure identity/output/comment matching helpers outside hook files so they can be tested without a DOM harness.
- Continue using `useToast` only in workflows that display a toast.

## Steps

1. Move `reviewPromptLabel`, `getLocalReviewProgressOutput`, `isFindingInlineComment`, and `getPullRequestIdentity` into `reviewGenerationUtils.ts` with explicit exports.
2. Add Node Vitest tests for local progress formatting, PR identity, and exact inline-comment matching. Do not add rendered hook/component tests or browser-test dependencies.
3. Extract generated-review restoration, job polling, `completeGeneration`, and `generateReview` into `useReviewGeneration.ts`. It should own generation state and expose the generated review plus a narrowly scoped state updater needed by finding discard.
4. Extract `publishFinding` and `discardFinding` into `useFindingPublishing.ts`. Remove the unused `publishingAll` state and `publishAll` callback entirely.
5. Extract `submitReview` and `submittingReviewEvent` into `useReviewSubmission.ts`.
6. Reduce `useGeneratedReview.ts` to parameter typing, composition, and the existing compatibility return shape.
7. Keep `ReviewDetail.tsx` behavior and call site unchanged except for any removed unused return members.
8. Check cancellation, dependency arrays, and toast behavior workflow by workflow after extraction.

## Boundaries

- Do NOT change RPC payloads, polling cadence, saved-review restoration, toast text, or publication semantics.
- Do NOT expose raw state setters broadly; pass only the generated-review update capability required for discard.
- Do NOT add a frontend test harness. Test pure helpers with existing Vitest.
- Do NOT move workflows into `ReviewDetail.tsx`.
- STOP if source differs from the stamped worktree excerpts.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `npx react-doctor@latest --scope changed` does not lower the score or add hook diagnostics.
- **Helper tests**: focused utility tests pass under Node Vitest.
- **Behavior check**: Restore a saved draft, start generation, observe streamed progress, publish and discard one finding, approve, request changes, and verify errors/toasts remain unchanged.
- **Done when**: each workflow has one hook owner, the facade remains stable, unused publish-all code is gone, and behavior is unchanged.
