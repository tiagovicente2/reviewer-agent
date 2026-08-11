# 017 — Lock review submission

- **Status**: TODO
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 9 files, medium submission state-machine and policy fix

## Problem

`useReviewSubmission` records which event is loading, but it has no synchronous lock. Two calls can enter before React commits the state update, and success does not refresh details or remember that a terminal review was submitted:

```tsx
// src/features/reviews/hooks/generated-review/useReviewSubmission.ts:18-53 — current
const [submittingReviewEvent, setSubmittingReviewEvent] = useState<ReviewSubmitEvent | null>(null)
const { showToast } = useToast()

const submitReview = useCallback(
	async ({
		body,
		event,
		findings,
	}: {
		body?: string
		event: ReviewSubmitEvent
		findings?: ReviewFinding[]
	}) => {
		if (!detail || !generatedReview) return
		clearPublishError()
		setSubmittingReviewEvent(event)
		try {
			await appRpc.request.submitReview({
				body,
				event,
				findings,
				pullRequest: detail,
				reviewedHeadSha: generatedReview.reviewedHeadSha,
			})
			showToast({
				title: event === 'approve' ? 'Pull request approved' : 'Changes requested',
				description: 'The review was submitted on GitHub.',
				tone: 'success',
			})
		} catch (error) {
			reportPublishError(error)
		} finally {
			setSubmittingReviewEvent(null)
		}
	},
	[clearPublishError, detail, generatedReview, reportPublishError, showToast],
)
```

The action bar disables both buttons only for detail loading. While Approve is loading, Request changes is still enabled, and vice versa:

```tsx
// src/features/reviews/components/ReviewDetail.tsx:170-182 — current
<ReviewTabActions
	approving={submittingReviewEvent === 'approve'}
	canExportReview={Boolean(detail)}
	exporting={exportState === 'loading'}
	hasPublishableFindings={Boolean(publishableFindings.length)}
	onApprove={() => setPendingSubmitAction('approve')}
	onCopy={() => void copyReviewToClipboard()}
	onExport={() => void saveReviewToFile()}
	onRequestChanges={() => setPendingSubmitAction('request_changes')}
	requestingChanges={submittingReviewEvent === 'request_changes'}
	submissionDisabled={!detail || detailState === 'loading'}
/>
```

```tsx
// src/features/reviews/components/review-detail/ReviewTabActions.tsx:41-58 — current
<Button
	disabled={submissionDisabled}
	loading={approving}
	onClick={onApprove}
	size="sm"
	variant="outline"
>
	Approve
</Button>
{hasPublishableFindings ? (
	<Button
		disabled={submissionDisabled}
		loading={requestingChanges}
		onClick={onRequestChanges}
		size="sm"
	>
		Request changes
	</Button>
) : null}
```

The modal closes immediately, before the Promise settles, so it cannot hold the submission boundary or show retry state:

```tsx
// src/features/reviews/components/ReviewDetail.tsx:96-113 — current
const confirmSubmitReview = () => {
	if (pendingSubmitAction === 'approve') {
		void submitReview({
			body: '',
			event: 'approve',
		})
	}

	if (pendingSubmitAction === 'request_changes') {
		void submitReview({
			body: reviewDecisionBody.trim(),
			event: 'request_changes',
			findings: publishableFindings,
		})
	}

	setPendingSubmitAction(null)
}
```

The main process has no in-process lock or repeat/conflict check. It checks only head SHA before sending APPROVE or REQUEST_CHANGES:

```ts
// src/electron/services/review-publish.ts:77-85 — current
export async function submitReview(params: SubmitReviewParams): Promise<SubmitReviewResult> {
	const body = params.body?.trim()
	const latestHeadSha = await assertReviewTargetsLatestHead(params)
	if (params.event === 'approve') return submitApproval(params, body)

	const reviewFindings = filterNewFindings(
		params.pullRequest,
		dedupeFindings((params.findings ?? []).filter(isPublishableFinding)),
	)
```

After success, `detail.reviewDecision`, `detail.reviews`, `detail.reviewRequests`, and the header badge remain stale. The same action and the conflicting terminal action remain available. Double confirmation, rapid opposite actions, or stale UI can therefore submit repeat/conflicting reviews.

