import type { GitHubPullRequestReviewThread } from './github'
import type { GeneratedReview, ReviewFinding } from './review'

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

export function partitionFindingsByReviewThreads(
	findings: ReviewFinding[],
	threads: GitHubPullRequestReviewThread[],
) {
	const existingCommentKeys = getThreadCommentKeys(threads)
	const newFindings: ReviewFinding[] = []
	const alreadyPublishedFindings: ReviewFinding[] = []

	for (const finding of findings) {
		const key = getReviewCommentKey({
			body: getFindingCommentBody(finding),
			line: finding.lineStart,
			path: finding.filePath,
		})
		if (existingCommentKeys.has(key)) alreadyPublishedFindings.push(finding)
		else newFindings.push(finding)
	}

	return { alreadyPublishedFindings, newFindings }
}

export function markFindingsPublished(
	review: GeneratedReview,
	findingIds: Iterable<string>,
	publishedAt?: string,
): GeneratedReview {
	const ids = new Set(findingIds)
	if (ids.size === 0) return review

	let changed = false
	const findings = review.findings.map((finding) => {
		if (!ids.has(finding.id) || finding.publication?.state === 'published') return finding
		changed = true
		return {
			...finding,
			publication: {
				state: 'published' as const,
				...(publishedAt ? { publishedAt } : {}),
			},
		}
	})

	return changed ? { ...review, findings } : review
}

export function reconcilePublishedFindings(
	review: GeneratedReview,
	threads: GitHubPullRequestReviewThread[],
): GeneratedReview {
	const commentsByKey = new Map<string, GitHubPullRequestReviewThread['comments'][number]>()
	for (const thread of threads) {
		for (const comment of thread.comments) {
			const key = getReviewCommentKey({ body: comment.body, line: thread.line, path: thread.path })
			if (!commentsByKey.has(key)) commentsByKey.set(key, comment)
		}
	}

	let changed = false
	const findings = review.findings.map((finding) => {
		const comment = commentsByKey.get(
			getReviewCommentKey({
				body: getFindingCommentBody(finding),
				line: finding.lineStart,
				path: finding.filePath,
			}),
		)
		if (!comment) return finding

		const publication = {
			state: 'published' as const,
			...(comment.createdAt
				? { publishedAt: comment.createdAt }
				: finding.publication?.publishedAt
					? { publishedAt: finding.publication.publishedAt }
					: {}),
			...(comment.url
				? { commentUrl: comment.url }
				: finding.publication?.commentUrl
					? { commentUrl: finding.publication.commentUrl }
					: {}),
		}
		if (
			finding.publication?.state === publication.state &&
			finding.publication.publishedAt === publication.publishedAt &&
			finding.publication.commentUrl === publication.commentUrl
		) {
			return finding
		}

		changed = true
		return { ...finding, publication }
	})

	return changed ? { ...review, findings } : review
}

function getThreadCommentKeys(threads: GitHubPullRequestReviewThread[]) {
	return new Set(
		threads.flatMap((thread) =>
			thread.comments.map((comment) =>
				getReviewCommentKey({ body: comment.body, line: thread.line, path: thread.path }),
			),
		),
	)
}
