# 025 — Confirm destructive cache clearing

- **Status**: DONE
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 1 file, small interaction change

## Problem

The cache modal correctly says generated review drafts are cached, but its action row gives “Clear cache” the same outline hierarchy as Close and Refresh:

```tsx
// src/features/settings/components/CacheModal.tsx:77-105 — current
<Box>
	<Box fontWeight="bold" textStyle="lg">
		Local cache
	</Box>
	<Box color="fg.muted" mt="1" textStyle="sm">
		Cached PR details, diffs, and generated review drafts are pruned automatically.
	</Box>
</Box>

<HStack color="fg.muted" flexWrap="wrap" gap="3" textStyle="sm">
	<Box>{stats?.pullRequestDetails ?? 0} PR details</Box>
	<Box>{stats?.pullRequestDiffs ?? 0} diffs</Box>
	<Box>{stats?.generatedReviews ?? 0} reviews</Box>
</HStack>

<HStack gap="2" justify="flex-end" mt="2">
	<Button variant="outline" onClick={onClose}>
		Close
	</Button>
	<Button variant="outline" loading={state === 'loading'} onClick={() => void refresh()}>
		Refresh
	</Button>
	<Button
		variant="outline"
		loading={state === 'loading'}
		onClick={() => void clearCache()}
	>
		Clear cache
	</Button>
</HStack>
```

The first click immediately invokes the destructive RPC:

```tsx
// src/features/settings/components/CacheModal.tsx:34-43 — current
const clearCache = async () => {
	setState('loading')
	try {
		const result = await appRpc.request.clearAppCache()
		showToast({
			title: 'Cache cleared',
			description: `Removed ${result.removedPullRequestDetails} PR details, ${result.removedPullRequestDiffs} diffs, and ${result.removedGeneratedReviews} generated reviews.`,
			tone: 'success',
		})
		await refresh()
```

PR details and diffs can be fetched again, but generated review drafts are user work. A single accidental click permanently removes them without an explicit warning or second decision.

## Target

Add a confirmation state. The initial action opens confirmation and never calls the RPC:

```tsx
// src/features/settings/components/CacheModal.tsx — target state
const [stats, setStats] = useState<CacheStats | null>(null)
const [state, setState] = useState<AsyncState>('loading')
const [confirmingClear, setConfirmingClear] = useState(false)
const { showToast } = useToast()
```

Keep `clearCache` as the only function that invokes `clearAppCache`, but close confirmation only after success. On failure, leave the confirmation visible so the error context and retry remain clear:

```tsx
// src/features/settings/components/CacheModal.tsx — target clear behavior
const clearCache = async () => {
	setState('loading')
	try {
		const result = await appRpc.request.clearAppCache()
		showToast({
			title: 'Cache cleared',
			description: `Removed ${result.removedPullRequestDetails} PR details, ${result.removedPullRequestDiffs} diffs, and ${result.removedGeneratedReviews} generated reviews.`,
			tone: 'success',
		})
		setConfirmingClear(false)
		await refresh()
	} catch (error) {
		setState('error')
		showToast({
			title: 'Could not clear cache',
			description: getErrorMessage(error),
			tone: 'error',
		})
	}
}
```

Replace the action area with explicit consequence copy and a two-stage hierarchy:

```tsx
// src/features/settings/components/CacheModal.tsx — target action area
{confirmingClear ? (
	<Stack
		bg="red.subtle.bg"
		borderColor="red.7"
		borderRadius="l2"
		borderWidth="1px"
		gap="3"
		p="4"
	>
		<Box>
			<Box color="red.11" fontWeight="semibold">
				Delete cached review drafts?
			</Box>
			<Box color="red.11" mt="1" textStyle="sm">
				This permanently deletes {stats?.generatedReviews ?? 0} generated review drafts.
				 PR details and diffs can be downloaded again, but drafts cannot be recovered.
			</Box>
		</Box>
		<HStack flexWrap="wrap" gap="2" justify="flex-end">
			<Button
				disabled={state === 'loading'}
				onClick={() => setConfirmingClear(false)}
				variant="outline"
			>
				Keep cache
			</Button>
			<Button
				colorPalette="red"
				loading={state === 'loading'}
				onClick={() => void clearCache()}
			>
				Delete drafts and clear cache
			</Button>
		</HStack>
	</Stack>
) : (
	<HStack flexWrap="wrap" gap="2" justify="flex-end" mt="2">
		<Button variant="outline" onClick={onClose}>
			Close
		</Button>
		<Button
			disabled={state === 'loading'}
			onClick={() => void refresh()}
			variant="plain"
		>
			Refresh
		</Button>
		<Button
			colorPalette="red"
			disabled={state === 'loading' || !stats}
			onClick={() => setConfirmingClear(true)}
			variant="outline"
		>
			Clear cache…
		</Button>
	</HStack>
)}
```

The ellipsis on “Clear cache…” communicates that another step follows. Only the final red solid button performs deletion.

## Repo conventions to follow

- Keep cache RPC calls and toast reporting in `CacheModal`.
- Reuse the existing `Button` `colorPalette`, `variant`, `loading`, and `disabled` patterns; do not add CSS for a new button type.
- Follow the destructive solid-button hierarchy used by existing color-palette controls, while keeping cancel/refresh secondary.
- Preserve the current result-count toast and refresh-after-success behavior.

## Steps

1. At `src/features/settings/components/CacheModal.tsx:10-13`, add local `confirmingClear` state initialized to `false`.
2. At `src/features/settings/components/CacheModal.tsx:34-52`, set confirmation false only after `clearAppCache` succeeds; retain confirmation on failure and preserve the existing error toast.
3. At `src/features/settings/components/CacheModal.tsx:92-106`, make the initial “Clear cache…” button enter confirmation instead of invoking the RPC, lower Refresh to `plain`, and style the initial destructive affordance as red outline.
4. Render the warning copy with the current generated-review count and provide “Keep cache” plus the red solid “Delete drafts and clear cache” final action.
5. Re-read the diff and verify there is exactly one JSX event path to `clearCache`: the final confirmation button.

## Boundaries

- Do NOT change what `clearAppCache` deletes, backend cache behavior, result types, automatic pruning, or success/error toast counts.
- Do NOT imply generated drafts are recoverable; the warning must distinguish them from refetchable PR details/diffs.
- Do NOT call the destructive RPC from the initial “Clear cache…” action, backdrop, Enter on unrelated controls, or modal close.
- Do NOT add a dependency or component/browser test harness; this interaction is verified manually.
- STOP if `src/features/settings/components/CacheModal.tsx` has drifted from commit `a283d84`; report the drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` reports no new diagnostics and no score regression.
- **Behavior check**: Open Local cache with at least one generated draft. Click “Clear cache…” and confirm counts remain unchanged and no success toast appears. Click “Keep cache” and confirm the modal returns to its initial state. Re-enter confirmation, click “Delete drafts and clear cache,” and confirm the result toast reports deleted drafts and refreshed counts become zero.
- **Failure check**: Force `clearAppCache` to reject and confirm the destructive warning remains visible, controls recover from loading, the error toast appears, and no false success state is shown.
- **Keyboard check**: Tab through the initial and confirmation actions. Confirm Enter/Space on “Clear cache…” only opens confirmation, while only Enter/Space on the final red button deletes.
- **Done when**: cache clearing requires an explicit consequence-aware second action and the destructive hierarchy clearly prioritizes keeping user drafts safe.
