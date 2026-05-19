import type { CacheStats, ClearCacheResult } from '@/shared/cache'
import { clearPullRequestCache, getPullRequestCacheStats } from './pull-request-cache'
import { clearGeneratedReviewStore, getGeneratedReviewStoreStats } from './review-store'

export function getCacheStats(): CacheStats {
	return {
		...getPullRequestCacheStats(),
		...getGeneratedReviewStoreStats(),
	}
}

export function clearAppCache(): ClearCacheResult {
	const pullRequest = clearPullRequestCache()
	const generatedReviews = clearGeneratedReviewStore()
	return {
		removedPullRequestDetails: pullRequest.removedDetails,
		removedPullRequestDiffs: pullRequest.removedDiffs,
		removedGeneratedReviews: generatedReviews.removed,
	}
}
