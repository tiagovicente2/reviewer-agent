# 015 — Isolate generation by pull request

- **Status**: DONE
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 3 files, medium async-race fix

## Problem

The generated-review hook uses one set of state for every selected PR and tracks only a mutable PR identity string:

```tsx
// src/features/reviews/hooks/generated-review/useReviewGeneration.ts:27-43 — current
const [generatedReview, setGeneratedReview] = useState<GeneratedReview | null>(null)
const [generationState, setGenerationState] = useState<AsyncState>('idle')
const [generationError, setGenerationError] = useState('')
const [generationMessage, setGenerationMessage] = useState('')
const [generationOutputText, setGenerationOutputText] = useState('')
const [generationJobId, setGenerationJobId] = useState<string | null>(null)
const generatingPullRequestIdentityRef = useRef<string | null>(null)
const { showToast } = useToast()

const isGeneratingPullRequest = useCallback(
	(pullRequest: GitHubPullRequestDetails | null) =>
		Boolean(
			pullRequest &&
				generatingPullRequestIdentityRef.current === getPullRequestIdentity(pullRequest),
		),
	[],
)
```

The initial saved-review/job lookup has a local cancellation flag, but the explicit Generate flow does not. After generation starts for PR A, each awaited result unconditionally updates shared detail, diff, job, progress, and review state:

```tsx
// src/features/reviews/hooks/generated-review/useReviewGeneration.ts:164-198 — current
try {
	const latestDetail = await appRpc.request.getGitHubPullRequestDetails({
		forceRefresh: true,
		pullRequestNumber: detail.pullRequestNumber,
		repo: detail.repo,
	})
	onPullRequestDetailRefresh(latestDetail)
	const { diff: loadedDiff } = await appRpc.request.getGitHubPullRequestDiff({
		forceRefresh: true,
		headSha: latestDetail.headSha,
		pullRequestNumber: latestDetail.pullRequestNumber,
		repo: latestDetail.repo,
	})
	onUpdatedDiff(loadedDiff)
	setGenerationMessage('Starting review generation...')
	setGenerationOutputText(
		getLocalReviewProgressOutput([
			'Loading the latest PR diff before starting review generation...',
			'Starting review generation...',
		]),
	)
	const job = await appRpc.request.startReviewGeneration({
		instructionId,
		pullRequest: { ...latestDetail, diff: loadedDiff },
	})
	setGenerationJobId(job.id)
	setGenerationMessage(job.statusMessage ?? '')
	setGenerationOutputText(job.outputText ?? '')
	if (job.status === 'completed' && job.review) completeGeneration(job.review)
} catch (error) {
	generatingPullRequestIdentityRef.current = null
	setGenerationMessage('')
	setGenerationError(getErrorMessage(error))
	setGenerationState('error')
	setGenerationOutputText('')
}
```

`completeGeneration` also has no PR/job argument to validate:

```tsx
// src/features/reviews/hooks/generated-review/useReviewGeneration.ts:45-57 — current
const completeGeneration = useCallback(
	(review: GeneratedReview) => {
		generatingPullRequestIdentityRef.current = null
		setGeneratedReview(review)
		onSummary(review.publishableBody || review.summary)
		setGenerationState('idle')
		setGenerationOutputText('')
		showToast({
			title: 'Review completed',
			description: 'A draft review was generated.',
			tone: 'success',
		})
	},
	[onSummary, showToast],
)
```

The polling effect validates only its own cleanup flag, not that the selected PR still owns the job:

```tsx
// src/features/reviews/hooks/generated-review/useReviewGeneration.ts:107-120 — current
useEffect(() => {
	if (!generationJobId) return

	let cancelled = false
	const interval = window.setInterval(async () => {
		try {
			const job = await appRpc.request.getReviewGenerationJob({ jobId: generationJobId })
			if (cancelled || !job) return
			setGenerationMessage(job.statusMessage ?? '')
			setGenerationOutputText(job.outputText ?? '')

			if (job.status === 'completed' && job.review) {
				completeGeneration(job.review)
				setGenerationJobId(null)
			}
```

