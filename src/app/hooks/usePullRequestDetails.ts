import { useEffect, useState } from 'react'
import { appRpc } from '@/app/rpc'
import type { AsyncState } from '@/app/types'
import type { GitHubPullRequestDetails, GitHubReviewRequest } from '@/shared/github'

export function usePullRequestDetails({
	logError,
	onResetSummary,
	review,
}: {
	logError: (title: string, error: unknown, context?: string) => string
	onResetSummary: () => void
	review: GitHubReviewRequest | null
}) {
	const [detail, setDetail] = useState<GitHubPullRequestDetails | null>(null)
	const [detailState, setDetailState] = useState<AsyncState>('idle')
	const [detailError, setDetailError] = useState('')

	useEffect(() => {
		if (!review) {
			setDetail(null)
			return
		}

		let cancelled = false
		setDetailState('loading')
		setDetailError('')
		setDetail(null)
		onResetSummary()

		appRpc.request
			.getGitHubPullRequestDetails({
				pullRequestNumber: review.pullRequestNumber,
				repo: review.repo,
			})
			.then((pullRequestDetails) => {
				if (!cancelled) {
					setDetail(pullRequestDetails)
					setDetailState('idle')
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setDetailError(logError('Could not load pull request details', error, review.repo))
					setDetailState('error')
				}
			})

		return () => {
			cancelled = true
		}
	}, [logError, onResetSummary, review])

	return { detail, detailError, detailState, setDetail }
}
