import { useCallback, useMemo, useState } from 'react'
import { appRpc } from '@/app/rpc'
import type { AsyncState } from '@/app/types'
import type { GitHubReviewRequest } from '@/shared/github'

export type ReviewSearchMode = 'smart' | 'repo' | 'author' | 'title' | 'review-requested'

export function isPullRequestQuery(query: string) {
	const trimmed = query.trim()
	return (
		/^https?:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/i.test(trimmed) ||
		/^[^\s#]+\/[^\s#]+#\d+$/.test(trimmed) ||
		/^[^\s#]+\/[^\s#]+\s+\d+$/.test(trimmed)
	)
}

export function useReviewRequests({
	logError,
}: {
	logError: (title: string, error: unknown, context?: string) => string
}) {
	const [reviews, setReviews] = useState<GitHubReviewRequest[]>([])
	const [reviewsState, setReviewsState] = useState<AsyncState>('idle')
	const [reviewPrState, setReviewPrState] = useState<AsyncState>('idle')
	const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)
	const [searchMode, setSearchMode] = useState<ReviewSearchMode>('smart')
	const [searchActive, setSearchActive] = useState(false)
	const [activeSearchQuery, setActiveSearchQuery] = useState('')

	const selectedReview = useMemo(
		() => reviews.find((review) => review.id === selectedReviewId) ?? null,
		[reviews, selectedReviewId],
	)

	const loadReviewRequests = useCallback(async () => {
		setSearchActive(false)
		setActiveSearchQuery('')
		setReviewsState('loading')

		try {
			const items = await appRpc.request.listGitHubReviewRequests()
			setReviews(items)
			setSelectedReviewId((current) =>
				current && items.some((item) => item.id === current) ? current : (items[0]?.id ?? null),
			)
			setReviewsState('idle')
			return true
		} catch (error) {
			logError('Could not load review requests', error, 'GitHub review inbox')
			setReviewsState('error')
			return false
		}
	}, [logError])

	const searchPullRequests = useCallback(
		async (query: string) => {
			const searchQuery = query.trim()
			if (!searchQuery) return

			setReviewsState('loading')
			try {
				const items = await appRpc.request.searchGitHubPullRequests({
					mode: searchMode,
					query: searchQuery,
				})
				setSearchActive(true)
				setActiveSearchQuery(searchQuery)
				setReviews(items)
				setSelectedReviewId(items[0]?.id ?? null)
				setReviewsState('idle')
			} catch (error) {
				logError('Could not search pull requests', error, 'GitHub PR search')
				setReviewsState('error')
			}
		},
		[logError, searchMode],
	)

	const reviewPullRequest = useCallback(
		async (query: string) => {
			const prQuery = query.trim()
			if (!prQuery || !isPullRequestQuery(prQuery)) return false

			setReviewPrState('loading')
			try {
				const item = await appRpc.request.getGitHubPullRequestForReview({ query: prQuery })
				setReviews((current) => [item, ...current.filter((review) => review.id !== item.id)])
				setSelectedReviewId(item.id)
				setReviewPrState('idle')
				return true
			} catch (error) {
				logError('Could not load pull request', error, 'Review PR')
				setReviewPrState('error')
				return false
			}
		},
		[logError],
	)

	return {
		activeSearchQuery,
		loadReviewRequests,
		reviewPullRequest,
		reviewPrState,
		reviews,
		reviewsState,
		searchActive,
		searchMode,
		searchPullRequests,
		selectedReview,
		selectedReviewId,
		setSearchMode,
		setSelectedReviewId,
	}
}