## Target

Define one pure submission policy used to gate the renderer and validate fresh backend state:

```ts
// src/shared/review-submission.ts — target
export type ReviewSubmissionPolicyInput = {
	currentUsername?: string
	detail: GitHubPullRequestDetails | null
	event: ReviewSubmitEvent
	reviewedHeadSha: string | null
	publishableFindingsCount: number
	submissionLocked: boolean
	submittedEvent: ReviewSubmitEvent | null
}

export type ReviewSubmissionPolicy = {
	allowed: boolean
	reason: string
}

export function getReviewSubmissionPolicy(
	input: ReviewSubmissionPolicyInput,
): ReviewSubmissionPolicy {
	if (input.submissionLocked) return { allowed: false, reason: 'A review is already being submitted.' }
	if (!input.currentUsername)
		return { allowed: false, reason: 'Reconnect GitHub before submitting a review.' }
	if (!input.detail || !input.reviewedHeadSha)
		return { allowed: false, reason: 'Load PR details and generate a review first.' }
	if (input.detail.state !== 'OPEN')
		return { allowed: false, reason: 'Reviews can only be submitted to an open pull request.' }
	if (input.detail.isDraft)
		return { allowed: false, reason: 'Wait until the pull request is ready for review.' }
	if (input.reviewedHeadSha !== input.detail.headSha)
		return { allowed: false, reason: 'Regenerate the review for the latest head before submitting.' }
	if (input.currentUsername?.toLowerCase() === input.detail.author.toLowerCase())
		return { allowed: false, reason: 'You cannot review your own pull request.' }
	if (input.submittedEvent)
		return { allowed: false, reason: 'A final review was already submitted for this draft.' }

	const latestOwnReview = getLatestReviewByAuthor(input.detail.reviews, input.currentUsername)
	if (latestOwnReview && ['APPROVED', 'CHANGES_REQUESTED'].includes(latestOwnReview.state)) {
		return { allowed: false, reason: 'You already submitted a final review for this pull request.' }
	}
	if (input.event === 'request_changes' && input.publishableFindingsCount === 0) {
		return { allowed: false, reason: 'Request changes needs at least one unpublished finding.' }
	}
	return { allowed: true, reason: '' }
}
```

`getLatestReviewByAuthor` must compare usernames case-insensitively and choose latest `submittedAt`, following the existing latest-review convention in `src/features/reviews/components/review-tabs/summary/reviewerStatus.ts:18-40`. If `currentUsername` is unavailable, do not guess another reviewer; return a reconnect/auth reason before enabling submission. A prior terminal review blocks both terminal events in this app; it must not offer Approve after Request changes or Request changes after Approve.

Pass the authenticated username already available in `App` to the detail screen:

```tsx
// src/app/App.tsx:235-262 — target addition
<MainReviewScreen
	// existing props
	currentUsername={currentAuthStatus.username}
/>

// MainReviewScreen target forwarding
<ReviewDetail
	// existing props
	currentUsername={currentUsername}
/>
```

Use a synchronous ref as the single renderer lock; React state alone is not the lock:

```tsx
// src/features/reviews/hooks/generated-review/useReviewSubmission.ts — target state
const submissionLockRef = useRef(false)
const [submittingReviewEvent, setSubmittingReviewEvent] = useState<ReviewSubmitEvent | null>(null)
const [submittedReviewState, setSubmittedReviewState] = useState<{
	pullRequestIdentity: string
	event: ReviewSubmitEvent
} | null>(null)
```

The submit function must return success/failure, acquire before the first await, and refresh details after GitHub success:

