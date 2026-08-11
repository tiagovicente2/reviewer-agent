# 027 — Improve async accessibility

- **Status**: DONE
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Accessibility
- **Rule**: `react-doctor/click-events-have-key-events`; `react-doctor/no-smooth-scroll-without-reduced-motion` (opt-in design rule)
- **Estimated scope**: 5 files, medium semantic and motion change

## Problem

### Actionable toasts lose live semantics and keyboard activation

The toast container becomes a static `Box` with a click handler and `role="button"` whenever an action exists. It is focusable but has no Enter/Space handler. It also contains a real dismiss button, creating nested interactive semantics from the accessibility tree’s perspective:

```tsx
// src/app/toast.tsx:62-96 — current
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
		<Box alignItems="flex-start" display="flex" gap="3" justifyContent="space-between">
			<Box minW="0">
				<Box fontWeight="semibold">{toast.title}</Box>
				{toast.description ? (
					<Box className={toastDescriptionClassNames[toast.tone]} mt="1" textStyle="sm">
						{toast.description}
					</Box>
				) : null}
			</Box>
			<Box
				as="button"
				aria-label="Dismiss notification"
				onClick={(event) => {
					event.stopPropagation()
					removeToast(toast.id)
				}}
				className={cx(toastDescriptionClassNames[toast.tone], css({ fontWeight: 'bold' }))}
			>
				×
			</Box>
		</Box>
	</Box>
))}
```

The only actionable caller relies on mouse-specific copy:

```tsx
// src/app/hooks/useErrorLog.ts:20-26 — current
setErrors((current) => [entry, ...current])
showToast({
	description: 'Click to open the error log.',
	onClick: openErrorLog,
	title,
	tone: 'error',
})
```

Because actionable errors use `role="button"` instead of a live-region role, new errors may also not be announced as notifications.

### Generation feedback is visual and continuously animated

Review generation animates text frames every 500 ms regardless of reduced-motion preference. Neither the progress state nor streamed transcript has live-region/log semantics:

```tsx
// src/features/reviews/components/ReviewProgress.tsx:8-20,31-58 — current
export function ReviewProgress({ message, outputText }: { message?: string; outputText?: string }) {
	const [frameIndex, setFrameIndex] = useState(0)
	const timestampByLineIdRef = useRef(new Map<string, string>())
	const transcriptLines = getTranscriptLines(outputText, timestampByLineIdRef.current)
	const hasTranscript = transcriptLines.length > 0

	useEffect(() => {
		const interval = window.setInterval(() => {
			setFrameIndex((current) => (current + 1) % reviewFrames.length)
		}, 500)

		return () => window.clearInterval(interval)
	}, [])

	// ...
	<Box fontWeight="semibold">Reviewing this PR</Box>
	// ...
	<Box color="cyan.11" fontFamily="mono" fontSize="5xl" fontWeight="bold" lineHeight="1">
		<ReviewFrame frame={reviewFrames[frameIndex]} />
	</Box>
	<Box color="fg.muted" maxW="32rem" textStyle="sm">
		{message || 'Waiting for the first streamed response tokens...'}
	</Box>
```

```tsx
// src/features/reviews/components/review-progress/ReviewTranscript.tsx:26-44 — current
<Stack
	bg="gray.1"
	borderColor="border.default"
	borderRadius="l2"
	borderWidth="1px"
	flex="1"
	gap="0"
	minH="0"
	onScroll={updateTranscriptFollowState}
	overflowY="auto"
	ref={transcriptRef}
	scrollbarGutter="stable"
	w="100%"
>
	{lines.map((line) => (
		<TranscriptLine key={line.id} line={line} />
	))}
</Stack>
```

### Diff navigation always smooth-scrolls

Selecting a file always requests smooth motion, even when the OS asks for reduced motion:

