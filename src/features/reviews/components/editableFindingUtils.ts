import type { ReviewFinding } from '@/shared/review'

export function getFindingPublishState(finding: ReviewFinding, commentBody: string) {
	const suggestedCommentBody = commentBody.trim()
	return {
		canPublish: Boolean(finding.filePath && finding.lineStart && suggestedCommentBody),
		finding: { ...finding, suggestedCommentBody },
	}
}

export function getPrimaryReviewAction(hasPublishableFindings: boolean) {
	return hasPublishableFindings ? 'request_changes' : 'approve'
}