User impact: select PR B while PR A is refreshing details, loading a diff, starting a job, or polling. A late result can replace B's global details through `onPullRequestDetailRefresh`, replace B's diff, show A's progress/error/toast, or render and submit A's generated findings under B.

## Target

Use an operation token that contains both PR identity and a monotonically increasing request ID. Selection changes and a newer generation invalidate older tokens. Put the token logic in a pure utility so the race contract is testable in Node:

```ts
// src/features/reviews/hooks/generated-review/reviewGenerationUtils.ts — target
export type ReviewGenerationToken = {
	pullRequestIdentity: string
	requestId: number
}

export function createReviewGenerationGuard() {
	let nextRequestId = 0
	let selectedPullRequestIdentity: string | null = null
	let activeToken: ReviewGenerationToken | null = null

	return {
		select(pullRequestIdentity: string | null) {
			selectedPullRequestIdentity = pullRequestIdentity
			if (activeToken?.pullRequestIdentity !== pullRequestIdentity) activeToken = null
		},
		begin(pullRequestIdentity: string) {
			const token = { pullRequestIdentity, requestId: ++nextRequestId }
			selectedPullRequestIdentity = pullRequestIdentity
			activeToken = token
			return token
		},
		isCurrent(token: ReviewGenerationToken) {
			return (
				activeToken === token &&
				selectedPullRequestIdentity === token.pullRequestIdentity
			)
		},
		complete(token: ReviewGenerationToken) {
			const current =
				activeToken === token &&
				selectedPullRequestIdentity === token.pullRequestIdentity
			if (!current) return false
			activeToken = null
			return true
		},
	}
}
```

Do not rely only on comparing `reviewedHeadSha`: two PRs can have unrelated state and a job result must match both `repo#number` and the active operation.

In the hook, retain the token beside the job ID:

```tsx
// src/features/reviews/hooks/generated-review/useReviewGeneration.ts — target state
const generationGuardRef = useRef(createReviewGenerationGuard())
const selectedPullRequestIdentity = detail ? getPullRequestIdentity(detail) : null
const [generationJob, setGenerationJob] = useState<{
	jobId: string
	token: ReviewGenerationToken
} | null>(null)

generationGuardRef.current.select(selectedPullRequestIdentity)
```

`completeGeneration` must reject stale completions before every callback or state write:

```tsx
// src/features/reviews/hooks/generated-review/useReviewGeneration.ts — target
const completeGeneration = useCallback(
	(token: ReviewGenerationToken, review: GeneratedReview) => {
		if (!generationGuardRef.current.complete(token)) return false
		setGeneratedReview(review)
		onSummary(review.publishableBody || review.summary)
		setGenerationState('idle')
		setGenerationMessage('')
		setGenerationOutputText('')
		setGenerationJob(null)
		showToast({
			title: 'Review completed',
			description: 'A draft review was generated.',
			tone: 'success',
		})
		return true
	},
	[onSummary, showToast],
)
```

Capture a token at click time and guard after every `await`, before all callbacks and state writes:

```tsx
// src/features/reviews/hooks/generated-review/useReviewGeneration.ts — target Generate skeleton
const pullRequestIdentity = getPullRequestIdentity(detail)
const token = generationGuardRef.current.begin(pullRequestIdentity)

try {
	const latestDetail = await appRpc.request.getGitHubPullRequestDetails(/* existing params */)
	if (!generationGuardRef.current.isCurrent(token)) return
	onPullRequestDetailRefresh(latestDetail)

	const { diff: loadedDiff } = await appRpc.request.getGitHubPullRequestDiff(/* existing params */)
	if (!generationGuardRef.current.isCurrent(token)) return
	onUpdatedDiff(loadedDiff)
	setGenerationMessage('Starting review generation...')
	setGenerationOutputText(/* existing output */)

	const job = await appRpc.request.startReviewGeneration(/* existing params */)
	if (!generationGuardRef.current.isCurrent(token)) return
	setGenerationJob({ jobId: job.id, token })
	setGenerationMessage(job.statusMessage ?? '')
	setGenerationOutputText(job.outputText ?? '')
	if (job.status === 'completed' && job.review) completeGeneration(token, job.review)
} catch (error) {
	if (!generationGuardRef.current.isCurrent(token)) return
	generationGuardRef.current.complete(token)
	setGenerationMessage('')
	setGenerationError(getErrorMessage(error))
	setGenerationState('error')
	setGenerationOutputText('')
	setGenerationJob(null)
}
```

