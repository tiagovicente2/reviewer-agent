# 018 — Make the review workspace adaptive

- **Status**: DONE
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Accessibility
- **Rule**: Beyond the scan
- **Estimated scope**: 6 files, medium responsive-layout change plus one pure-helper test

## Problem

At the default 1280 px desktop width, the inbox consumes 36% of the window before the Code tab reserves another fixed 24 rem for changed files. The diff—the primary Code-tab task—gets the remainder.

```tsx
// src/app/MainReviewScreen.tsx:77-84 — current
return (
  <Grid
    gridTemplateColumns={{
      base: 'minmax(0, 1fr)',
      lg: 'clamp(24rem, 36vw, 34rem) minmax(0, 1fr)',
    }}
    h="100%"
    minH="0"
    minW="0"
```

```tsx
// src/features/reviews/components/review-tabs/CodeTab.tsx:46-53 — current
return (
  <Grid
    gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: '24rem minmax(0, 1fr)' }}
    gap="5"
    h="100%"
    minH="0"
    minW="0"
    overflow="hidden"
  >
```

The changed-file card also remains fixed at 24 rem once the `xl` breakpoint is active. At 1280 px, the inbox is about 461 px wide; after detail padding, the 384 px file tree, and gaps, the diff can become narrower than either navigation pane. Between the single-column and `xl` layouts, the panes jump rather than adapting to available room.

Neither pane can be collapsed or resized. Users reviewing a wide diff cannot trade navigation space for code space, and users who need a larger tree cannot expand it. This is a high-frequency workspace issue and becomes more severe with zoom, long file names, or split-screen use.

The current inbox boundary is purely visual:

```tsx
// src/features/reviews/components/ReviewInbox.tsx:53-62 — current
<Box
  borderRightWidth={{ base: '0', lg: '1px' }}
  bg="gray.2"
  h={{ base: 'auto', lg: '100%' }}
  minH="0"
  overflowY={{ base: 'visible', lg: 'auto' }}
  p="5"
>
```

The React Doctor report at `/tmp/reviewer-agent-all-plans-doctor.json` contains no layout diagnostic. This is a senior-audit finding based on the rendered geometry; confirm it at the stamped commit rather than treating it as a scanner failure.

## Target

Use compact defaults and independent, collapsible, keyboard-resizable left panes. The target constants are exact:

```ts
// src/features/reviews/components/workspaceLayoutUtils.ts — target
export const inboxPane = { defaultWidth: 288, minWidth: 240, maxWidth: 384, step: 16 } as const
export const filesPane = { defaultWidth: 224, minWidth: 176, maxWidth: 320, step: 16 } as const

export function clampPaneWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(maxWidth, Math.max(minWidth, width))
}

export function resizePaneFromPointer(
  startWidth: number,
  startClientX: number,
  clientX: number,
  minWidth: number,
  maxWidth: number,
) {
  return clampPaneWidth(startWidth + clientX - startClientX, minWidth, maxWidth)
}

export function resizePaneFromKey(
  width: number,
  key: string,
  { minWidth, maxWidth, step }: { minWidth: number; maxWidth: number; step: number },
) {
  if (key === 'Home') return minWidth
  if (key === 'End') return maxWidth
  if (key === 'ArrowLeft') return clampPaneWidth(width - step, minWidth, maxWidth)
  if (key === 'ArrowRight') return clampPaneWidth(width + step, minWidth, maxWidth)
  return width
}
```

Add a local `PaneResizeHandle` in the same workspace component area. Its public contract and rendered semantics must be:

```tsx
// target contract and semantics
<PaneResizeHandle
  ariaLabel="Resize review inbox"
  controls="review-inbox-pane"
  limits={inboxPane}
  onChange={setInboxWidth}
  value={inboxWidth}
/>

<div
  role="separator"
  aria-label={ariaLabel}
  aria-controls={controls}
  aria-orientation="vertical"
  aria-valuemin={limits.minWidth}
  aria-valuemax={limits.maxWidth}
  aria-valuenow={value}
  tabIndex={0}
/>
```

The handle must use pointer capture from `pointerdown` through `pointermove`/`pointerup`, clamp every update, and support Left/Right by 16 px plus Home/End. It must have a visible hover/focus treatment and an 8 px hit area without adding a package.

`MainReviewScreen` owns `inboxWidth` and `inboxCollapsed`. At `lg` and above, use the CSS custom property `--inbox-width` and these exact grid states:

```tsx
// src/app/MainReviewScreen.tsx — target shape
<Grid
  style={{ '--inbox-width': `${inboxWidth}px` } as React.CSSProperties}
  gridTemplateColumns={{
    base: 'minmax(0, 1fr)',
    lg: inboxCollapsed
      ? '2.5rem minmax(0, 1fr)'
      : 'var(--inbox-width) 0.5rem minmax(0, 1fr)',
  }}
  h="100%"
  minH="0"
  minW="0"
  overflow={{ base: 'auto', lg: 'hidden' }}
>
```

When expanded, the inbox header has an icon/text button named **Collapse review inbox**. When collapsed, retain a 2.5 rem rail with a button named **Show review inbox**; do not unmount the selected review/detail area. Below `lg`, do not render a drag handle: keep the existing single-column flow and expose the collapse control so the inbox can be hidden before reading the detail.

