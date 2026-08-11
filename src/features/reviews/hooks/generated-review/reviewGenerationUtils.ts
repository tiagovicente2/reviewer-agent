import type { GitHubPullRequestDetails } from '@/shared/github'
import type { GeneratedReview, ReviewFinding } from '@/shared/review'

export const reviewPromptLabel = 'Generate a draft GitHub pull request review'

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
			return activeToken === token && selectedPullRequestIdentity === token.pullRequestIdentity
		},
		complete(token: ReviewGenerationToken) {
			const current =
				activeToken === token && selectedPullRequestIdentity === token.pullRequestIdentity
			if (!current) return false
			activeToken = null
			return true
		},
	}
}

export function getLocalReviewProgressOutput(messages: string[]) {
	return `${reviewPromptLabel}\n\n${messages.map((message) => `:: ${message}`).join('\n')}\n`
}

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

export function isFindingInlineComment(
	finding: ReviewFinding,
	comment: GeneratedReview['inlineComments'][number],
) {
	const body = getFindingCommentBody(finding).trim()
	return Boolean(
		finding.filePath &&
			finding.lineStart &&
			body &&
			comment.path === finding.filePath &&
			comment.side === 'RIGHT' &&
			comment.line === finding.lineStart &&
			comment.body.trim() === body,
	)
}

export function getPullRequestIdentity(
	pullRequest: Pick<GitHubPullRequestDetails, 'pullRequestNumber' | 'repo'>,
) {
	return `${pullRequest.repo}#${pullRequest.pullRequestNumber}`
}