```tsx
// src/features/reviews/hooks/generated-review/useReviewSubmission.ts — target skeleton
const submitReview = useCallback(async (request: SubmitReviewRequest) => {
	if (!detail || !generatedReview || submissionLockRef.current) return false

	const pullRequestIdentity = getPullRequestIdentity(detail)
	const policy = getReviewSubmissionPolicy({
		currentUsername,
		detail,
		event: request.event,
		publishableFindingsCount: request.findings?.length ?? 0,
		reviewedHeadSha: generatedReview.reviewedHeadSha,
		submissionLocked: false,
		submittedEvent,
	})
	if (!policy.allowed) {
		reportPublishError(policy.reason)
		return false
	}

	submissionLockRef.current = true
	setSubmittingReviewEvent(request.event)
	clearPublishError()
	try {
		await appRpc.request.submitReview(/* existing payload */)
		setSubmittedReviewState({ pullRequestIdentity, event: request.event })
		showToast(/* existing success copy */)

		const refreshedDetail = await appRpc.request.getGitHubPullRequestDetails({
			forceRefresh: true,
			pullRequestNumber: detail.pullRequestNumber,
			repo: detail.repo,
		})
		if (selectedPullRequestIdentityRef.current === pullRequestIdentity) {
			onPullRequestDetailRefresh(refreshedDetail)
		}
		return true
	} catch (error) {
		reportPublishError(error)
		return false
	} finally {
		submissionLockRef.current = false
		setSubmittingReviewEvent(null)
	}
}, [/* complete dependencies */])
```

Separate “GitHub submission failed” from “submission succeeded but detail refresh failed”: once `submitReview` succeeds, keep `submittedReviewState` and the success toast even if refresh fails; show a visible refresh warning and offer the existing PR/detail refresh path rather than treating the GitHub mutation as retryable.

`confirmSubmitReview` must await the result and close only on success:

```tsx
// src/features/reviews/components/ReviewDetail.tsx — target
const confirmSubmitReview = async () => {
	if (!pendingSubmitAction) return
	const submitted = await submitReview({
		body: pendingSubmitAction === 'request_changes' ? reviewDecisionBody.trim() : '',
		event: pendingSubmitAction,
		findings: pendingSubmitAction === 'request_changes' ? publishableFindings : undefined,
	})
	if (submitted) setPendingSubmitAction(null)
}
```

Derive separate policies for Approve and Request changes. Disable both buttons whenever either submission is active; set each button's `title` to its policy reason and keep invalid actions visible but disabled so users understand state. The modal receives `submitting={submittingReviewEvent !== null}`, cannot close during submission, and its confirm button is disabled as well as loading.

Add a second authority boundary in the main process. Serialize `submitReview` per `repo#pullRequestNumber`, fetch fresh auth/details after acquiring the lock, run the same policy, and remember the successful terminal event for that PR:

