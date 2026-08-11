# 020 — Add accessible modal behavior

- **Status**: TODO
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Accessibility
- **Rule**: Beyond the scan
- **Estimated scope**: 3 files, medium semantic/focus correction using the existing Ark UI dependency

## Problem

All three modal workflows are visually modal but are anonymous nested `div` elements. They do not expose `dialog`/`alertdialog`, an accessible title or description, move focus into the surface, close with Escape, trap Tab, or return focus to the opener.

The review-submission confirmation is on the primary publishing path and currently relies only on backdrop clicks and propagation cancellation:

```tsx
// src/features/reviews/components/review-detail/ConfirmSubmitReviewModal.tsx:21-42 — current
return (
	<Box
		alignItems="center"
		bg="black/40"
		display="flex"
		inset="0"
		justifyContent="center"
		onClick={submitting ? undefined : onClose}
		position="fixed"
		zIndex="modal"
	>
		<Box
			bg="gray.1"
			borderColor="gray.4"
			borderRadius="l3"
			borderWidth="1px"
			boxShadow="2xl"
			maxW="28rem"
			onClick={(event) => event.stopPropagation()}
			p="6"
			w="100%"
		>
```

The cache dialog repeats the same non-semantic pattern and does not preserve the opener:

```tsx
// src/features/settings/components/CacheModal.tsx:54-75 — current
return (
	<Box
		position="fixed"
		inset="0"
		bg="black/40"
		display="flex"
		alignItems="center"
		justifyContent="center"
		zIndex="modal"
		onClick={onClose}
	>
		<Box
			bg="gray.1"
			borderRadius="l3"
			borderWidth="1px"
			borderColor="gray.4"
			boxShadow="2xl"
			maxW="24rem"
			w="100%"
			p="6"
			onClick={(e) => e.stopPropagation()}
		>
```

The update workflow has the same problem, then inserts an inline confirmation without moving focus from **Install update** to the newly displayed choice:

```tsx
// src/features/settings/components/UpdateModal.tsx:63-84,100-115 — current
return (
	<Box
		position="fixed"
		inset="0"
		bg="black/40"
		display="flex"
		alignItems="center"
		justifyContent="center"
		zIndex="modal"
		onClick={installing ? undefined : onClose}
	>
		<Box
			bg="gray.1"
			borderRadius="l3"
			borderWidth="1px"
			borderColor="gray.4"
			boxShadow="2xl"
			maxW="24rem"
			w="100%"
			p="6"
			onClick={(e) => e.stopPropagation()}
		>
			<Stack gap="4">
				{/* ... */}
				{confirmingInstall ? (
					<Box bg="gray.2" borderColor="gray.6" borderRadius="l2" borderWidth="1px" p="3">
						<Box color="fg.default" fontWeight="medium" textStyle="sm">
							Install update now?
						</Box>
						{/* ... */}
						<HStack gap="2" justify="flex-end" mt="3">
							<Button variant="outline" onClick={() => setConfirmingInstall(false)}>
								Not now
							</Button>
							<Button onClick={() => void update()}>OK</Button>
						</HStack>
					</Box>
				) : null}
```

A keyboard user can tab into the obscured page, cannot use Escape, and loses their place after closure. A screen reader receives no modal boundary or title. These are high-frequency settings and irreversible GitHub/update confirmation paths, so the missing behavior is not merely cosmetic.

## Target

Use `Dialog` from the already-installed `@ark-ui/react/dialog`; do not write a custom focus trap. Ark Dialog supplies the modal role, generated title/description associations, Escape dismissal, focus containment, outside-interaction handling, and focus restoration. Keep the existing Panda visual props through `asChild`.

The review confirmation is an `alertdialog`, starts on the safe **Cancel** action, and refuses all dismissal while submission is in flight:

```tsx
// src/features/reviews/components/review-detail/ConfirmSubmitReviewModal.tsx — target shape
const cancelRef = useRef<HTMLButtonElement>(null)

return (
	<Dialog.Root
		initialFocusEl={() => cancelRef.current}
		modal
		onOpenChange={({ open }) => {
			if (!open && !submitting) onClose()
		}}
		open
		restoreFocus
		role="alertdialog"
		trapFocus
	>
		<Dialog.Backdrop asChild>
			<Box bg="black/40" inset="0" position="fixed" />
		</Dialog.Backdrop>
		<Dialog.Positioner asChild>
			<Box alignItems="center" display="flex" inset="0" justifyContent="center" position="fixed" zIndex="modal">
				<Dialog.Content asChild>
					<Box
						bg="gray.1"
						borderColor="gray.4"
						borderRadius="l3"
						borderWidth="1px"
						boxShadow="2xl"
						maxW="28rem"
						p="6"
						w="100%"
					>
						<Stack gap="4">
							<Box>
								<Dialog.Title asChild>
									<Box fontWeight="bold" textStyle="lg">
										{isRequestChanges ? 'Request changes?' : 'Approve pull request?'}
									</Box>
								</Dialog.Title>
								<Dialog.Description asChild>
									<Box color="fg.muted" mt="1" textStyle="sm">
										{isRequestChanges
											? `This will submit a request changes review with ${findingsCount} generated inline comment${findingsCount === 1 ? '' : 's'}.`
											: 'This will approve the pull request on GitHub.'}
									</Box>
								</Dialog.Description>
							</Box>
							<HStack gap="2" justify="flex-end">
								<Button ref={cancelRef} disabled={submitting} onClick={onClose} variant="outline">
									Cancel
								</Button>
								<Button loading={submitting} onClick={onConfirm}>
									{isRequestChanges ? 'Request changes' : 'Approve'}
								</Button>
							</HStack>
						</Stack>
					</Box>
				</Dialog.Content>
			</Box>
		</Dialog.Positioner>
	</Dialog.Root>
)
```

Apply the same structure to `CacheModal`, with `role="dialog"`, `initialFocusEl={() => closeRef.current}`, and `Dialog.Title` **Local cache** plus `Dialog.Description` around the existing pruning copy. The exact root behavior is:

```tsx
// src/features/settings/components/CacheModal.tsx — target root
const closeRef = useRef<HTMLButtonElement>(null)

<Dialog.Root
	initialFocusEl={() => closeRef.current}
	modal
	onOpenChange={({ open }) => {
		if (!open) onClose()
	}}
	open
	restoreFocus
	role="dialog"
	trapFocus
>
	{/* Dialog.Backdrop, Dialog.Positioner, and Dialog.Content with current visuals */}
	<Dialog.Title asChild>
		<Box fontWeight="bold" textStyle="lg">Local cache</Box>
	</Dialog.Title>
	<Dialog.Description asChild>
		<Box color="fg.muted" mt="1" textStyle="sm">
			Cached PR details, diffs, and generated review drafts are pruned automatically.
		</Box>
	</Dialog.Description>
	{/* existing statistics */}
	<Button ref={closeRef} variant="outline" onClick={onClose}>Close</Button>
	{/* existing Refresh and Clear cache actions */}
</Dialog.Root>
```

Apply the same structure to `UpdateModal`, with `Dialog.Title` wrapping the existing dynamic `title`, `Dialog.Description` wrapping `body`, safe initial focus on **Close**, and dismissal blocked while `installing`:

```tsx
// src/features/settings/components/UpdateModal.tsx — target root/focus behavior
const closeRef = useRef<HTMLButtonElement>(null)
const contentRef = useRef<HTMLDivElement>(null)
const installRef = useRef<HTMLButtonElement>(null)
const notNowRef = useRef<HTMLButtonElement>(null)

useEffect(() => {
	if (confirmingInstall) notNowRef.current?.focus()
}, [confirmingInstall])

const cancelInstall = () => {
	setConfirmingInstall(false)
	requestAnimationFrame(() => installRef.current?.focus())
}

<Dialog.Root
	initialFocusEl={() => closeRef.current}
	modal
	onOpenChange={({ open }) => {
		if (!open && !installing) onClose()
	}}
	open
	restoreFocus
	role="dialog"
	trapFocus
>
	{/* backdrop and positioner */}
	<Dialog.Content asChild>
		<Box ref={contentRef} /* existing surface props */>
			{/* installing status */}
			{confirmingInstall ? (
				<Box /* existing confirmation visuals */>
					<Box color="fg.default" fontWeight="medium" textStyle="sm">Install update now?</Box>
					{/* existing explanation */}
					<HStack gap="2" justify="flex-end" mt="3">
						<Button ref={notNowRef} variant="outline" onClick={cancelInstall}>Not now</Button>
						<Button onClick={() => void update()}>OK</Button>
					</HStack>
				</Box>
			) : null}
			<Dialog.Title asChild><Box /* current title props */>{title}</Box></Dialog.Title>
			<Dialog.Description asChild><Box /* current body props */>{body}</Box></Dialog.Description>
			{/* ... */}
			<Button ref={closeRef} variant="outline" disabled={installing} onClick={onClose}>Close</Button>
			{/* ... */}
			<Button ref={installRef} /* current props */>Install update</Button>
		</Box>
	</Dialog.Content>
</Dialog.Root>
```

