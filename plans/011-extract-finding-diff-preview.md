# 011 — Extract finding diff preview logic

- **Status**: DONE
- **Commit**: `4c1804f`
- **Worktree snapshot**: `99c3495697f4f9fd94775b41b9a64c2f6a9372c7a24f45f80995c95f2813f1e5`
- **Severity**: MEDIUM
- **Category**: Maintainability & architecture
- **Rule**: Beyond the scan
- **Estimated scope**: 4 files, focused refactor with helper tests

## Problem

`src/features/reviews/components/EditableFindingCard.tsx:11-276` combines comment editing/publishing UI with patch reconstruction:

```tsx
export function EditableFindingCard(...) { /* editor and actions */ }
function FindingDiffPreview(...) { /* selects preview */ }
type FocusedPatchLine = ...
function getFocusedFileDiff(...) { ... }
function findHunkForRightLine(...) { ... }
function getFocusedPatchLines(...) { ... }
function buildFocusedPatch(...) { ... }
function formatHunkRange(...) { ... }
```

The patch calculations determine which line a reviewer sees before publishing but are private, untested, and coupled to changes in button/text-area UI.

## Target

Create explicit presentation and domain boundaries:

```text
components/finding-diff/
  FindingDiffPreview.tsx
  findingDiffPreview.ts
  findingDiffPreview.test.ts
```

`EditableFindingCard.tsx` should own editable comment state, publish/discard actions, metadata, and composition. `FindingDiffPreview.tsx` should select between a diff and code-snippet fallback. `findingDiffPreview.ts` should contain only pure patch-window calculations.

## Repo conventions to follow

- Keep `DiffFileView` rendering in a `.tsx` component.
- Follow `diff-viewer/diffDisplay.ts` for pure diff utility naming and return style.
- Use existing Vitest conventions from `src/electron/services/*.test.ts`; tests remain Node-only.

## Steps

1. Move `FocusedPatchLine`, `getFocusedFileDiff`, hunk selection, focused-line selection, patch construction, range formatting, and line-number helpers to `findingDiffPreview.ts`.
2. Export only the smallest useful public helper (`getFocusedFileDiff`); leave internal calculation helpers private unless tests require direct boundary coverage.
3. Move `FindingDiffPreview` and `CodeSnippetBlock` to `FindingDiffPreview.tsx` and import the pure helper.
4. Update `EditableFindingCard.tsx` to import and render `FindingDiffPreview`; remove all patch metadata imports no longer needed there.
5. Add helper tests for context windows, addition/deletion groups, line outside a hunk, target line absent from additions, single-line hunk ranges, renamed files, and first/last-line boundaries.
6. Preserve existing inline-comment matching and fallback behavior.

## Boundaries

- Do NOT alter preview radius (`3`), diff style, line annotations, publish payloads, or visible UI.
- Do NOT add component rendering tests or browser dependencies.
- Do NOT move generic patch parsing out of `diff-viewer/diffDisplay.ts` in this plan.
- STOP on source drift from the stamped snapshot.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `npx react-doctor@latest --scope changed` does not regress.
- **Helper tests**: the focused patch fixture tests pass under Node Vitest.
- **Behavior check**: Generate findings on added, modified, and renamed files; confirm the same focused lines render and publishing still targets the same GitHub line.
- **Done when**: editor UI and patch reconstruction have separate owners, patch logic is covered by focused tests, and behavior is unchanged.
