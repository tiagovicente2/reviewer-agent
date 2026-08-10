import type { GitHubPullRequestDetails } from '@/shared/github'
import type { GeneratedReview, ReviewFinding } from '@/shared/review'

export const reviewPromptLabel = 'Generate a draft GitHub pull request review'

export function getLocalReviewProgressOutput(messages: string[]) {
	return `${reviewPromptLabel}\n\n${messages.map((message) => `:: ${message}`).join('\n')}\n`
}

export function isFindingInlineComment(
	finding: ReviewFinding,
	comment: GeneratedReview['inlineComments'][number],
) {
	const body = (finding.suggestedCommentBody || finding.body).trim()
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
