# 007 — Key CodeTab state reset by PR identity

- **Status**: TODO
- **Commit**: 44835be
- **Severity**: LOW
- **Category**: Bugs & correctness
- **Rule**: react-doctor/no-reset-all-state-on-prop-change
- **Estimated scope**: 2 files, small change

## Problem

`CodeTab` resets its only local state in an effect whenever the full `detail` object identity changes:

```tsx
// src/features/reviews/components/ReviewDetailTabs.tsx:102 — current
const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

useEffect(() => {
	if (!detail) {
		setSelectedFilePath(null)
		return
	}

	setSelectedFilePath(null)
}, [detail])
```

This resets selected file state not only when switching PRs, but also when the same PR detail object is refreshed. React Doctor recommends letting React remount keyed state instead of resetting all state in an effect.

## Target

Canonical recipe from `react-doctor/no-reset-all-state-on-prop-change`:

> Hoist the discriminator one level up and remount via key: `<UserProfile key={userId} {...rest} />`. React unmounts the previous subtree and mounts a fresh one, resetting all state automatically with no setter calls and no wasted render.

Apply it here by keying `CodeTab` at the call site with a stable PR identity. Suggested target:

```tsx
// src/features/reviews/components/ReviewDetail.tsx — target shape
const codeTabKey = detail
	? `${detail.repo}#${detail.pullRequestNumber}:${detail.headSha}`
	: 'no-detail'

<CodeTab
	key={codeTabKey}
	colorMode={colorMode}
	detail={detail}
	...
/>
```

Then remove the reset effect from `CodeTab`:

```tsx
// src/features/reviews/components/ReviewDetailTabs.tsx — target
const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
```

No `useEffect` is needed solely to reset `selectedFilePath`.

## Repo conventions to follow

- Keep `CodeTab` in `src/features/reviews/components/ReviewDetailTabs.tsx`.
- Keep orchestration in `src/features/reviews/components/ReviewDetail.tsx`.
- Use existing PR identity fields already used elsewhere: `repo`, `pullRequestNumber`, `headSha`.

## Steps

1. In `ReviewDetail.tsx`, compute a stable `codeTabKey` near `generatedReviewId` or before the return.
2. Add `key={codeTabKey}` to the `CodeTab` element.
3. In `ReviewDetailTabs.tsx`, remove the `useEffect` that only calls `setSelectedFilePath(null)` in response to `detail` changes.
4. Remove `useEffect` from the import list in `ReviewDetailTabs.tsx` if no longer used.
5. Confirm selecting a different PR resets the selected file, while refreshing the same PR at the same `headSha` does not unnecessarily reset it.

## Boundaries

- Do NOT change the `CodeTab` public props except adding no new prop if `key` is sufficient.
- Do NOT reset other tab state.
- Do NOT alter diff loading or changed-files tree behavior.
- STOP if these files have drifted from commit `44835be`.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears `react-doctor/no-reset-all-state-on-prop-change` and the score does not regress.
  - `pnpm run typecheck`
  - `pnpm run lint`
- **Behavior check**: Open PR A, go to Code, select a file; refresh/regenerate details for the same PR/head and confirm selection remains if appropriate. Switch to PR B and confirm selected file resets.
- **Done when**: the reset effect is gone, PR switching still resets CodeTab state, and checks pass.
