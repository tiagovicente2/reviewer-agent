import { useEffect, useMemo, useState } from 'react'
import type { GitHubReviewRequest } from '@/shared/github'

export function useReviewSearchFilter(query: string, reviews: GitHubReviewRequest[]) {
	const [debouncedQuery, setDebouncedQuery] = useState('')

	useEffect(() => {
		const timeout = window.setTimeout(() => setDebouncedQuery(query), 250)
		return () => window.clearTimeout(timeout)
	}, [query])

	return useMemo(() => {
		const normalizedQuery = debouncedQuery.trim().toLowerCase()
		if (!normalizedQuery) return reviews

		return reviews.filter((review) => {
			const searchableText =
				`${review.repo} ${review.pullRequestNumber} ${review.title} ${review.author} ${review.url}`.toLowerCase()
			return searchableText.includes(normalizedQuery)
		})
	}, [debouncedQuery, reviews])
}
