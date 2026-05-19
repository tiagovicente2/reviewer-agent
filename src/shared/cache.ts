export type CacheStats = {
	pullRequestDetails: number
	pullRequestDiffs: number
	generatedReviews: number
}

export type ClearCacheResult = {
	removedPullRequestDetails: number
	removedPullRequestDiffs: number
	removedGeneratedReviews: number
}
