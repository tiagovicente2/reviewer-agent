# 008 — Split review detail tabs by responsibility

- **Status**: DONE
- **Commit**: `4c1804f`
- **Worktree snapshot**: `99c3495697f4f9fd94775b41b9a64c2f6a9372c7a24f45f80995c95f2813f1e5`
- **Severity**: MEDIUM
- **Category**: Maintainability & architecture
- **Rule**: `react-doctor/no-multi-comp`
- **Estimated scope**: 7–9 files, behavior-preserving refactor

## Problem

`src/features/reviews/components/ReviewDetailTabs.tsx` is 415 lines and declares three public tabs plus Summary-specific loading, reviewer rendering, avatar rendering, and reviewer-domain helpers:

```tsx
// current boundaries
export function ReviewTab(...)            // line 15
export function CodeTab(...)              // line 81
export function SummaryTab(...)           // line 187
function SummaryTabSkeleton()             // line 232
function ReviewersPanel(...)              // line 293
function ReviewerAvatar(...)              // line 334
function getSummaryReviewers(...)         // line 373
function getReviewerStatus(...)           // line 402
```

React Doctor reports five `no-multi-comp` diagnostics in this file. The Summary skeleton that prompted this audit is coupled to unrelated Code and Review tab imports, making each tab harder to locate and change.

## Target

Canonical `react-doctor/no-multi-comp` fix recipe:

> Move each secondary component into its own file and import it, keeping one component per file. If extra components are tightly-coupled private helpers of a single exported component, co-locate them but keep the public surface to one component, or group them as a barrel/feature module so the intent is explicit. Preserve behavior and do not suppress the rule.

Create this ownership structure:

```text
src/features/reviews/components/review-tabs/
  ReviewTab.tsx
  CodeTab.tsx
  summary/
    SummaryTab.tsx
    SummaryTabSkeleton.tsx
    ReviewersPanel.tsx
    reviewerStatus.ts
    reviewerStatus.test.ts
```

`ReviewerAvatar` may stay private in `ReviewersPanel.tsx` because it is a tightly coupled implementation detail. `SummaryTab.tsx` should own only loaded/error state selection and layout composition; `SummaryTabSkeleton.tsx` should own only loading presentation. Delete `ReviewDetailTabs.tsx` after all imports move.

## Repo conventions to follow

- Keep feature components below `src/features/reviews/components`.
- Follow the existing focused component pattern in `changed-files-tree/ChangedFilesTree.tsx` and `diff-viewer/DiffViewer.tsx`.
- Continue using Panda JSX props and semantic color tokens.
- Import tab components directly from their files; do not add a broad barrel solely to preserve the old mixed module.

## Steps

1. Move `ReviewTab` unchanged into `review-tabs/ReviewTab.tsx`, including only its required imports and prop type.
2. Move `CodeTab` unchanged into `review-tabs/CodeTab.tsx`; preserve selected-file ownership and all loading/retry behavior.
3. Move `SummaryTab` into `review-tabs/summary/SummaryTab.tsx` and import its loading UI from `SummaryTabSkeleton.tsx`.
4. Move the skeleton and `skeletonClassName` into `SummaryTabSkeleton.tsx`; preserve `aria-live`, `role="status"`, reduced-motion behavior, dimensions, and final-layout geometry.
5. Move `ReviewersPanel` and private `ReviewerAvatar` into `ReviewersPanel.tsx`.
6. Move `SummaryReviewer`, `getSummaryReviewers`, and `getReviewerStatus` into `reviewerStatus.ts`. Export explicit return types so UI color/status contracts remain visible.
7. Add `reviewerStatus.test.ts` covering pending requests, approved reviews, changes requested, latest submitted review selection, pending-request precedence, team identities, and empty detail. Do not add component rendering tests.
8. Update `ReviewDetail.tsx` to import the three tabs directly, then delete `ReviewDetailTabs.tsx`.
9. Re-read the diff and remove any duplicate imports or renamed behavior.

## Boundaries

- Do NOT change visual output, spacing, loading messages, tab behavior, or public `ReviewDetail` props.
- Do NOT alter diff parsing or file-selection behavior.
- Do NOT add a frontend component-test dependency.
- Do NOT create one-file abstractions for static JSX fragments unless they own a named responsibility above.
- STOP if the cited source no longer matches commit `4c1804f` plus the worktree snapshot/excerpts; report drift instead of improvising.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears all `no-multi-comp` diagnostics formerly reported for `ReviewDetailTabs.tsx` without lowering the score.
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
- **Helper tests**: `reviewerStatus.test.ts` passes in the existing Node Vitest environment.
- **Behavior check**: Open a PR and verify Summary loaded/loading states, reviewer statuses/avatars, first-file Code selection, diff expansion, Review generation output, and tab switching are unchanged.
- **Done when**: each tab has explicit ownership, the skeleton is outside the Summary implementation file, pure reviewer logic is tested, diagnostics clear, and behavior is unchanged.
