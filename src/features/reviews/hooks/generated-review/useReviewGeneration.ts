import { useCallback, useEffect, useRef, useState } from 'react'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import type { GitHubPullRequestDetails } from '@/shared/github'
import { type GeneratedReview, getReviewGenerationJobId } from '@/shared/review'
import { getLocalReviewProgressOutput, getPullRequestIdentity } from './reviewGenerationUtils'

export type UseReviewGenerationParams = {
	detail: GitHubPullRequestDetails | null
	instructionId?: string
	onPullRequestDetailRefresh: (detail: GitHubPullRequestDetails) => void
	onSummary: (summary: string) => void
	onStartGeneration: () => void
	onUpdatedDiff: (diff: string) => void
}

export function useReviewGeneration({
	detail,
	instructionId,
	onPullRequestDetailRefresh,
	onSummary,
	onStartGeneration,
	onUpdatedDiff,
}: UseReviewGenerationParams) {
	const [generatedReview, setGeneratedReview] = useState<GeneratedReview | null>(null)
	const [generationState, setGenerationState] = useState<AsyncState>('idle')
	const [generationError, setGenerationError] = useState('')
	const [generationMessage, setGenerationMessage] = useState('')
	const [generationOutputText, setGenerationOutputText] = useState('')
	const [generationJobId, setGenerationJobId] = useState<string | null>(null)
	const generatingPullRequestIdentityRef = useRef<string | null>(null)
	const { showToast } = useToast()

	const isGeneratingPullRequest = useCallback(
		(pullRequest: GitHubPullRequestDetails | null) =>
			Boolean(
				pullRequest &&
					generatingPullRequestIdentityRef.current === getPullRequestIdentity(pullRequest),
			),
		[],
	)

	const completeGeneration = useCallback(
		(review: GeneratedReview) => {
			generatingPullRequestIdentityRef.current = null
			setGeneratedReview(review)
			onSummary(review.publishableBody || review.summary)
			setGenerationState('idle')
			setGenerationOutputText('')
			showToast({
				title: 'Review completed',
				description: 'A draft review was generated.',
				tone: 'success',
			})
		},
		[onSummary, showToast],
	)

	useEffect(() => {
		if (isGeneratingPullRequest(detail)) return

		setGeneratedReview(null)
		setGenerationState('idle')
		setGenerationError('')
		setGenerationMessage('')
		setGenerationOutputText('')
		setGenerationJobId(null)
		if (!detail) return

		let cancelled = false
		const jobId = getReviewGenerationJobId(detail)
		Promise.all([
			appRpc.request.getSavedReview({
				headSha: detail.headSha,
				pullRequestNumber: detail.pullRequestNumber,
				repo: detail.repo,
			}),
			appRpc.request.getReviewGenerationJob({ jobId }),
		])
			.then(([savedReview, job]) => {
				if (cancelled) return
				setGeneratedReview(savedReview)
				if (job?.status === 'running') {
					setGenerationState('loading')
					setGenerationJobId(job.id)
					setGenerationMessage(job.statusMessage ?? '')
					setGenerationOutputText(job.outputText ?? '')
				} else if (job?.status === 'failed') {
					setGenerationState('error')
					setGenerationError(job.error ?? 'Review generation failed.')
				} else {
					setGenerationState('idle')
					setGenerationJobId(null)
				}
			})
			.catch(() => {
				if (!cancelled) setGeneratedReview(null)
			})

		return () => {
			cancelled = true
		}
	}, [detail, isGeneratingPullRequest])

	useEffect(() => {
		if (!generationJobId) return

		let cancelled = false
		const interval = window.setInterval(async () => {
			try {
				const job = await appRpc.request.getReviewGenerationJob({ jobId: generationJobId })
				if (cancelled || !job) return
				setGenerationMessage(job.statusMessage ?? '')
				setGenerationOutputText(job.outputText ?? '')

				if (job.status === 'completed' && job.review) {
					completeGeneration(job.review)
					setGenerationJobId(null)
				}

				if (job.status === 'failed') {
					generatingPullRequestIdentityRef.current = null
					setGenerationError(job.error ?? 'Review generation failed.')
					setGenerationState('error')
					setGenerationOutputText('')
					setGenerationJobId(null)
				}
			} catch (error) {
				if (!cancelled) {
					setGenerationError(getErrorMessage(error))
					setGenerationState('error')
					setGenerationOutputText('')
					setGenerationJobId(null)
				}
			}
		}, 1500)

		return () => {
			cancelled = true
			window.clearInterval(interval)
		}
	}, [completeGeneration, generationJobId])

	const generateReview = useCallback(async () => {
		if (!detail) {
			setGenerationError('Load PR details before generating a review.')
			setGenerationState('error')
			return
		}

		onStartGeneration()
		generatingPullRequestIdentityRef.current = getPullRequestIdentity(detail)
		setGenerationState('loading')
		setGenerationError('')
		setGenerationMessage('Loading the latest PR diff before starting review generation...')
		setGenerationOutputText(
			getLocalReviewProgressOutput([
				'Loading the latest PR diff before starting review generation...',
			]),
		)

		try {
			const latestDetail = await appRpc.request.getGitHubPullRequestDetails({
				forceRefresh: true,
				pullRequestNumber: detail.pullRequestNumber,
				repo: detail.repo,
			})
			onPullRequestDetailRefresh(latestDetail)
			const { diff: loadedDiff } = await appRpc.request.getGitHubPullRequestDiff({
				forceRefresh: true,
				headSha: latestDetail.headSha,
				pullRequestNumber: latestDetail.pullRequestNumber,
				repo: latestDetail.repo,
			})
			onUpdatedDiff(loadedDiff)
			setGenerationMessage('Starting review generation...')
			setGenerationOutputText(
				getLocalReviewProgressOutput([
					'Loading the latest PR diff before starting review generation...',
					'Starting review generation...',
				]),
			)
			const job = await appRpc.request.startReviewGeneration({
				instructionId,
				pullRequest: { ...latestDetail, diff: loadedDiff },
			})
			setGenerationJobId(job.id)
			setGenerationMessage(job.statusMessage ?? '')
			setGenerationOutputText(job.outputText ?? '')
			if (job.status === 'completed' && job.review) completeGeneration(job.review)
		} catch (error) {
			generatingPullRequestIdentityRef.current = null
			setGenerationMessage('')
			setGenerationError(getErrorMessage(error))
			setGenerationState('error')
			setGenerationOutputText('')
		}
	}, [
		completeGeneration,
		detail,
		instructionId,
		onPullRequestDetailRefresh,
		onStartGeneration,
		onUpdatedDiff,
	])

	return {
		publicState: {
			generateReview,
			generatedReview,
			generationError,
			generationMessage,
			generationOutputText,
			generationState,
		},
		setGeneratedReview,
	}
}
