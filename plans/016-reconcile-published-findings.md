# 016 — Reconcile published findings

- **Status**: DONE
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 9 files, medium publication-state and backend-idempotency fix

## Problem

Individual publication reports no success in local state and does not refresh PR threads. The finding remains editable and publishable after GitHub accepts it:

```tsx
// src/features/reviews/hooks/generated-review/useFindingPublishing.ts:42-63 — current
const publishFinding = useCallback(
	async (finding: ReviewFinding) => {
		if (!detail || !generatedReview) return
		setPublishErrorState(null)
		setPublishingFindingIds((current) => new Set(current).add(finding.id))
		try {
			await appRpc.request.publishReviewComment({
				finding,
				pullRequest: detail,
				reviewedHeadSha: generatedReview.reviewedHeadSha,
			})
		} catch (error) {
			reportPublishError(error)
		} finally {
			setPublishingFindingIds((current) => {
				const next = new Set(current)
				next.delete(finding.id)
				return next
			})
		}
	},
	[detail, generatedReview, reportPublishError],
)
```

The card always renders Publish and Discard actions and has no published state:

```tsx
// src/features/reviews/components/EditableFindingCard.tsx:51-68 — current
<HStack gap="2">
	<Button
		colorPalette="red"
		disabled={publishing}
		onClick={() => onDiscardFinding?.(finding.id)}
		size="xs"
		variant="outline"
	>
		Discard comment
	</Button>
	<Button
		disabled={!canPublish}
		loading={publishing}
		onClick={() => onPublishFinding?.(publishableFinding)}
		size="xs"
	>
		Publish comment
	</Button>
</HStack>
```

Request changes continues to include every structurally publishable finding, including one just published individually:

```tsx
// src/features/reviews/components/ReviewDetail.tsx:79-82,104-109 — current
const publishableFindings = useMemo(
	() => generatedReview?.findings.filter(isPublishableFinding) ?? [],
	[generatedReview],
)

void submitReview({
	body: reviewDecisionBody.trim(),
	event: 'request_changes',
	findings: publishableFindings,
})
```

The main process deduplicates only against the `pullRequest.reviewThreads` snapshot sent by the renderer:

```ts
// src/electron/services/review-publish.ts:224-250 — current
function filterNewFindings(
	pullRequest: PublishReviewCommentsParams['pullRequest'],
	findings: ReviewFinding[],
) {
	const existingCommentKeys = new Set(
		pullRequest.reviewThreads.flatMap((thread) =>
			thread.comments.map((comment) =>
				getCommentKey({
					body: comment.body,
					line: thread.line,
					path: thread.path,
				}),
			),
		),
	)

	return findings.filter((finding) => {
		const body = getCommentBody(finding)
		if (!body) return true
		return !existingCommentKeys.has(
			getCommentKey({
				body,
				line: finding.lineStart,
				path: finding.filePath,
			}),
		)
	})
}
```

That snapshot is not refreshed after publication. A second individual click or a subsequent bulk Request changes can duplicate the same path/line/body. Concurrent individual and bulk actions can both pass the stale check before either comment exists. The only success result is generic text and does not identify which findings were published:

```ts
// src/shared/review.ts:103-108 — current
export type PublishReviewCommentResult = {
	ok: true
	output: string
}

export type SubmitReviewResult = PublishReviewCommentResult
```

User impact: the app gives no durable visual confirmation, may send duplicate GitHub comments, and cannot reconcile local findings with threads published in this app or elsewhere.

## Target

Represent publication on a finding and return machine-readable outcomes:

```ts
// src/shared/review.ts — target
export type ReviewFindingPublication = {
	state: 'published'
	publishedAt?: string
	commentUrl?: string
}

export type ReviewFinding = {
	// existing fields
	publication?: ReviewFindingPublication
}

export type PublishReviewCommentResult = {
	ok: boolean
	output: string
	publishedFindingIds: string[]
	alreadyPublishedFindingIds: string[]
	failures: Array<{ findingId: string; message: string }>
}

export type SubmitReviewResult = {
	ok: true
	output: string
	publishedFindingIds: string[]
	alreadyPublishedFindingIds: string[]
}
```

Create pure shared reconciliation helpers used by both renderer and main process. One normalized identity must define duplicates everywhere:

