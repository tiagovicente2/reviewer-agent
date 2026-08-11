import type { GitHubPullRequestDetails, GitHubPullRequestReview } from './github'
import type { ReviewSubmitEvent } from './review'

export type ReviewSubmissionPolicyInput = {
	currentUsername?: string
	detail: GitHubPullRequestDetails | null
	event: ReviewSubmitEvent
	hasReviewBody?: boolean
	publishableFindingsCount: number
	reviewedHeadSha: string | null
	submissionLocked: boolean
	submittedEvent: ReviewSubmitEvent | null
}

export type ReviewSubmissionPolicy = {
	allowed: boolean
	reason: string
}

export function getLatestReviewByAuthor(
	reviews: GitHubPullRequestReview[],
	username: string,
): GitHubPullRequestReview | null {
	let latestReview: GitHubPullRequestReview | null = null
	for (const review of reviews) {
		if (review.author.toLowerCase() !== username.toLowerCase()) continue
		if (
			latestReview?.submittedAt &&
			review.submittedAt &&
			latestReview.submittedAt > review.submittedAt
		) {
			continue
		}
		latestReview = review
	}
	return latestReview
}

export function getReviewSubmissionPolicy(
	input: ReviewSubmissionPolicyInput,
): ReviewSubmissionPolicy {
	if (input.submissionLocked) {
		return { allowed: false, reason: 'A review is already being submitted.' }
	}
	if (!input.currentUsername) {
		return { allowed: false, reason: 'Reconnect GitHub before submitting a review.' }
	}
	if (!input.detail || !input.reviewedHeadSha) {
		return { allowed: false, reason: 'Load PR details and generate a review first.' }
	}
	if (input.detail.state !== 'OPEN') {
		return { allowed: false, reason: 'Reviews can only be submitted to an open pull request.' }
	}
	if (input.detail.isDraft) {
		return { allowed: false, reason: 'Wait until the pull request is ready for review.' }
	}
	if (input.reviewedHeadSha !== input.detail.headSha) {
		return {
			allowed: false,
			reason: 'Regenerate the review for the latest head before submitting.',
		}
	}
	if (input.currentUsername.toLowerCase() === input.detail.author.toLowerCase()) {
		return { allowed: false, reason: 'You cannot review your own pull request.' }
	}
	if (input.submittedEvent) {
		return { allowed: false, reason: 'A final review was already submitted for this draft.' }
	}

	const latestOwnReview = getLatestReviewByAuthor(input.detail.reviews, input.currentUsername)
	if (latestOwnReview && ['APPROVED', 'CHANGES_REQUESTED'].includes(latestOwnReview.state)) {
		return {
			allowed: false,
			reason: 'You already submitted a final review for this pull request.',
		}
	}
	if (
		input.event === 'request_changes' &&
		input.publishableFindingsCount === 0 &&
		!input.hasReviewBody
	) {
		return {
			allowed: false,
			reason: 'Request changes needs at least one unpublished finding.',
		}
	}
	return { allowed: true, reason: '' }
}