`CodeTab` independently owns `filesWidth` and `filesCollapsed`. At `lg` and above inside the detail area, use:

```tsx
// src/features/reviews/components/review-tabs/CodeTab.tsx — target shape
<Grid
  style={{ '--files-width': `${filesWidth}px` } as React.CSSProperties}
  gridTemplateColumns={{
    base: 'minmax(0, 1fr)',
    lg: filesCollapsed
      ? '2.5rem minmax(0, 1fr)'
      : 'var(--files-width) 0.5rem minmax(0, 1fr)',
  }}
  gap={{ base: '3', lg: '0' }}
  h="100%"
  minH="0"
  minW="0"
  overflow="hidden"
>
```

The changed-files card title area gets **Collapse changed files**; its collapsed rail gets **Show changed files**. Below `lg`, keep the tree above the diff with a capped height and no drag handle. The diff card must always be `minmax(0, 1fr)`, `minW="0"`, and the only pane that absorbs remaining width.

At a 1280 px window with both panes expanded at defaults, the inbox is 288 px and changed files is 224 px, leaving the majority of the detail workspace to the diff. Resizing is session-local; do not add persistence in this plan.

## Repo conventions to follow

- Keep state with the nearest layout owner: inbox width in `src/app/MainReviewScreen.tsx`, changed-files width in `src/features/reviews/components/review-tabs/CodeTab.tsx`.
- Preserve Panda responsive style props and the existing `minH="0"`/`minW="0"` overflow discipline.
- Imitate the existing disclosure semantics in `src/features/reviews/components/inbox/ReviewRequestList.tsx:94-116`: native button, `aria-controls`, `aria-expanded`, and visible focus styling.
- Put deterministic width math in a `.ts` helper and test it with the existing Node Vitest style in `src/features/reviews/components/finding-diff/findingDiffPreview.test.ts:1-13`.
- Keep changed-file selection and `ChangedFilesTree` ownership unchanged.

## Steps

1. Add `src/features/reviews/components/workspaceLayoutUtils.ts` with the exact constants and clamp/pointer/key functions above. Add `workspaceLayoutUtils.test.ts` covering min/max clamping, pointer deltas in both directions, 16 px arrow steps, Home/End, and unrelated keys.
2. Add a small `PaneResizeHandle` component beside the helper. Implement pointer capture and cleanup without document-global listeners left behind; expose the separator attributes and keyboard behavior shown in Target.
3. At `src/app/MainReviewScreen.tsx:49-110`, add inbox width/collapse state and replace the 36vw grid with the target compact grid. Render the inbox, separator, and collapsed rail in the correct column order.
4. At `src/features/reviews/components/ReviewInbox.tsx:13-89` and `src/features/reviews/components/inbox/ReviewInboxHeader.tsx:5-34`, thread `collapsed`/`onCollapse` only as needed, add the named collapse button, and preserve refresh/settings/search behavior.
5. At `src/features/reviews/components/review-tabs/CodeTab.tsx:12-113`, add independent changed-files width/collapse state, move from the `xl: 24rem` split to the target adaptive `lg` split, and add the changed-files separator and collapsed rail. Keep the diff mounted and selected-file state intact when the tree is collapsed.
6. Re-read the diff at 1280, 1100, 1024, 900, and 768 px. Remove unrelated styling churn and verify there is never a horizontal page scrollbar.

## Boundaries

- Do NOT change the initial active tab, diff rendering, changed-file selection, review generation, or inbox data behavior.
- Do NOT persist widths/collapse state to app settings or local storage.
- Do NOT add a split-pane/resizer dependency or change public shared UI APIs.
- Do NOT make the diff narrower than it is at the stamped commit at 1280 px default state.
- Do NOT add component, DOM, jsdom, or browser-test dependencies; add only the Node Vitest pure-helper test described above.
- Keep pointer and keyboard resizing clamped; never allow either navigation pane to cover or push out the diff.
- STOP if the cited layout has drifted from commit `a283d84`; report the drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm test -- src/features/reviews/components/workspaceLayoutUtils.test.ts`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` completes and the score does not regress from the stamped report's 81.
- **Runtime layout check**:
  - Start the Electron app, select a PR with a multi-file diff, and open Code at 1280×800. Confirm the diff is wider than either expanded navigation pane at the exact 288/224 defaults.
  - At 1024–1279 px, confirm inbox, file tree, resize handles, and diff remain usable without overlap or horizontal page scrolling; below `lg`, confirm the stacked layout remains readable.
  - Drag each separator to both limits; then focus it and exercise Left, Right, Home, and End. Confirm `aria-valuenow` tracks the clamped width and a visible focus ring remains.
  - Collapse and restore each pane independently. Confirm the selected PR, selected file, diff scroll/state, and generated review are not reset.
  - Check at 200% zoom that the collapsed rails and controls remain reachable and the diff can claim remaining width.
- **Done when**: the default 1280 px Code view prioritizes the diff, both navigation panes resize and collapse independently by pointer and keyboard, intermediate widths have no overlap/overflow failure, pure-helper and repository checks pass, and React Doctor does not regress.