```ts
// src/electron/services/review-publish.ts — target backend state
const reviewSubmissionLocks = new Set<string>()
const completedReviewSubmissions = new Map<string, ReviewSubmitEvent>()

export async function submitReview(params: SubmitReviewParams): Promise<SubmitReviewResult> {
	const key = `${params.pullRequest.repo}#${params.pullRequest.pullRequestNumber}`
	if (reviewSubmissionLocks.has(key)) throw new Error('A review is already being submitted.')
	if (completedReviewSubmissions.has(key)) {
		throw new Error('A final review was already submitted for this pull request.')
	}

	reviewSubmissionLocks.add(key)
	try {
		const [auth, latestDetail] = await Promise.all([
			getGitHubAuthStatus(),
			getGitHubPullRequestDetails({
				forceRefresh: true,
				pullRequestNumber: params.pullRequest.pullRequestNumber,
				repo: params.pullRequest.repo,
			}),
		])
		// Build backend policy input from fresh auth/detail and validated payload.
		// Submit exactly one terminal event using the existing GitHub commands.
		const result = await submitValidatedReview(params)
		completedReviewSubmissions.set(key, params.event)
		return result
	} finally {
		reviewSubmissionLocks.delete(key)
	}
}
```

The in-memory completed map is defense against GitHub read-after-write lag; fresh details protect across app restarts. Keep the existing latest-head check as a separate requirement before any submission.

## Repo conventions to follow

- Imitate latest-review selection from `src/features/reviews/components/review-tabs/summary/reviewerStatus.ts` and test it as a pure helper.
- Keep the authenticated username sourced from `currentAuthStatus.username` in `src/app/App.tsx:179-180,235-262`; do not call auth RPC from a renderer component.
- Keep RPC mutation orchestration in `useReviewSubmission` and backend authority in `review-publish.ts`.
- Use `onPullRequestDetailRefresh`, already present in `ReviewDetailProps` at `src/features/reviews/components/ReviewDetail.tsx:27-35`.
- Expand existing Node Vitest publication tests with mocked services/commands; do not add a frontend renderer.

## Steps

1. Add `src/shared/review-submission.ts` with `getLatestReviewByAuthor` and exact policy reasons; export only pure data functions.
2. Thread `currentUsername` from `App` through `MainReviewScreen` into `ReviewDetail`, then into `useGeneratedReview`/`useReviewSubmission`.
3. Add one synchronous `submissionLockRef`, PR-scoped submitted state, and selected-identity ref to `useReviewSubmission`. Return `Promise<boolean>` and reject duplicate entry before any RPC.
4. Compute approve/request-changes policies in `ReviewDetail`; disable both actions while either is submitting and gate closed/draft/self-review/stale-head/already-reviewed/no-findings cases with visible reasons.
5. Make confirmation async, keep the modal mounted and non-dismissible while submitting, close only after success, and leave it open with the error visible after failure.
6. After GitHub success, set local submitted state first, show success, force-refresh PR details, and apply refreshed detail only if the same PR remains selected. Distinguish refresh failure from mutation failure.
7. Wrap the main-process `submitReview` with a per-PR lock and completed-event map. Fetch fresh auth/details inside the lock, rerun policy, and only then call the existing approve/request-changes command path.
8. Preserve the existing latest-head check and GitHub payloads. Ensure any thrown path releases the lock and only a successful GitHub mutation enters `completedReviewSubmissions`.
9. Add Node Vitest tests in `src/shared/review-submission.test.ts` and expand `src/electron/services/review-publish.test.ts` for policy and concurrency cases.
10. Re-read the action/modal/hook/backend diff and remove unrelated UI or GitHub behavior changes.

## Boundaries

- Do NOT use `submittingReviewEvent` state alone as the lock; acquire a synchronous ref before the first await.
- Do NOT lock Approve and Request changes independently; one terminal submission blocks both.
- Do NOT close the confirmation modal before the Promise succeeds.
- Do NOT infer the current reviewer from the PR's review list; use authenticated `currentUsername`.
- Do NOT gate on aggregate `reviewDecision` alone because it may describe another reviewer's decision.
- Do NOT mark submission complete on RPC failure, and do NOT classify post-success refresh failure as submission failure.
- Do NOT allow a stale PR A refresh to overwrite selected PR B.
- Do NOT add dependencies or component/browser test infrastructure; use existing Node Vitest only.
- Do NOT change GitHub review body/comment semantics except to reject invalid, duplicate, or conflicting terminal actions.
- STOP if the cited source differs from commit `a283d84`; report drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm exec vitest run src/shared/review-submission.test.ts src/electron/services/review-publish.test.ts`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` reports no new diagnostic and does not lower the score; this submission state-machine finding is Beyond the scan.
- **Node behavior tests**:
  - Policy rejects missing auth/detail/review, closed PR, draft PR, self-review, stale generated head, zero-finding Request changes, active lock, local completion, and latest own APPROVED/CHANGES_REQUESTED review.
  - Policy does not confuse another reviewer's terminal review with the current user's review.
  - Two concurrent same-PR submissions issue exactly one GitHub mutation; the other gets the lock error.
  - A second event after success is rejected even if the mocked fresh details lag; failure releases the lock and permits retry.
  - A different PR uses a different key and is not blocked by another PR's submission.
- **Behavior check**:
  - Open Approve confirmation and double-click Confirm; inspect command/API logs and GitHub to confirm exactly one approval.
  - While approval is pending, verify both Approve and Request changes are disabled, the modal cannot close, and no conflicting request can start.
  - After success, confirm the modal closes, the header/status/reviewer detail refreshes, success feedback remains visible, and both terminal actions are gated.
  - Repeat for Request changes. Simulate a failed mutation and confirm the modal stays open for one retry; simulate only refresh failure and confirm the app says the review succeeded but status refresh failed.
  - Start submission on PR A and select PR B; confirm A's late refresh never replaces B, then return to A and refresh to see the submitted status.
- **Done when**: one renderer lock and one backend per-PR authority permit exactly one valid terminal review, conflicting/repeat actions are gated with reasons, and successful submission refreshes visible PR status without stale cross-PR writes.
