import { describe, expect, it } from 'vitest'
import type { GitHubPullRequestDetails } from './github'
import {
	getLatestReviewByAuthor,
	getReviewSubmissionPolicy,
	type ReviewSubmissionPolicyInput,
} from './review-submission'

const detail: GitHubPullRequestDetails = {
	additions: 1,
	author: 'author',
	baseRefName: 'main',
	body: '',
	changedFilesCount: 1,
	deletions: 0,
	diff: '',
	files: [{ additions: 1, deletions: 0, path: 'src/index.ts' }],
	headRefName: 'feature',
	headSha: 'head-sha',
	isDraft: false,
	pullRequestNumber: 7,
	repo: 'owner/repo',
	reviewRequests: [],
	reviews: [],
	reviewThreads: [],
	state: 'OPEN',
	title: 'Test pull request',
	url: 'https://github.com/owner/repo/pull/7',
}

const allowedInput: ReviewSubmissionPolicyInput = {
	currentUsername: 'reviewer',
	detail,
	event: 'approve',
	publishableFindingsCount: 0,
	reviewedHeadSha: 'head-sha',
	submissionLocked: false,
	submittedEvent: null,
}

function policy(overrides: Partial<ReviewSubmissionPolicyInput> = {}) {
	return getReviewSubmissionPolicy({ ...allowedInput, ...overrides })
}

describe('review submission policy', () => {
	it('selects the latest review by author case-insensitively', () => {
		expect(
			getLatestReviewByAuthor(
				[
					{ author: 'Reviewer', state: 'APPROVED', submittedAt: '2025-01-02T00:00:00Z' },
					{ author: 'other', state: 'CHANGES_REQUESTED', submittedAt: '2025-01-04T00:00:00Z' },
					{ author: 'REVIEWER', state: 'COMMENTED', submittedAt: '2025-01-03T00:00:00Z' },
					{ author: 'reviewer', state: 'DISMISSED', submittedAt: '2025-01-01T00:00:00Z' },
				],
				'reviewer',
			),
		).toEqual({ author: 'REVIEWER', state: 'COMMENTED', submittedAt: '2025-01-03T00:00:00Z' })
	})

	it.each([
		['active lock', { submissionLocked: true }, 'A review is already being submitted.'],
		[
			'missing auth',
			{ currentUsername: undefined },
			'Reconnect GitHub before submitting a review.',
		],
		['missing detail', { detail: null }, 'Load PR details and generate a review first.'],
		['missing review', { reviewedHeadSha: null }, 'Load PR details and generate a review first.'],
		[
			'closed pull request',
			{ detail: { ...detail, state: 'CLOSED' } },
			'Reviews can only be submitted to an open pull request.',
		],
		[
			'draft pull request',
			{ detail: { ...detail, isDraft: true } },
			'Wait until the pull request is ready for review.',
		],
		[
			'stale review',
			{ reviewedHeadSha: 'old-head' },
			'Regenerate the review for the latest head before submitting.',
		],
		['self review', { currentUsername: 'AUTHOR' }, 'You cannot review your own pull request.'],
		[
			'local completion',
			{ submittedEvent: 'approve' as const },
			'A final review was already submitted for this draft.',
		],
	] as const)('rejects $0', (_name, overrides, reason) => {
		expect(policy(overrides)).toEqual({ allowed: false, reason })
	})

	it.each(['APPROVED', 'CHANGES_REQUESTED'])('rejects a latest own %s review', (state) => {
		expect(
			policy({
				detail: {
					...detail,
					reviews: [{ author: 'REVIEWER', state, submittedAt: '2025-01-01T00:00:00Z' }],
				},
			}),
		).toEqual({
			allowed: false,
			reason: 'You already submitted a final review for this pull request.',
		})
	})

	it('uses only the latest own review and ignores another reviewer terminal decision', () => {
		expect(
			policy({
				detail: {
					...detail,
					reviews: [
						{ author: 'reviewer', state: 'APPROVED', submittedAt: '2025-01-01T00:00:00Z' },
						{ author: 'other', state: 'CHANGES_REQUESTED', submittedAt: '2025-01-03T00:00:00Z' },
						{ author: 'Reviewer', state: 'DISMISSED', submittedAt: '2025-01-02T00:00:00Z' },
					],
				},
			}),
		).toEqual({ allowed: true, reason: '' })
	})

	it('requires unpublished content for request changes but preserves body-only requests', () => {
		expect(policy({ event: 'request_changes' })).toEqual({
			allowed: false,
			reason: 'Request changes needs at least one unpublished finding.',
		})
		expect(policy({ event: 'request_changes', publishableFindingsCount: 1 })).toEqual({
			allowed: true,
			reason: '',
		})
		expect(policy({ event: 'request_changes', hasReviewBody: true })).toEqual({
			allowed: true,
			reason: '',
		})
	})
})
