import type { AsyncState } from '@/app/types'

export type ReviewRequestListState =
	| 'loading'
	| 'error-empty'
	| 'error-with-reviews'
	| 'empty'
	| 'ready'

export function getReviewRequestListState(
	reviewsState: AsyncState,
	reviewCount: number,
): ReviewRequestListState {
	if (reviewsState === 'loading') return 'loading'
	if (reviewsState === 'error') {
		return reviewCount === 0 ? 'error-empty' : 'error-with-reviews'
	}
	if (reviewCount === 0) return 'empty'
	return 'ready'
}