```tsx
// src/features/reviews/components/diff-viewer/DiffViewer.tsx:49-57 — current
requestAnimationFrame(() => {
	const node = fileRefs.current.get(fileKey)
	const scrollParent = node ? getScrollableParent(node) : null
	if (node && scrollParent) {
		scrollParent.scrollTo({
			behavior: 'smooth',
			top: node.offsetTop - scrollParent.offsetTop,
		})
	}
})
```

These are primary review-workflow updates. Keyboard and screen-reader users need equivalent action/announcement behavior, and motion-sensitive users need instant/static alternatives.

## Target

### Apply the canonical React Doctor recipes

The canonical `react-doctor/click-events-have-key-events` fix says:

> Prefer replacing the static element with a native `<button>`, which gives Enter/Space activation for free. If the div must stay, add an `onKeyDown` handler that fires the same callback when `event.key` is `'Enter'` or `' '`, plus `role='button'` and `tabIndex={0}`.

Source: `https://www.react.doctor/prompts/rules/react-doctor/click-events-have-key-events.md` fetched for commit `a283d84` planning. Use the preferred native-button branch, but do **not** make the whole toast a button because it contains Dismiss. Keep the toast a live container and render Action and Dismiss as sibling native buttons.

The canonical `react-doctor/no-smooth-scroll-without-reduced-motion` correction is:

```tsx
<main className="motion-safe:scroll-smooth motion-reduce:scroll-auto" />
```

Its fix prompt requires: “Enable smooth scrolling only for users without a reduced-motion preference, and fall back to instant scrolling for everyone else.” Source: `https://www.react.doctor/prompts/rules/react-doctor/no-smooth-scroll-without-reduced-motion.md`. The rule is opt-in, but the runtime issue is confirmed by the unconditional `behavior: 'smooth'`; adapt the recipe to the imperative API exactly as shown below.

### Separate toast status from toast actions

Replace optional container `onClick` with an explicit action model:

```tsx
// src/app/toast.tsx:7-16 — target
type Toast = {
	id: string
	title: string
	description?: string
	tone: ToastTone
	action?: {
		label: string
		onClick: () => void
	}
}
```

Render a non-interactive live notification containing sibling native controls:

```tsx
// src/app/toast.tsx:62-105 — target map body
{toasts.map((toast) => (
	<Box
		aria-atomic="true"
		className={toastToneClassNames[toast.tone]}
		borderLeftWidth="4px"
		borderRadius="l2"
		boxShadow="xl"
		key={toast.id}
		p="4"
		role={toast.tone === 'error' ? 'alert' : 'status'}
	>
		<Box alignItems="flex-start" display="flex" gap="3" justifyContent="space-between">
			<Box minW="0">
				<Box fontWeight="semibold">{toast.title}</Box>
				{toast.description ? (
					<Box className={toastDescriptionClassNames[toast.tone]} mt="1" textStyle="sm">
						{toast.description}
					</Box>
				) : null}
			</Box>
			<Box
				as="button"
				aria-label="Dismiss notification"
				className={cx(toastDescriptionClassNames[toast.tone], css({ fontWeight: 'bold' }))}
				onClick={() => removeToast(toast.id)}
				type="button"
			>
				×
			</Box>
		</Box>
		{toast.action ? (
			<Box
				as="button"
				className={cx(
					toastDescriptionClassNames[toast.tone],
					css({ cursor: 'pointer', fontWeight: 'semibold', marginTop: '2', textDecoration: 'underline' }),
				)}
				onClick={toast.action.onClick}
				type="button"
			>
				{toast.action.label}
			</Box>
		) : null}
	</Box>
))}
```

Update the error caller with device-neutral copy and an explicit accessible action name:

```tsx
// src/app/hooks/useErrorLog.ts:20-27 — target
setErrors((current) => [entry, ...current])
showToast({
	action: { label: 'Open error log', onClick: openErrorLog },
	description: 'Open the error log for details.',
	title,
	tone: 'error',
})
```

### Announce generation without announcing animation frames

Add `VisuallyHidden` to the existing styled-system import:

```tsx
// src/features/reviews/components/ReviewProgress.tsx:2 — target
import { Box, HStack, Stack, VisuallyHidden } from 'styled-system/jsx'
```

Respect the media query in JS and stop the timer while reduced motion is active:

```tsx
// src/features/reviews/components/ReviewProgress.tsx:8-33 — target
export function ReviewProgress({ message, outputText }: { message?: string; outputText?: string }) {
	const [frameIndex, setFrameIndex] = useState(0)
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
		window.matchMedia('(prefers-reduced-motion: reduce)').matches,
	)
	const timestampByLineIdRef = useRef(new Map<string, string>())
	const transcriptLines = getTranscriptLines(outputText, timestampByLineIdRef.current)
	const hasTranscript = transcriptLines.length > 0

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
		const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)
		mediaQuery.addEventListener('change', updatePreference)
		return () => mediaQuery.removeEventListener('change', updatePreference)
	}, [])

	useEffect(() => {
		if (prefersReducedMotion) {
			setFrameIndex(0)
			return
		}

		const interval = window.setInterval(() => {
			setFrameIndex((current) => (current + 1) % reviewFrames.length)
		}, 500)
		return () => window.clearInterval(interval)
	}, [prefersReducedMotion])
```

Make the progress label a polite atomic status, include changing phase text for assistive technology even after the transcript appears, and hide decorative frames:

```tsx
// src/features/reviews/components/ReviewProgress.tsx:22-63 — target
return (
	<Stack
		aria-busy="true"
		borderRadius="l2"
		gap="2"
		h="100%"
		minH="18rem"
		overflow="hidden"
		textAlign="left"
	>
		<HStack alignItems="center" justify="space-between" gap="3">
			<Box aria-atomic="true" aria-live="polite" fontWeight="semibold" role="status">
				Reviewing this PR
				<VisuallyHidden>
					{`. ${message || 'Waiting for the first streamed response tokens...'}`}
				</VisuallyHidden>
			</Box>
			{hasTranscript ? (
				<HStack aria-hidden="true" color="fg.muted" flexShrink="0" gap="2" textStyle="xs">
					<Box color="cyan.11" fontFamily="mono" fontWeight="bold">
						<ReviewFrame frame={reviewFrames[frameIndex]} />
					</Box>
				</HStack>
			) : null}
		</HStack>
		<Stack flex="1" minH="0">
			{hasTranscript ? (
				<ReviewTranscript lines={transcriptLines} />
			) : (
				<Stack
					alignItems="center"
					flex="1"
					gap="4"
					justify="center"
					minH="18rem"
					textAlign="center"
				>
					<Box
						aria-hidden="true"
						color="cyan.11"
						fontFamily="mono"
						fontSize="5xl"
						fontWeight="bold"
						lineHeight="1"
					>
						<ReviewFrame frame={reviewFrames[frameIndex]} />
					</Box>
					<Box color="fg.muted" maxW="32rem" textStyle="sm">
						{message || 'Waiting for the first streamed response tokens...'}
					</Box>
				</Stack>
			)}
		</Stack>
	</Stack>
)
```

Give appended transcript entries log semantics:

```tsx
// src/features/reviews/components/review-progress/ReviewTranscript.tsx:26-44 — target additions
<Stack
	aria-label="Review generation transcript"
	aria-live="polite"
	aria-relevant="additions text"
	bg="gray.1"
	borderColor="border.default"
	borderRadius="l2"
	borderWidth="1px"
	flex="1"
	gap="0"
	minH="0"
	onScroll={updateTranscriptFollowState}
	overflowY="auto"
	ref={transcriptRef}
	role="log"
	scrollbarGutter="stable"
	w="100%"
>
```

### Make imperative diff scrolling motion-safe

Adapt the canonical smooth/auto recipe to the current `scrollTo` call:

