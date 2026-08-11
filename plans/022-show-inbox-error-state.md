# 022 — Show inbox error state

- **Status**: DONE
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 5 files, small state-rendering change

## Problem

`useReviewRequests` records both inbox-load and search failures, and deliberately leaves the last successful review array untouched:

```tsx
// src/app/hooks/useReviewRequests.ts:35-52 — current inbox load
const loadReviewRequests = useCallback(async () => {
	setSearchActive(false)
	setActiveSearchQuery('')
	setReviewsState('loading')
	try {
		const items = await appRpc.request.listGitHubReviewRequests()
		setReviews(items)
		// selection reconciliation omitted
		setReviewsState('idle')
		return true
	} catch (error) {
		logError('Could not load review requests', error, 'GitHub review inbox')
		setReviewsState('error')
		return false
	}
}, [logError])
```
```tsx
// src/app/hooks/useReviewRequests.ts:60-74 — current search
setReviewsState('loading')
try {
	const items = await appRpc.request.searchGitHubPullRequests({
		mode: searchMode,
		query: searchQuery,
	})
	setSearchActive(true)
	setActiveSearchQuery(searchQuery)
	setReviews(items)
	setSelectedReviewId(items[0]?.id ?? null)
	setReviewsState('idle')
} catch (error) {
	logError('Could not search pull requests', error, 'GitHub PR search')
	setReviewsState('error')
}
```
`ReviewRequestList` never handles `'error'`. With no rows it renders a false successful-empty state; with rows it silently renders stale data:

```tsx
// src/features/reviews/components/inbox/ReviewRequestList.tsx:31-47 — current
if (reviewsState === 'loading') {
	return (
		<StatusCard
			title="Loading GitHub PRs"
			body="Loading your direct and team review requests..."
		/>
	)
}
if (reviews.length === 0) {
	return (
		<StatusCard
			title="No requested reviews found"
			body="GitHub did not return any open PRs where you or one of your teams is requested as a reviewer."
		/>
	)
}
```
The list also receives `displayedReviews`, which is locally filtered by the currently typed query. After a failed remote search that can hide the preserved raw rows:

```tsx
// src/app/App.tsx:125,235-244 — current
const displayedReviews = useReviewSearchFilter(query, reviews)
<MainReviewScreen
	// ...
	displayedReviews={displayedReviews}
	loadReviewRequests={loadReviewRequests}
```
## Target

### Make error precedence explicit and testable
Add a browser-free helper beside the inbox list:

```ts
// src/features/reviews/components/inbox/reviewRequestListState.ts — target API
import type { AsyncState } from '@/app/types'
export type ReviewRequestListState =
	| 'loading'
	| 'error-empty'
	| 'error-with-reviews'
	| 'empty'
	| 'ready'
export function getReviewRequestListState(
	reviewsState: AsyncState,
	reviewCount: number,
): ReviewRequestListState
```
Its precedence is: loading first; error split by whether preserved rows exist; then successful empty; otherwise ready. This prevents an error from ever reaching the normal empty branch.

### Render a retryable error without discarding stale rows
Extend the list API with `onRetry: () => void`. For `error-empty`, render only a red error status and Retry. For `error-with-reviews`, render that same status before the normal grouped/ungrouped rows:

```tsx
// src/features/reviews/components/inbox/ReviewRequestList.tsx — target error block
const errorStatus = (
	<Stack gap="3" role="alert">
		<StatusCard
			body="Check your GitHub connection and try again."
			title="Could not load GitHub PRs"
			tone="red"
		/>
		<Button alignSelf="flex-start" onClick={onRetry} size="sm">
			Retry
		</Button>
	</Stack>
)
```
Only construct/render this block for an error presentation. Keep the current loading and successful-empty copy unchanged. A retry returns to loading through the existing hook, and repeated failure returns to the same error presentation.

Pass the existing refresh callback through the current component chain:

