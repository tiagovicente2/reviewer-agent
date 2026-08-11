import { describe, expect, it } from 'vitest'
import type { GitHubPullRequestReviewThread } from './github'
import type { GeneratedReview, ReviewFinding } from './review'
import {
	getReviewCommentKey,
	markFindingsPublished,
	normalizeReviewCommentBody,
	reconcilePublishedFindings,
} from './review-publication'

const finding: ReviewFinding = {
	body: 'Explanation',
	confidence: 1,
	filePath: 'src/example.ts',
	id: 'finding-1',
	lineStart: 12,
	severity: 'high',
	suggestedCommentBody: '  Add a guard here.\nPlease.  ',
	title: 'Missing guard',
}

const review: GeneratedReview = {
	diffWasTruncated: false,
	findings: [finding, { ...finding, filePath: 'src/other.ts', id: 'finding-2' }],
	generatedAt: '2026-01-01T00:00:00.000Z',
	inlineComments: [],
	modelLabel: 'test',
	publishableBody: 'Summary',
	rawOutput: '',
	reviewedHeadSha: 'head-sha',
	severity: 'high',
	summary: 'Summary',
	verdictRecommendation: 'request_changes',
}

const matchingThread: GitHubPullRequestReviewThread = {
	comments: [
		{
			author: 'reviewer',
			body: 'add A GUARD here.   please.',
			createdAt: '2026-02-01T00:00:00.000Z',
			url: 'https://github.com/owner/repo/pull/1#discussion_r1',
		},
	],
	id: 'thread-1',
	isOutdated: false,
	isResolved: false,
	line: 12,
	path: 'src/example.ts',
}

describe('review publication identity', () => {
	it('normalizes case and whitespace while retaining path and line identity', () => {
		expect(normalizeReviewCommentBody('  Add\n A   Guard  ')).toBe('add a guard')
		expect(getReviewCommentKey({ body: ' ADD a guard ', line: 12, path: 'src/example.ts' })).toBe(
			getReviewCommentKey({ body: 'add   A GUARD', line: 12, path: 'src/example.ts' }),
		)
		expect(getReviewCommentKey({ body: 'add a guard', line: 13, path: 'src/example.ts' })).not.toBe(
			getReviewCommentKey({ body: 'add a guard', line: 12, path: 'src/example.ts' }),
		)
		expect(getReviewCommentKey({ body: 'add a guard', line: 12, path: 'src/other.ts' })).not.toBe(
			getReviewCommentKey({ body: 'add a guard', line: 12, path: 'src/example.ts' }),
		)
	})
})

describe('reconcilePublishedFindings', () => {
	it('marks only a matching finding and copies GitHub metadata', () => {
		const reconciled = reconcilePublishedFindings(review, [matchingThread])

		expect(reconciled).not.toBe(review)
		expect(reconciled.findings[0]?.publication).toEqual({
			commentUrl: matchingThread.comments[0]?.url,
			publishedAt: matchingThread.comments[0]?.createdAt,
			state: 'published',
		})
		expect(reconciled.findings[1]).toBe(review.findings[1])
		expect(reconcilePublishedFindings(reconciled, [matchingThread])).toBe(reconciled)
	})

	it('preserves review identity and existing publication markers when threads do not match', () => {
		const published = markFindingsPublished(review, ['finding-1'], '2026-03-01T00:00:00.000Z')

		expect(reconcilePublishedFindings(review, [])).toBe(review)
		expect(reconcilePublishedFindings(published, [])).toBe(published)
		expect(markFindingsPublished(published, ['finding-1'], 'later')).toBe(published)
	})
})