```ts
// src/shared/review-publication.ts — target
export function normalizeReviewCommentBody(body: string) {
	return body.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function getFindingCommentBody(
	finding: Pick<ReviewFinding, 'body' | 'suggestedCommentBody'>,
) {
	return finding.suggestedCommentBody ?? finding.body
}

export function getReviewCommentKey(params: { body?: string; line?: number; path?: string }) {
	return `${params.path ?? ''}:${params.line ?? ''}:${normalizeReviewCommentBody(params.body ?? '')}`
}

export function isPublishableFinding(finding: ReviewFinding) {
	return Boolean(
		finding.publication?.state !== 'published' &&
		finding.filePath &&
		finding.lineStart &&
		getFindingCommentBody(finding).trim(),
	)
}
```

Also export exact pure operations:

```ts
markFindingsPublished(
	review: GeneratedReview,
	findingIds: Iterable<string>,
	publishedAt?: string,
): GeneratedReview

reconcilePublishedFindings(
	review: GeneratedReview,
	threads: GitHubPullRequestReviewThread[],
): GeneratedReview
```

`reconcilePublishedFindings` must match normalized path + right-side line + current finding comment body against every thread comment. For a match, set `publication.state = 'published'` and copy `createdAt`/`url`; preserve object identity when nothing changes. Do not match on finding ID because GitHub does not know local IDs. Do not clear an existing published marker merely because a truncated/temporarily stale thread response lacks the comment.

Serialize all publication mutations per `repo#pullRequestNumber` in the main process, and fetch fresh details/threads *inside* the lock before filtering:

```ts
// src/electron/services/review-publish.ts — target lock
const publicationQueues = new Map<string, Promise<unknown>>()

function serializePublication<T>(key: string, work: () => Promise<T>): Promise<T> {
	const previous = publicationQueues.get(key) ?? Promise.resolve()
	const next = previous.catch(() => undefined).then(work)
	publicationQueues.set(key, next)
	return next.finally(() => {
		if (publicationQueues.get(key) === next) publicationQueues.delete(key)
	})
}
```

```ts
// src/electron/services/review-publish.ts — target entry shape
export function publishReviewComments(
	params: PublishReviewCommentsParams,
): Promise<PublishReviewCommentResult> {
	const key = `${params.pullRequest.repo}#${params.pullRequest.pullRequestNumber}`
	return serializePublication(key, async () => {
		const latestPullRequest = await getGitHubPullRequestDetails({
			forceRefresh: true,
			pullRequestNumber: params.pullRequest.pullRequestNumber,
			repo: params.pullRequest.repo,
		})
		assertReviewTargetsHead(params.reviewedHeadSha, latestPullRequest.headSha)
		// dedupe input, partition against latestPullRequest.reviewThreads,
		// publish only new findings, and return IDs in all outcome buckets
	})
}
```

The same queue and fresh-thread partition must wrap Request changes comment submission. If every requested finding already exists, do not publish duplicate inline comments; return those IDs in `alreadyPublishedFindingIds`. An individual all-already-present request is an idempotent success, not the current generic error. A Request changes review may still submit its non-empty review body with zero new inline comments; reject it before GitHub only when both body and new comments are empty.

In the renderer, apply IDs immediately, then force-refresh and reconcile:

```tsx
// src/features/reviews/hooks/generated-review/useFindingPublishing.ts — target success path
const result = await appRpc.request.publishReviewComment(/* existing payload */)
const publishedIds = [...result.publishedFindingIds, ...result.alreadyPublishedFindingIds]
setGeneratedReview((current) =>
	current ? markFindingsPublished(current, publishedIds, new Date().toISOString()) : current,
)

const refreshedDetail = await appRpc.request.getGitHubPullRequestDetails({
	forceRefresh: true,
	pullRequestNumber: detail.pullRequestNumber,
	repo: detail.repo,
})
onPullRequestDetailRefresh(refreshedDetail)
setGeneratedReview((current) =>
	current ? reconcilePublishedFindings(current, refreshedDetail.reviewThreads) : current,
)
```

Apply the same result/reconciliation path after successful Request changes in `useReviewSubmission`. Guard callbacks by captured PR identity so refresh from PR A cannot replace selected PR B. `publishableFindings` must use the shared `isPublishableFinding` and exclude `publishingFindingIds` while an individual request is in flight.

Published card target:

```tsx
// src/features/reviews/components/EditableFindingCard.tsx — target behavior
const published = finding.publication?.state === 'published'

{published ? <Badge colorPalette="green">Published</Badge> : null}
<Button
	disabled={published || !canPublish}
	loading={publishing}
	onClick={() => onPublishFinding?.(publishableFinding)}
	size="xs"
>
	{published ? 'Published' : 'Publish comment'}
