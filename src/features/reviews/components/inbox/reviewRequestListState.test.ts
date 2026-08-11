import { describe, expect, it } from 'vitest'
import { getReviewRequestListState } from './reviewRequestListState'

describe('getReviewRequestListState', () => {
	it.each([
		{ expected: 'loading', reviewCount: 3, reviewsState: 'loading' },
		{ expected: 'error-empty', reviewCount: 0, reviewsState: 'error' },
		{ expected: 'error-with-reviews', reviewCount: 3, reviewsState: 'error' },
		{ expected: 'empty', reviewCount: 0, reviewsState: 'idle' },
		{ expected: 'ready', reviewCount: 3, reviewsState: 'idle' },
	] as const)('returns $expected for $reviewsState with $reviewCount reviews', ({
		expected,
		reviewCount,
		reviewsState,
	}) => {
		expect(getReviewRequestListState(reviewsState, reviewCount)).toBe(expected)
	})
})
