# 014 — Preserve edited review comments

- **Status**: DONE
- **Commit**: `a283d84`
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 10 files, medium state-ownership and draft-persistence fix

## Problem

`EditableFindingCard` owns the edited comment in component-local state. The parent `GeneratedReview` remains unchanged:

```tsx
// src/features/reviews/components/EditableFindingCard.tsx:24-29 — current
const [commentBody, setCommentBody] = useState(finding.suggestedCommentBody || finding.body)
const canPublish = Boolean(finding.filePath && finding.lineStart && commentBody.trim())
const publishableFinding = {
	...finding,
	suggestedCommentBody: commentBody.trim(),
}
```

Only the individual Publish button receives that temporary copy:

```tsx
// src/features/reviews/components/EditableFindingCard.tsx:61-68 — current
<Button
	disabled={!canPublish}
	loading={publishing}
	onClick={() => onPublishFinding?.(publishableFinding)}
	size="xs"
>
	Publish comment
</Button>
```

Every other action still consumes `generatedReview`, whose findings contain the generated text. Request changes derives its payload from that stale object:

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

Copy and Export also receive the unchanged review:

```tsx
// src/features/reviews/components/ReviewDetail.tsx:74-77 — current
const { copyReviewToClipboard, exportError, exportState, saveReviewToFile } = useReviewExport({
	detail,
	generatedReview,
})
```

The formatter confirms that it reads the finding model, not card-local state:

```ts
// src/shared/review-export.ts:16-30 — current
.map((finding, index) => {
	const location = finding.lineStart
		? `${finding.filePath}:${finding.lineStart}${finding.lineEnd ? `-${finding.lineEnd}` : ''}`
		: finding.filePath
	const comment = finding.suggestedCommentBody || finding.body
	return [
		`### ${index + 1}. ${finding.title}`,
		`- Severity: ${finding.severity}`,
		`- Location: ${location}`,
		`- Confidence: ${Math.round(finding.confidence * 100)}%`,
		'',
		finding.body,
		comment && comment !== finding.body
			? ['', '**Suggested comment**', '', comment].join('\n')
			: '',
