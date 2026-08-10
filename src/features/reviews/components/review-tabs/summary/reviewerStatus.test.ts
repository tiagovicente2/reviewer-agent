import { describe, expect, it } from 'vitest'
import type { GitHubPullRequestDetails } from '@/shared/github'
import { getReviewerStatus, getSummaryReviewers } from './reviewerStatus'

function createDetail(overrides: Partial<GitHubPullRequestDetails> = {}): GitHubPullRequestDetails {
	return {
		additions: 0,
		author: 'author',
		baseRefName: 'main',
		body: '',
		changedFilesCount: 0,
		deletions: 0,
		diff: '',
		files: [],
		headRefName: 'feature',
		headSha: 'head-sha',
		isDraft: false,
		pullRequestNumber: 1,
		repo: 'owner/repo',
		reviewRequests: [],
		reviews: [],
		reviewThreads: [],
		state: 'OPEN',
		title: 'Pull request',
		url: 'https://github.com/owner/repo/pull/1',
		...overrides,
	}
}

describe('getSummaryReviewers', () => {
	it('marks pending review requests as requested', () => {
		const reviewers = getSummaryReviewers(
			createDetail({ reviewRequests: [{ login: 'octocat', type: 'user' }] }),
		)

		expect(reviewers).toEqual([{ login: 'octocat', state: 'PENDING', type: 'user' }])
		expect(getReviewerStatus(reviewers[0]?.state ?? '')).toEqual({
			color: 'yellow.11',
			label: 'Review requested',
		})
	})

	it('includes approved reviews', () => {
		const reviewers = getSummaryReviewers(
			createDetail({ reviews: [{ author: 'alice', state: 'APPROVED' }] }),
		)

		expect(reviewers).toEqual([{ login: 'alice', state: 'APPROVED', type: 'user' }])
		expect(getReviewerStatus(reviewers[0]?.state ?? '')).toEqual({
			color: 'green.11',
			label: 'Approved',
		})
	})

	it('includes changes-requested reviews', () => {
		const reviewers = getSummaryReviewers(
			createDetail({ reviews: [{ author: 'bob', state: 'CHANGES_REQUESTED' }] }),
		)

		expect(reviewers).toEqual([{ login: 'bob', state: 'CHANGES_REQUESTED', type: 'user' }])
		expect(getReviewerStatus(reviewers[0]?.state ?? '')).toEqual({
			color: 'red.11',
			label: 'Changes requested',
		})
	})

	it('selects the latest submitted review for each user', () => {
		const reviewers = getSummaryReviewers(
			createDetail({
				reviews: [
					{ author: 'alice', state: 'APPROVED', submittedAt: '2025-01-02T00:00:00Z' },
					{ author: 'alice', state: 'COMMENTED', submittedAt: '2025-01-03T00:00:00Z' },
					{ author: 'alice', state: 'DISMISSED', submittedAt: '2025-01-01T00:00:00Z' },
				],
			}),
		)

		expect(reviewers).toEqual([
			{
				login: 'alice',
				state: 'COMMENTED',
				submittedAt: '2025-01-03T00:00:00Z',
				type: 'user',
			},
		])
	})

	it('keeps pending requests ahead of submitted reviews', () => {
		const reviewers = getSummaryReviewers(
			createDetail({
				reviewRequests: [{ login: 'Alice', type: 'user' }],
				reviews: [{ author: 'alice', state: 'APPROVED', submittedAt: '2025-01-03T00:00:00Z' }],
			}),
		)

		expect(reviewers).toEqual([{ login: 'Alice', state: 'PENDING', type: 'user' }])
	})

	it('keeps team identities separate from users with the same login', () => {
		const reviewers = getSummaryReviewers(
			createDetail({
				reviewRequests: [
					{ login: 'platform', type: 'team' },
					{ login: 'platform', type: 'user' },
				],
			}),
		)

		expect(reviewers).toEqual([
			{ login: 'platform', state: 'PENDING', type: 'team' },
			{ login: 'platform', state: 'PENDING', type: 'user' },
		])
	})

	it('returns no reviewers for empty detail', () => {
		expect(getSummaryReviewers(null)).toEqual([])
	})
})