```tsx
// src/features/reviews/components/ReviewInbox.tsx:82-88 — target addition
<ReviewRequestList
	groupByReviewRequest={!searchActive}
	onRetry={onRefresh}
	onSelectReview={onSelectReview}
	reviews={reviews}
	reviewsState={reviewsState}
	selectedReviewId={selectedReviewId}
/>
```
`MainReviewScreen` already wires `loadReviewRequests` to `ReviewInbox.onRefresh` at lines 89-100, so no second retry implementation or RPC path is needed.

### Preserve all available rows on failure
At the `App` call site, bypass local query filtering only while `reviewsState === 'error'`:

```tsx
// src/app/App.tsx:235-244 — target prop
<MainReviewScreen
	// ...
	displayedReviews={reviewsState === 'error' ? reviews : displayedReviews}
	loadReviewRequests={loadReviewRequests}
```
This makes initial failure show the standalone error, refresh failure show the prior inbox, and search failure show the prior successful rows rather than an empty/query-filtered masquerade. Do not clear reviews, selection, query, or search metadata in either catch path.

## Repo conventions to follow

- Reuse `StatusCard tone="red"` and the UI `Button`; do not expand the shared `StatusCard` API.
- Reuse `onRefresh` inside `ReviewInbox`; Retry must invoke the same `loadReviewRequests` callback as Refresh.
- Keep the hook’s existing error-log/toast reporting in addition to the persistent inline state.
- Keep the helper data-only so Vitest can import it in the existing Node environment.

## Steps

1. Add `reviewRequestListState.ts` and a colocated Node Vitest file covering all five outcomes, especially `('error', 0)` and `('error', positive count)`.
2. Update `ReviewRequestList.tsx` to accept `onRetry`, select the helper state, render the standalone initial error, and prepend the same error UI when stale rows exist.
3. Preserve the existing grouped and ungrouped list rendering under `ready` and `error-with-reviews`; do not duplicate card/group logic.
4. In `ReviewInbox.tsx`, pass `onRefresh` as `onRetry`. In `App.tsx`, pass raw `reviews` during errors and filtered reviews otherwise.
5. Re-read the five-file diff against `a283d84` and confirm both hook catch paths remain non-destructive.

## Boundaries

- Do NOT change GitHub RPCs, `AsyncState`, hook request timing, search modes, selection reconciliation, error logging, or startup error handling.
- Do NOT clear stale reviews or replace them with search results on failure; label them with the error state instead.
- Do NOT make Retry repeat the failed search; it must call `loadReviewRequests` and restore the normal inbox path.
- Do NOT show “No requested reviews found” while `reviewsState === 'error'`, even when there are zero visible rows.
- Do NOT add React Testing Library, jsdom, Playwright, a component/browser test, or dependencies. STOP on drift from commit `a283d84`.

## Verification

- **Mechanical**: run `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, and `pnpm run build`; then run `npx react-doctor@latest --scope changed` and confirm no new diagnostics or score regression.
- **Node tests**: confirm the pure helper distinguishes initial error from stale-row error and preserves loading/empty/ready precedence without importing a component or browser environment.
- **Initial-load runtime**: force `listGitHubReviewRequests` to reject before any success. Confirm the red “Could not load GitHub PRs” state and Retry appear, and successful Retry replaces it with rows or the legitimate empty state.
- **Stale inbox runtime**: load reviews successfully, then make Refresh reject. Confirm the concise error and Retry remain visible above the previous selectable rows; no false empty state or selection loss occurs.
- **Search runtime**: with existing rows, make `searchGitHubPullRequests` reject for a query that matches none locally. Confirm preserved rows remain visible beneath the error and Retry calls the inbox loader, not search; repeat with no prior rows and confirm only the error state appears.
- **Done when**: every review-list failure is visibly distinct, retryable through `loadReviewRequests`, and honest about preserved data versus a successful empty result.
