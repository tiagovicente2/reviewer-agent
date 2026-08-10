# 003 — Make clickable toasts keyboard accessible

- **Status**: TODO
- **Commit**: 44835be
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Rule**: Beyond the scan
- **Estimated scope**: 1 file, small change

## Problem

Clickable toasts are focusable and announce `role="button"`, but pressing Enter or Space does not activate them:

```tsx
// src/app/toast.tsx:62 — current
{toasts.map((toast) => (
	<Box
		className={toastToneClassNames[toast.tone]}
		borderLeftWidth="4px"
		borderRadius="l2"
		boxShadow="xl"
		cursor={toast.onClick ? 'pointer' : 'default'}
		key={toast.id}
		onClick={toast.onClick}
		p="4"
		role={toast.onClick ? 'button' : 'status'}
		tabIndex={toast.onClick ? 0 : undefined}
	>
```

Keyboard users can tab to an actionable toast but cannot trigger its action.

## Target

Use native button semantics when a toast is actionable, or add complete keyboard activation. Preferred target shape:

```tsx
// target shape
<Box
	as={toast.onClick ? 'button' : 'div'}
	type={toast.onClick ? 'button' : undefined}
	onClick={toast.onClick}
	role={toast.onClick ? undefined : 'status'}
	tabIndex={toast.onClick ? undefined : undefined}
	// preserve existing visual styling
>
```

If Panda/Box typing makes dynamic `as` awkward, keep `role="button"` but add:

```tsx
onKeyDown={(event) => {
	if (!toast.onClick) return
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault()
		toast.onClick()
	}
}}
```

## Repo conventions to follow

- Preserve the existing toast context and `showToast` API.
- Imitate the existing real-button pattern in `src/features/reviews/components/diff-viewer/DiffViewer.tsx:123` for clickable custom UI.
- Preserve the dismiss button’s `event.stopPropagation()` behavior.

## Steps

1. In `src/app/toast.tsx`, make actionable toast containers keyboard-operable.
2. Prefer `as="button"` for actionable toasts; ensure `type="button"`, `textAlign="left"`, and no default browser button styling breaks the visual design.
3. If using the fallback key handler, handle both Enter and Space and call `event.preventDefault()` for Space.
4. Confirm the inner dismiss button still dismisses without triggering `toast.onClick`.

## Boundaries

- Do NOT change `showToast` callers or the toast data model.
- Do NOT alter toast timing or stacking.
- Keep visual appearance unchanged except for valid focus indication.
- STOP if `src/app/toast.tsx` has drifted from commit `44835be`.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `npx react-doctor@latest --scope changed` does not introduce new accessibility diagnostics or lower the score.
- **Behavior check**: Trigger an actionable toast, tab to it, press Enter and Space, and confirm the action runs. Tab to the dismiss control and confirm it dismisses without running the toast action.
- **Done when**: mouse and keyboard users can operate clickable toasts equivalently.