</Button>
<Textarea disabled={published} /* existing controlled props */ />
```

Hide Discard for published findings. Show a success toast for newly published comments and an informational toast for comments reconciled as already present. Keep failures visible, including partial failures, while still marking successful IDs.

## Repo conventions to follow

- Imitate the existing mocked `runCommand` Node tests in `src/electron/services/review-publish.test.ts:1-70`.
- Keep GitHub CLI and mutation serialization in `src/electron/services/review-publish.ts`; keep presentation in `EditableFindingCard`.
- Use `onPullRequestDetailRefresh`, already threaded through `ReviewDetail.tsx:27-73`, rather than creating a second detail owner.
- Keep normalized matching pure and shared; do not duplicate subtly different trim/case rules in renderer and main process.
- Preserve existing `Promise.allSettled` behavior so all independent individual publications settle and partial outcomes remain reportable.

## Steps

1. Add publication metadata and machine-readable publication/submission result types in `src/shared/review.ts`; extend IPC validation for optional publication metadata.
2. Add `src/shared/review-publication.ts` with comment-body access, normalized keys, publishability, marking, partitioning, and thread reconciliation helpers.
3. Replace private duplicate matching in `review-publish.ts` with the shared helpers; add the per-PR serialization queue and force-refresh latest detail/threads inside it.
4. Return `publishedFindingIds`, `alreadyPublishedFindingIds`, and per-finding failures. Preserve successes when another finding fails; treat an already-present individual comment as idempotent success.
5. Use the same fresh partition for Request changes so individually published findings are omitted from bulk comments; permit a body-only change request and reject an empty/no-new-comment request.
6. Pass `onPullRequestDetailRefresh` and `setGeneratedReview` into publication and submission workflows. Mark result IDs immediately, then refresh/reconcile threads without allowing a stale PR callback to update another selection.
7. Derive bulk `publishableFindings` from the shared helper and exclude in-flight IDs. Update card UI to show Published, disable editing/republication, and hide Discard after publication.
8. Add success/already-present toasts and retain visible partial-failure text; do not replace a successful marker with an error-only blank review screen.
9. Add Node Vitest coverage in `src/shared/review-publication.test.ts` and expand `src/electron/services/review-publish.test.ts` for all cases below.
10. Re-read the diff and remove unrelated publication API or UI changes.

## Boundaries

- Do NOT trust renderer-supplied `reviewThreads` as the final duplicate check.
- Do NOT use finding ID alone to reconcile a GitHub comment.
- Do NOT remove a finding after publication; keep it visible and marked Published.
- Do NOT clear a published marker when thread fetching fails or returns a capped/stale list.
- Do NOT publish duplicate comments merely to obtain an API success response.
- Do NOT silently swallow partial failures; return and display successful IDs and failures together.
- Do NOT add dependencies or component/browser test infrastructure; use existing Node Vitest only.
- Do NOT broaden this plan into approval/request-changes conflict policy beyond preventing duplicate inline comments.
- STOP if the cited source differs from commit `a283d84`; report drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm exec vitest run src/shared/review-publication.test.ts src/electron/services/review-publish.test.ts`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` reports no new diagnostic and does not lower the score; this reconciliation/idempotency finding is Beyond the scan.
- **Node behavior tests**:
  - Normalization matches case/whitespace variants but not another path or line.
  - Reconciliation marks the correct finding with thread timestamp/URL, preserves unrelated findings, and is identity-preserving on no-op.
  - A stale renderer snapshot plus a fresh matching thread produces no GitHub comment POST and returns the ID as already published.
  - Two same-PR operations serialize; the second refresh sees the first comment and does not duplicate it.
  - Partial individual publication returns successful IDs and failure details.
  - Request changes omits already-published findings from `comments` while retaining new comments and the review body.
- **Behavior check**:
  - Publish one finding. Confirm a success toast, a Published badge, disabled textarea/button, refreshed Code-tab thread, and no Discard action.
  - Click/trigger publication again and then Request changes. Confirm GitHub contains exactly one copy of the individual path/line/body and bulk submission includes only remaining findings.
  - Publish the same normalized comment outside the app, refresh details, and confirm the local finding reconciles to Published with informational feedback.
  - Force one of two publications to fail and verify the successful finding remains marked while the failure stays visible and retryable.
- **Done when**: local publication state and fresh GitHub threads reconcile, individual and bulk paths are idempotent and serialized, successful findings are visibly marked, and no duplicate inline comment is emitted.
