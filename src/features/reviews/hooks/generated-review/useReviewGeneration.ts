import { useCallback, useEffect, useRef, useState } from 'react'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import type { GitHubPullRequestDetails } from '@/shared/github'
import { type GeneratedReview, getReviewGenerationJobId } from '@/shared/review'
import { reconcilePublishedFindings } from '@/shared/review-publication'
import {
	createReviewGenerationGuard,
	getLocalReviewProgressOutput,
	getPullRequestIdentity,
	type ReviewGenerationToken,
} from './reviewGenerationUtils'

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
	const [generationJob, setGenerationJob] = useState<{
		jobId: string
		token: ReviewGenerationToken
	} | null>(null)
	const [generationGuard] = useState(createReviewGenerationGuard)
	const activeGenerationTokenRef = useRef<ReviewGenerationToken | null>(null)
	const generatedReviewPullRequestIdentityRef = useRef<string | null>(null)
	const generatedReviewHeadShaRef = useRef<string | null>(null)
	const selectedPullRequestIdentity = detail ? getPullRequestIdentity(detail) : null
	generationGuard.select(selectedPullRequestIdentity)
	const { showToast } = useToast()

	const isGeneratingPullRequest = useCallback(
		(pullRequest: GitHubPullRequestDetails | null) => {
			const token = activeGenerationTokenRef.current
			return Boolean(
				pullRequest &&
					token?.pullRequestIdentity === getPullRequestIdentity(pullRequest) &&
					generationGuard.isCurrent(token),
			)
		},
		[generationGuard],
	)

	const completeGeneration = useCallback(
		(token: ReviewGenerationToken, review: GeneratedReview) => {
			if (!generationGuard.complete(token)) return false
			if (activeGenerationTokenRef.current === token) activeGenerationTokenRef.current = null
			generatedReviewPullRequestIdentityRef.current = token.pullRequestIdentity
			generatedReviewHeadShaRef.current = review.reviewedHeadSha
			setGeneratedReview(review)
			onSummary(review.publishableBody || review.summary)
			setGenerationState('idle')
			setGenerationMessage('')
			setGenerationOutputText('')
			setGenerationJob(null)
			showToast({
				title: 'Review completed',
				description: 'A draft review was generated.',
				tone: 'success',
			})
			return true
		},
		[generationGuard, onSummary, showToast],
	)

	useEffect(() => {
		if (isGeneratingPullRequest(detail)) return
		if (
			detail &&
			generatedReviewPullRequestIdentityRef.current === selectedPullRequestIdentity &&
			generatedReviewHeadShaRef.current === detail.headSha
		) {
			return
		}

		activeGenerationTokenRef.current = null
		generatedReviewPullRequestIdentityRef.current = null
		generatedReviewHeadShaRef.current = null
		setGeneratedReview(null)
		setGenerationState('idle')
		setGenerationError('')
		setGenerationMessage('')
		setGenerationOutputText('')
		setGenerationJob(null)
		if (!detail || !selectedPullRequestIdentity) return

		let cancelled = false
		const restoredPullRequestIdentity = getPullRequestIdentity(detail)
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
				generatedReviewPullRequestIdentityRef.current = savedReview
					? restoredPullRequestIdentity
					: null
				generatedReviewHeadShaRef.current = savedReview ? detail.headSha : null
				setGeneratedReview(
					savedReview ? reconcilePublishedFindings(savedReview, detail.reviewThreads) : savedReview,
				)
				if (job?.status === 'running') {
					const token = generationGuard.begin(restoredPullRequestIdentity)
					activeGenerationTokenRef.current = token
					setGenerationState('loading')
					setGenerationJob({ jobId: job.id, token })
					setGenerationMessage(job.statusMessage ?? '')
					setGenerationOutputText(job.outputText ?? '')
				} else if (job?.status === 'failed') {
					setGenerationState('error')
					setGenerationError(job.error ?? 'Review generation failed.')
				} else {
					setGenerationState('idle')
					setGenerationJob(null)
				}
			})
			.catch(() => {
				if (!cancelled) setGeneratedReview(null)
			})

		return () => {
			cancelled = true
		}
	}, [detail, generationGuard, isGeneratingPullRequest, selectedPullRequestIdentity])

	const reconciledGeneratedReview =
		generatedReview && detail
			? reconcilePublishedFindings(generatedReview, detail.reviewThreads)
			: generatedReview
	const reconciledFindingIds = getNewlyReconciledFindingIds(
		generatedReview,
		reconciledGeneratedReview,
	)

	useEffect(() => {
		if (!reconciledFindingIds) return
		showToast({
			title: 'Existing comments reconciled',
			description: 'Published GitHub comments were matched to this review draft.',
			tone: 'info',
		})
	}, [reconciledFindingIds, showToast])

	useEffect(() => {
		if (
			!detail ||
			!reconciledGeneratedReview ||
			generatedReviewPullRequestIdentityRef.current !== getPullRequestIdentity(detail) ||
			reconciledGeneratedReview.reviewedHeadSha !== detail.headSha
		) {
			return
		}

		void appRpc.request
			.saveReviewDraft({
				headSha: detail.headSha,
				pullRequestNumber: detail.pullRequestNumber,
				repo: detail.repo,
				review: reconciledGeneratedReview,
			})
			.catch((error) => console.error('Could not persist edited review draft.', error))
	}, [detail, reconciledGeneratedReview])

	useEffect(() => {
		if (!generationJob) return

		let cancelled = false
		const interval = window.setInterval(async () => {
			try {
				const job = await appRpc.request.getReviewGenerationJob({ jobId: generationJob.jobId })
				if (cancelled || !generationGuard.isCurrent(generationJob.token) || !job) return
				setGenerationMessage(job.statusMessage ?? '')
				setGenerationOutputText(job.outputText ?? '')

				if (job.status === 'completed' && job.review) {
					completeGeneration(generationJob.token, job.review)
				}

				if (job.status === 'failed') {
					if (!generationGuard.complete(generationJob.token)) return
					if (activeGenerationTokenRef.current === generationJob.token) {
						activeGenerationTokenRef.current = null
					}
					setGenerationError(job.error ?? 'Review generation failed.')
					setGenerationState('error')
					setGenerationOutputText('')
					setGenerationJob(null)
				}
			} catch (error) {
				if (cancelled || !generationGuard.complete(generationJob.token)) return
				if (activeGenerationTokenRef.current === generationJob.token) {
					activeGenerationTokenRef.current = null
				}
				setGenerationError(getErrorMessage(error))
				setGenerationState('error')
				setGenerationOutputText('')
				setGenerationJob(null)
			}
		}, 1500)

		return () => {
			cancelled = true
			window.clearInterval(interval)
		}
	}, [completeGeneration, generationGuard, generationJob])

	const generateReview = useCallback(async () => {
		if (!detail) {
			setGenerationError('Load PR details before generating a review.')
			setGenerationState('error')
			return
		}

		const pullRequestIdentity = getPullRequestIdentity(detail)
		const token = generationGuard.begin(pullRequestIdentity)
		activeGenerationTokenRef.current = token
		onStartGeneration()
		setGenerationState('loading')
		setGenerationError('')
		setGenerationMessage('Loading the latest PR diff before starting review generation...')
		setGenerationOutputText(
			getLocalReviewProgressOutput([
				'Loading the latest PR diff before starting review generation...',
			]),
		)
		setGenerationJob(null)

		try {
			const latestDetail = await appRpc.request.getGitHubPullRequestDetails({
				forceRefresh: true,
				pullRequestNumber: detail.pullRequestNumber,
				repo: detail.repo,
			})
			if (!generationGuard.isCurrent(token)) return
			onPullRequestDetailRefresh(latestDetail)
			const { diff: loadedDiff } = await appRpc.request.getGitHubPullRequestDiff({
				forceRefresh: true,
				headSha: latestDetail.headSha,
				pullRequestNumber: latestDetail.pullRequestNumber,
				repo: latestDetail.repo,
			})
			if (!generationGuard.isCurrent(token)) return
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
			if (!generationGuard.isCurrent(token)) return
			setGenerationJob({ jobId: job.id, token })
			setGenerationMessage(job.statusMessage ?? '')
			setGenerationOutputText(job.outputText ?? '')
			if (job.status === 'completed' && job.review) completeGeneration(token, job.review)
		} catch (error) {
			if (!generationGuard.isCurrent(token)) return
			generationGuard.complete(token)
			if (activeGenerationTokenRef.current === token) activeGenerationTokenRef.current = null
			setGenerationMessage('')
			setGenerationError(getErrorMessage(error))
			setGenerationState('error')
			setGenerationOutputText('')
			setGenerationJob((currentJob) =>
				currentJob?.token && currentJob.token !== token ? currentJob : null,
			)
		}
	}, [
		completeGeneration,
		detail,
		generationGuard,
		instructionId,
		onPullRequestDetailRefresh,
		onStartGeneration,
		onUpdatedDiff,
	])

	return {
		publicState: {
			generateReview,
			generatedReview: reconciledGeneratedReview,
			generationError,
			generationMessage,
			generationOutputText,
			generationState,
		},
		setGeneratedReview,
	}
}

function getNewlyReconciledFindingIds(
	original: GeneratedReview | null,
	reconciled: GeneratedReview | null,
) {
	if (!original || !reconciled || original === reconciled) return ''
	const findingIds: string[] = []
	for (const [index, finding] of reconciled.findings.entries()) {
		if (
			finding.publication?.state === 'published' &&
			original.findings[index]?.publication?.state !== 'published'
		) {
			findingIds.push(finding.id)
		}
	}
	return findingIds.join(':')
}
