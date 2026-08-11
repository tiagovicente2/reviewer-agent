import { describe, expect, it } from 'vitest'
import type { ReviewFinding } from '@/shared/review'
import { getFindingPublishState, getPrimaryReviewAction } from './editableFindingUtils'

const finding: ReviewFinding = {
	body: 'Explanation',
	confidence: 0.9,
	filePath: 'src/review.ts',
	id: 'finding-1',
	lineStart: 42,
	severity: 'high',
	suggestedCommentBody: 'Generated suggestion',
	title: 'Unsafe review flow',
}

describe('getFindingPublishState', () => {
	it('trims and uses the edited comment in the outbound finding', () => {
		const state = getFindingPublishState(finding, '  Edited review comment.  ')

		expect(state).toEqual({
			canPublish: true,
			finding: { ...finding, suggestedCommentBody: 'Edited review comment.' },
		})
		expect(state.finding.suggestedCommentBody).not.toBe(finding.suggestedCommentBody)
	})

	it.each([
		{ change: { filePath: '' }, commentBody: 'Comment', reason: 'missing path' },
		{ change: { lineStart: undefined }, commentBody: 'Comment', reason: 'missing line' },
		{ change: {}, commentBody: '   ', reason: 'blank edited comment' },
	])('disables publishing for $reason', ({ change, commentBody }) => {
		const state = getFindingPublishState({ ...finding, ...change }, commentBody)

		expect(state.canPublish).toBe(false)
	})
})

describe('getPrimaryReviewAction', () => {
	it.each([
		{ expected: 'request_changes', hasPublishableFindings: true },
		{ expected: 'approve', hasPublishableFindings: false },
	] as const)('returns $expected when findings are $hasPublishableFindings', (testCase) => {
		expect(getPrimaryReviewAction(testCase.hasPublishableFindings)).toBe(testCase.expected)
	})
})