```

Switching to another PR resets and reloads `generatedReview` from the saved generated-review store, which still contains the original text:

```tsx
// src/features/reviews/hooks/generated-review/useReviewGeneration.ts:61-84 — current
useEffect(() => {
	if (isGeneratingPullRequest(detail)) return

	setGeneratedReview(null)
	setGenerationState('idle')
	setGenerationError('')
	setGenerationMessage('')
	setGenerationOutputText('')
	setGenerationJobId(null)
	if (!detail) return

	let cancelled = false
	const jobId = getReviewGenerationJobId(detail)
	Promise.all([
		appRpc.request.getSavedReview({
			headSha: detail.headSha,
			pullRequestNumber: detail.pullRequestNumber,
			repo: detail.repo,
		}),
		appRpc.request.getReviewGenerationJob({ jobId }),
	])
		.then(([savedReview, job]) => {
			if (cancelled) return
			setGeneratedReview(savedReview)
```

User impact: the UI visibly accepts an edit, but Request changes, Copy, and Export can publish or save different text. A PR round trip silently discards the edit.

## Target

Make `GeneratedReview.findings` the single source of truth. Preserve an explicitly empty edit by using nullish fallback (`??`), not truthy fallback (`||`):

```ts
// src/features/reviews/hooks/generated-review/reviewGenerationUtils.ts — target
export function getFindingCommentBody(
	finding: Pick<ReviewFinding, 'body' | 'suggestedCommentBody'>,
) {
	return finding.suggestedCommentBody ?? finding.body
}

export function updateFindingComment(
	review: GeneratedReview,
	findingId: string,
	commentBody: string,
): GeneratedReview {
	let changed = false
	const findings = review.findings.map((finding) => {
		if (finding.id !== findingId || finding.suggestedCommentBody === commentBody) return finding
		changed = true
		return { ...finding, suggestedCommentBody: commentBody }
	})
	return changed ? { ...review, findings } : review
}
```

`EditableFindingCard` becomes controlled; it must not import or call `useState`:

```tsx
// src/features/reviews/components/EditableFindingCard.tsx — target
export function EditableFindingCard({
	// existing props
	onChangeCommentBody,
}: {
	// existing prop types
	onChangeCommentBody: (findingId: string, commentBody: string) => void
}) {
	const commentBody = getFindingCommentBody(finding)
	const canPublish = Boolean(finding.filePath && finding.lineStart && commentBody.trim())
	const publishableFinding = {
		...finding,
		suggestedCommentBody: commentBody.trim(),
	}

	// ...
	<Textarea
		// existing presentation props
		onChange={(event) => onChangeCommentBody(finding.id, event.target.value)}
		value={commentBody}
	/>
}
```

Thread that callback through `GeneratedFindings` and `ReviewTab`, and update the owned review in the generated-review facade:

```ts
// src/features/reviews/hooks/generated-review/useFindingPublishing.ts — target
const changeFindingComment = useCallback(
	(findingId: string, commentBody: string) => {
		setPublishErrorState(null)
		setGeneratedReview((current) =>
			current ? updateFindingComment(current, findingId, commentBody) : current,
		)
	},
	[setGeneratedReview],
)

// publicState target
{
	changeFindingComment,
	discardFinding,
	publishError,
	publishFinding,
	publishingFindingIds,
}
```

```tsx
// src/features/reviews/components/ReviewDetail.tsx — target wiring
const {
	changeFindingComment,
	// existing members
} = useGeneratedReview(/* existing params */)

<ReviewTab
	// existing props
	onChangeFindingComment={changeFindingComment}
/>
```

Persist the edited `GeneratedReview` under the same repo/PR/head key already used by `getSavedReview`. Add this exact shared contract and RPC name:

```ts
// src/shared/review.ts — target
export type SaveReviewDraftParams = GetSavedReviewParams & {
	review: GeneratedReview
}
```

```ts
// src/shared/rpc.ts — target, adjacent to getSavedReview
saveReviewDraft: {
	params: SaveReviewDraftParams
	response: GeneratedReview
}
```

Change `saveGeneratedReview` to accept only the identity fields it uses so both generation and the new handler can call it:

```ts
// src/electron/services/review-store.ts — target signature
export function saveGeneratedReview(params: {
	pullRequest: Pick<GitHubPullRequestDetails, 'headSha' | 'pullRequestNumber' | 'repo'>
	review: GeneratedReview
}): GeneratedReview {
	// existing body unchanged
}
```

```ts
// src/electron/index.ts — target
import { getSavedGeneratedReview, saveGeneratedReview } from './services/review-store'

// handlers target
getSavedReview: getSavedGeneratedReview,
saveReviewDraft: ({ headSha, pullRequestNumber, repo, review }) =>
	saveGeneratedReview({
		pullRequest: { headSha, pullRequestNumber, repo },
		review,
	}),
```

Validate exactly `repo`, `pullRequestNumber`, `headSha`, and `review` through the existing validators. In `useReviewGeneration`, persist each committed review-model change without delaying UI updates; guard the write by matching repo, PR number, and `reviewedHeadSha === detail.headSha`:

```tsx
// src/features/reviews/hooks/generated-review/useReviewGeneration.ts — target
useEffect(() => {
	if (!detail || !generatedReview || generatedReview.reviewedHeadSha !== detail.headSha) return

	void appRpc.request
		.saveReviewDraft({
			headSha: detail.headSha,
			pullRequestNumber: detail.pullRequestNumber,
			repo: detail.repo,
			review: generatedReview,
		})
		.catch((error) => console.error('Could not persist edited review draft.', error))
}, [detail, generatedReview])
```

All consumers then receive the same model. Update every comment-body fallback in this flow—including `formatReviewForExport`, `isPublishableFinding`, `isFindingInlineComment`, `useDiffInlineComments`, and publication payload construction—to use `getFindingCommentBody(...)`; trim only when checking publishability or crossing the GitHub publication boundary.

## Repo conventions to follow

- Keep renderer workflow state in the generated-review hooks, matching `src/features/reviews/hooks/useGeneratedReview.ts:8-26`.
- Imitate the existing pure helper and Node Vitest style in `src/features/reviews/hooks/generated-review/reviewGenerationUtils.ts:4-30` and `reviewGenerationUtils.test.ts:28-74`.
- Keep the persisted draft in `src/electron/services/review-store.ts`; do not introduce browser storage.
- Preserve the typed RPC chain in `src/shared/rpc.ts`, `src/electron/ipc-validation.ts`, and `src/electron/index.ts`.
- Preserve local naming, tabs-as-`display` behavior, import placement, and the current export formatter layout.

## Steps

1. Add `getFindingCommentBody` and `updateFindingComment` to `reviewGenerationUtils.ts`; replace truthy comment fallback in all review/edit/export/publication helpers so an empty edit remains empty and non-publishable.
2. Remove `useState` from `EditableFindingCard`; add required `onChangeCommentBody` and control the textarea from `finding.suggestedCommentBody ?? finding.body`.
3. Thread `onChangeFindingComment` through `GeneratedFindings.tsx` and `ReviewTab.tsx` to `ReviewDetail.tsx`, and expose `changeFindingComment` from `useFindingPublishing`/`useGeneratedReview`.
4. Add `SaveReviewDraftParams`, the `saveReviewDraft` RPC schema, strict validation, the main-process handler, and the narrowed `saveGeneratedReview` identity type.
5. Persist model changes from `useReviewGeneration` only for the currently selected repo/PR/head. Do not wait for persistence before updating the textarea.
6. Add Node Vitest tests to `reviewGenerationUtils.test.ts` proving update immutability, exact whitespace preservation, explicit empty-body behavior, unknown-ID no-op identity, and independent edits to two findings.
7. Add `src/shared/review-export.test.ts` using `formatReviewForExport` to prove an edited comment appears and the generated suggestion does not; use no DOM, component renderer, or browser API.
8. Re-read the diff and remove unrelated formatting or API churn.

## Boundaries

- Do NOT keep a second comment-body state in `EditableFindingCard`.
- Do NOT mutate `ReviewFinding` or `GeneratedReview` objects in place.
- Do NOT use `localStorage`, `sessionStorage`, IndexedDB, or add dependencies.
- Do NOT debounce in a way that can lose the final keystroke when immediately selecting another PR.
- Do NOT change finding titles, explanation bodies, locations, severities, confidence, export layout, or GitHub request shape beyond using the edited body.
- Do NOT add component, jsdom, Electron-window, or browser tests; use existing Node Vitest only.
- Do NOT implement publication-state or submission-lock behavior from later findings in this plan.
- STOP if the cited source differs from commit `a283d84`; report drift instead of improvising.

## Verification

- **Mechanical**:
  - `pnpm exec vitest run src/features/reviews/hooks/generated-review/reviewGenerationUtils.test.ts src/shared/review-export.test.ts`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
  - `pnpm run build`
  - `npx react-doctor@latest --scope changed` reports no new diagnostic and does not lower the score; this finding itself is Beyond the scan.
- **Behavior check**:
  - Generate a review, edit one comment to a unique sentence, and verify Request changes confirmation still reports the correct count and submits that exact sentence.
  - Before submitting, Copy and Export; verify both contain the unique edit and neither contains the old suggested comment.
  - Select another PR, return to the original PR, and verify the textarea still contains the edit; repeat after clearing the textarea and verify the finding is not publishable.
  - Publish an individually edited finding and inspect GitHub to confirm the exact trimmed edited text was sent.
- **Done when**: one controlled `GeneratedReview` model supplies the textarea, individual publication, Request changes, Copy, and Export; explicit empty edits stay empty; and edits survive a PR navigation round trip under the same head SHA.
