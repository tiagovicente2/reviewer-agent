import { describe, expect, it } from 'vitest'
import type { GitHubPullRequestDetails } from './github'
import type { GeneratedReview } from './review'
import { formatReviewForExport } from './review-export'

const pullRequest: GitHubPullRequestDetails = {
	repo: 'earendil/reviewer-agent',
	pullRequestNumber: 14,
	title: 'Preserve edited comments',
	author: 'reviewer',
	url: 'https://github.com/earendil/reviewer-agent/pull/14',
	body: 'Pull request body',
	state: 'OPEN',
	isDraft: false,
	headSha: 'abcdef1234567890',
	headRefName: 'preserve-comments',
	baseRefName: 'main',
	changedFilesCount: 1,
	additions: 3,
	deletions: 1,
	reviews: [],
	reviewRequests: [],
	reviewThreads: [],
	files: [{ path: 'src/example.ts', additions: 3, deletions: 1 }],
	diff: '',
}

const review: GeneratedReview = {
	summary: 'One issue needs attention.',
	publishableBody: 'Please address the inline finding.',
	verdictRecommendation: 'request_changes',
	severity: 'high',
	findings: [
		{
			id: 'finding-1',
			severity: 'high',
			title: 'Preserve the draft',
			filePath: 'src/example.ts',
			lineStart: 12,
			body: 'The explanation remains unchanged.',
			suggestedCommentBody: 'Use this uniquely edited comment.',
			confidence: 0.98,
		},
	],
	inlineComments: [
		{
			path: 'src/example.ts',
			line: 12,
			side: 'RIGHT',
			body: 'This generated suggestion should be replaced.',
		},
	],
	rawOutput: 'raw output',
	modelLabel: 'test-model',
	generatedAt: '2026-01-01T00:00:00.000Z',
	reviewedHeadSha: 'abcdef1234567890',
	diffWasTruncated: false,
}

describe('formatReviewForExport', () => {
	it('exports the edited finding comment instead of the generated suggestion', () => {
		const output = formatReviewForExport({ pullRequest, review })

		expect(output).toContain('Use this uniquely edited comment.')
		expect(output).not.toContain('This generated suggestion should be replaced.')
	})
})