When `update()` removes the inline confirmation before installing, explicitly focus `contentRef.current` after the state transition so focus never falls to `<body>`. Keep the confirmation inside the one update dialog; do not create nested modal dialogs.

## Repo conventions to follow

- Use the repository's existing `@ark-ui/react` dependency, as `src/components/ui/input.tsx:1-6` and `textarea.tsx:1-6` already do.
- Keep visual layout in Panda `Box`/`Stack`/`HStack` props and use Ark's `asChild` bridge rather than duplicating CSS.
- Keep each modal's async state and RPC calls in its current component.
- Preserve the safe secondary-action-first convention used by all three button rows.

## Steps

1. At `ConfirmSubmitReviewModal.tsx:1-66`, import `useRef` and Ark `Dialog`, replace the two clickable `Box` wrappers with the exact Ark structure, use `alertdialog`, and wire **Cancel** as initial focus. Let `onOpenChange` be the only backdrop/Escape dismissal path.
2. At `CacheModal.tsx:1-111`, add the same Ark structure with `Dialog.Title`, `Dialog.Description`, initial focus on **Close**, focus trap, Escape/outside close, and automatic return to the cache icon opener.
3. At `UpdateModal.tsx:1-166`, add the same dialog semantics and block Escape/outside close while installing. Move focus to **Not now** when install confirmation appears, restore it to **Install update** when canceled, and focus the dialog content when confirmation transitions into installation.
4. Re-read all three surfaces and remove obsolete backdrop `onClick`, inner `stopPropagation`, manual role/ARIA approximations, and unrelated visual churn.

## Boundaries

- Do NOT hand-roll focusable-element queries, Tab wrapping, document-level key handlers, or focus restoration; Ark Dialog owns those behaviors.
- Do NOT add a dependency; `@ark-ui/react` is already installed.
- Do NOT allow Escape, backdrop interaction, or **Close/Cancel** to dismiss review submission or update installation while the existing blocking state is active.
- Do NOT create a nested dialog for **Install update now?**; keep one modal boundary and move focus within it.
- Do NOT change RPC payloads, confirmation copy, cache/update behavior, toast behavior, or review-submission behavior.
- Do NOT add React Testing Library, jsdom, Playwright, component tests, or browser-test dependencies. There is no pure helper to test in this plan; use the runtime keyboard check.
- STOP if the cited modal code has drifted from commit `a283d84`; report the drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` completes with no new diagnostics and no score regression from 81.
- **Keyboard/AT check**:
  - Open review confirmation from **Approve…** and **Request changes…**. Confirm the announced role is alert dialog, its name is the visible question, its description is the consequence copy, and focus starts on **Cancel**.
  - Tab and Shift+Tab through each review/cache/update dialog and confirm focus wraps inside it. Press Escape and confirm it closes only when not blocked, then focus returns to the exact button/icon that opened it.
  - Open **Install update now?** and confirm focus moves to **Not now**. Cancel and confirm focus returns to **Install update**; confirm installation and verify focus remains in the dialog rather than moving to the obscured page/body.
  - Open each dialog with a screen reader and confirm the background is not navigable while the modal is open and no title/description is announced twice.
- **Done when**: all three workflows expose correctly named dialog semantics, have safe initial focus, support Escape, trap focus, restore the opener, preserve blocking states, and pass repository checks without a browser/component test dependency.
