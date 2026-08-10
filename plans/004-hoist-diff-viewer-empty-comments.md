# 004 — Hoist DiffViewer empty comments default

- **Status**: TODO
- **Commit**: 44835be
- **Severity**: MEDIUM
- **Category**: Performance
- **Rule**: react-doctor/rerender-memo-with-default-value
- **Estimated scope**: 1 file, tiny change

## Problem

`DiffViewer` is wrapped in `memo`, but the `inlineComments = []` default allocates a new array whenever callers omit the prop:

```tsx
// src/features/reviews/components/diff-viewer/DiffViewer.tsx:17 — current
export const DiffViewer = memo(function DiffViewer({
	inlineComments = [],
	onSelectFile,
	patch,
	selectedFilePath,
	settings,
}: DiffViewerProps) {
```

This is on the expensive diff rendering path. A fresh default reference can defeat memoization and dependency equality.

## Target

Canonical recipe from `react-doctor/rerender-memo-with-default-value`:

> Hoist the default to module scope: `const EMPTY_ITEMS: readonly Item[] = [];` then destructure as `({ items = EMPTY_ITEMS })`. The same reference is reused across renders, restoring referential equality for memoized children and dependency arrays.

Apply it here:

```tsx
// target
const EMPTY_INLINE_COMMENTS: readonly ReviewInlineComment[] = []

export const DiffViewer = memo(function DiffViewer({
	inlineComments = EMPTY_INLINE_COMMENTS,
	onSelectFile,
	patch,
	selectedFilePath,
	settings,
}: DiffViewerProps) {
```

If TypeScript complains because `inlineComments` is passed to APIs requiring mutable `ReviewInlineComment[]`, use:

```tsx
const EMPTY_INLINE_COMMENTS: ReviewInlineComment[] = []
```

## Repo conventions to follow

- Keep module-scope constants near type definitions in `src/features/reviews/components/diff-viewer/DiffViewer.tsx`.
- Preserve the existing `memo(function DiffViewer...)` style.
- Imitate existing module constants such as `src/features/reviews/components/diff-viewer/DiffDisplay.tsx:20`.

## Steps

1. Add `EMPTY_INLINE_COMMENTS` at module scope after `type DiffViewerProps`.
2. Replace `inlineComments = []` with `inlineComments = EMPTY_INLINE_COMMENTS`.
3. Do not change parsing, expansion, scrolling, or diff rendering behavior.

## Boundaries

- Do NOT memoize unrelated props.
- Do NOT change `DiffViewerProps` public API unless TypeScript requires the readonly type adjustment.
- STOP if `DiffViewer.tsx` has drifted from commit `44835be`.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears `react-doctor/rerender-memo-with-default-value` and the score does not regress.
  - `pnpm run typecheck`
  - `pnpm run lint`
- **Behavior check**: Open a PR, switch to the Code tab, expand/collapse diff files, select files from the changed-files tree, and confirm diff scrolling/comments still work. Use React DevTools Profiler or “Highlight updates” to confirm omitted `inlineComments` no longer creates a fresh default array path.
- **Done when**: the diagnostic is clear and diff viewer behavior is unchanged.
