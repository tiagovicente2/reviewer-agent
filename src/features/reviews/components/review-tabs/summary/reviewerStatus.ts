import type { GitHubPullRequestDetails } from '@/shared/github'

export type SummaryReviewer = {
	login: string
	type: 'user' | 'team'
	state: string
	submittedAt?: string
}

export type ReviewerStatus = {
	color: 'green.11' | 'red.11' | 'cyan.11' | 'gray.11' | 'yellow.11'
	label: 'Approved' | 'Changes requested' | 'Commented' | 'Dismissed' | 'Review requested'
}

export function getSummaryReviewers(detail: GitHubPullRequestDetails | null): SummaryReviewer[] {
	if (!detail) return []

	const reviewers = new Map<string, SummaryReviewer>()
	for (const request of detail.reviewRequests ?? []) {
		reviewers.set(`${request.type}:${request.login.toLowerCase()}`, {
			...request,
			state: 'PENDING',
		})
	}

	for (const review of detail.reviews) {
		const key = `user:${review.author.toLowerCase()}`
		const current = reviewers.get(key)
		if (current?.state === 'PENDING') continue
		if (current?.submittedAt && review.submittedAt && current.submittedAt > review.submittedAt) {
			continue
		}
		reviewers.set(key, {
			login: review.author,
			state: review.state,
			submittedAt: review.submittedAt,
			type: 'user',
		})
	}

	return Array.from(reviewers.values())
}

export function getReviewerStatus(state: string): ReviewerStatus {
	switch (state.toUpperCase()) {
		case 'APPROVED':
			return { color: 'green.11', label: 'Approved' }
		case 'CHANGES_REQUESTED':
			return { color: 'red.11', label: 'Changes requested' }
		case 'COMMENTED':
			return { color: 'cyan.11', label: 'Commented' }
		case 'DISMISSED':
			return { color: 'gray.11', label: 'Dismissed' }
		default:
			return { color: 'yellow.11', label: 'Review requested' }
	}
}