For restored running jobs, create a token for the captured detail identity only after the saved-review/job lookup is confirmed not cancelled, then set `{ jobId, token }`. The polling effect must call `isCurrent(generationJob.token)` immediately after each await and pass that token to `completeGeneration`. On PR selection change, reset only the visible selected-PR state; do not cancel or delete the Electron background job. Returning to PR A must rediscover its job with `getReviewGenerationJob`.

## Repo conventions to follow

- Imitate the cancellation-before-state-write pattern in `src/app/hooks/usePullRequestDetails.ts:25-50`.
- Keep PR identity in `getPullRequestIdentity`, currently `src/features/reviews/hooks/generated-review/reviewGenerationUtils.ts:26-30`.
- Keep generation RPC orchestration in `useReviewGeneration`; do not move it into `ReviewDetail`.
- Add pure tests beside existing `reviewGenerationUtils.test.ts`; use deferred Promises only in Node Vitest and no rendered hooks.
- Preserve background job IDs from `getReviewGenerationJobId(detail)` and the 1500 ms polling cadence.

## Steps

1. Add `ReviewGenerationToken` and `createReviewGenerationGuard` to `reviewGenerationUtils.ts` with exact select/begin/isCurrent/complete semantics.
2. Replace `generationJobId` plus `generatingPullRequestIdentityRef` with the guard and a `{ jobId, token }` polling state; keep selected identity synchronized before asynchronous completions can commit.
3. Update selected-PR restoration to capture identity, honor its existing cancellation flag, create a token only for a running job, and never install a saved review/job for another selection.
4. Guard the detail refresh, diff update, progress state, job state, errors, completion toast, generated review, and summary callback after every await in `generateReview`.
5. Guard every polling result and polling error with the stored token; stale results are ignored without clearing or changing the newly selected PR.
6. Preserve Electron background jobs when leaving a PR so returning to that PR restores/polls the existing job instead of starting a duplicate.
7. Add Node Vitest tests proving: A is current after `begin(A)`; `select(B)` invalidates A; a late A completion cannot complete; B remains current; a second `begin(B)` invalidates the first B token; and completing a token makes duplicate completion false.
8. Add a deferred-Promise utility test that models A resolving after selection B and asserts only B's callback recorder is updated. Do not render the hook.
9. Re-read all async branches and verify there is no state setter, toast, `onSummary`, `onUpdatedDiff`, or `onPullRequestDetailRefresh` call after an await without a current-token check.

## Boundaries

- Do NOT cancel or remove an Electron generation job merely because the user selected another PR.
- Do NOT let stale A failures replace B's generation error or loading state.
- Do NOT key isolation by PR number alone; identity is `repo#pullRequestNumber`, and the active operation also needs its request ID.
- Do NOT accept checking only `cancelled`, only `generationJobId`, or only `reviewedHeadSha` as the fix.
- Do NOT change RPC payloads, generation prompts, polling cadence, saved-review storage, toast copy, or diff content.
- Do NOT add component, hook-renderer, jsdom, fake-browser, or browser automation dependencies; use existing Node Vitest only.
- Do NOT combine this with edited-comment persistence, publication reconciliation, or review-submission policy.
- STOP if the cited source differs from commit `a283d84`; report drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm exec vitest run src/features/reviews/hooks/generated-review/reviewGenerationUtils.test.ts`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` reports no new diagnostic and does not lower the score; this async race is Beyond the scan.
- **Behavior check**:
  - Start generation on PR A and immediately select PR B while A is refreshing details. Confirm B's title, head SHA, diff, summary, and Review tab never change to A.
  - Repeat the switch while A is polling. Confirm no A progress, error, completion toast, or findings appear on B.
  - Let A finish in the background, return to A, and confirm its completed job/draft is restored.
  - Start two generations for the same PR in succession where possible; confirm only the newest operation can update visible state.
- **Done when**: every async generation result is authorized by a current PR-scoped operation token, stale results are inert, and background jobs remain recoverable on their own PR.