```tsx
// src/features/reviews/components/diff-viewer/DiffViewer.tsx:49-58 — target
requestAnimationFrame(() => {
	const node = fileRefs.current.get(fileKey)
	const scrollParent = node ? getScrollableParent(node) : null
	if (node && scrollParent) {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		scrollParent.scrollTo({
			behavior: prefersReducedMotion ? 'auto' : 'smooth',
			top: node.offsetTop - scrollParent.offsetTop,
		})
	}
})
```

## Repo conventions to follow

### Semantics

- Preserve the toast context/provider and `showToast` call shape apart from replacing `onClick` with typed `action`.
- Use native `Box as="button"` controls like `src/features/reviews/components/diff-viewer/DiffViewer.tsx:123-141`.
- Keep error alerts assertive and success/info notifications polite; keep decorative animation out of accessible names.

### Motion and streaming

- Preserve transcript follow/pause behavior in `ReviewTranscript.tsx:9-24`; ARIA additions must not force scrolling.
- Preserve smooth scrolling for users with no reduced-motion preference and instant scrolling for users who request reduction.
- Use the browser media query directly; do not add a motion library or global preference store.

## Steps

### Toast and live feedback

1. At `src/app/toast.tsx:7-16`, replace `onClick` with the typed `action` object, then keep every toast container non-interactive with `alert`/`status` live semantics.
2. At `src/app/toast.tsx:62-96`, render Action and Dismiss as sibling native buttons. Remove container `cursor`, `onClick`, `role="button"`, `tabIndex`, and the now-unneeded `stopPropagation`.
3. At `src/app/hooks/useErrorLog.ts:20-26`, migrate the sole actionable caller to `{ action: { label, onClick } }` and remove mouse-only “Click” copy.
4. At `ReviewProgress.tsx` and `ReviewTranscript.tsx`, add one concise generation status and log semantics; hide both animated frame instances from assistive technology.

### Reduced motion

1. In `ReviewProgress.tsx`, subscribe to `prefers-reduced-motion`, stop/reset the frame timer when it matches, and clean up both listener and interval.
2. In `DiffViewer.tsx:49-57`, choose `auto` versus `smooth` from the media query at the moment navigation scrolls.
3. Re-read all five-file changes and remove unrelated toast timing, transcript rendering, generation state, or diff-selection churn.

## Boundaries

- Do NOT nest Action or Dismiss inside another button/interactive container; the toast itself remains only an alert/status.
- Do NOT remove, auto-activate, or merge the Dismiss and Action controls; preserve mouse/touch behavior and the four-second timeout.
- Do NOT announce every decorative frame change, move focus when async work completes, or force transcript follow after the user scrolls up.
- Do NOT disable all scrolling or animation unconditionally; only reduced-motion users get a static frame and instant diff navigation.
- Do NOT add React Testing Library, jsdom, Playwright, a component/browser test, or dependencies. If a pure decision helper is extracted, test only that helper with the repository’s existing Node Vitest. STOP on drift from commit `a283d84`.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` clears `react-doctor/click-events-have-key-events` for the toast and reports no score regression.
  - Enable the opt-in check for verification with `npx react-doctor@latest rules enable react-doctor/no-smooth-scroll-without-reduced-motion`, scan the changed scope, then restore repository-local rule configuration if the command writes any local config; do not commit scanner configuration.
- **Keyboard/AT check**: Trigger an error toast. Confirm it is announced as an alert, Tab reaches separate “Dismiss notification” and “Open error log” native buttons, Enter and Space activate each, and activating Dismiss never opens the log. Confirm success/info toasts announce politely.
- **Generation check**: Start review generation with a screen reader. Confirm “Reviewing this PR” and phase changes are announced, appended transcript lines are exposed as a labeled log, decorative frame changes are silent, and scrolling up still pauses visual auto-follow.
- **Reduced-motion check**: With OS reduced motion on, start generation and select changed files: the review frame stays static and diff navigation is instant. Turn reduced motion off without remounting progress: frame animation resumes and diff navigation remains smooth.
- **Done when**: async outcomes and generation progress are available through live semantics, actionable toasts have valid native keyboard behavior without nested controls, and generation/diff motion honors the user preference.
