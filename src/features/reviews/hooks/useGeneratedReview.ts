import { useCallback, useEffect, useState } from 'react'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import type { GitHubPullRequestDetails } from '@/shared/github'
import {
	getReviewGenerationJobId,
	type GeneratedReview,
	type ReviewFinding,
	type ReviewSubmitEvent,
} from '@/shared/review'

const reviewPromptLabel = 'Generate a draft GitHub pull request review'

function getLocalReviewProgressOutput(messages: string[]) {
	return `${reviewPromptLabel}\n\n${messages.map((message) => `:: ${message}`).join('\n')}\n`
}

export function useGeneratedReview({
	detail,
	loadDiff,
	onSummary,
	onStartGeneration,
}: {
	detail: GitHubPullRequestDetails | null
	loadDiff: () => Promise<string>
	onSummary: (summary: string) => void
	onStartGeneration: () => void
}) {
	const [generatedReview, setGeneratedReview] = useState<GeneratedReview | null>(null)
	const [generationState, setGenerationState] = useState<AsyncState>('idle')
	const [generationError, setGenerationError] = useState('')
	const [generationMessage, setGenerationMessage] = useState('')
	const [generationOutputText, setGenerationOutputText] = useState('')
	const [publishError, setPublishError] = useState('')
	const [publishingAll, setPublishingAll] = useState(false)
	const [publishingFindingIds, setPublishingFindingIds] = useState<Set<string>>(() => new Set())
	const [submittingReviewEvent, setSubmittingReviewEvent] = useState<ReviewSubmitEvent | null>(null)
	const [generationJobId, setGenerationJobId] = useState<string | null>(null)
	const { showToast } = useToast()

	const completeGeneration = useCallback(
		(review: GeneratedReview) => {
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
		setGeneratedReview(null)
		setGenerationState('idle')
		setGenerationError('')
		setGenerationMessage('')
		setGenerationOutputText('')
		setPublishError('')
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
	}, [detail])

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
		setGenerationState('loading')
		setGenerationError('')
		setGenerationMessage('Loading the latest PR diff before starting review generation...')
		setGenerationOutputText(
			getLocalReviewProgressOutput([
				'Loading the latest PR diff before starting review generation...',
			]),
		)

		try {
			const loadedDiff = await loadDiff()
			setGenerationMessage('Starting review generation...')
			setGenerationOutputText(
				getLocalReviewProgressOutput([
					'Loading the latest PR diff before starting review generation...',
					'Starting review generation...',
				]),
			)
			const job = await appRpc.request.startReviewGeneration({
				pullRequest: { ...detail, diff: loadedDiff },
			})
			setGenerationJobId(job.id)
			setGenerationMessage(job.statusMessage ?? '')
			setGenerationOutputText(job.outputText ?? '')
			if (job.status === 'completed' && job.review) completeGeneration(job.review)
		} catch (error) {
			setGenerationMessage('')
			setGenerationError(getErrorMessage(error))
			setGenerationState('error')
			setGenerationOutputText('')
		}
	}, [completeGeneration, detail, loadDiff, onStartGeneration])

	const publishFinding = useCallback(
		async (finding: ReviewFinding) => {
			if (!detail) return
			setPublishError('')
			setPublishingFindingIds((current) => new Set(current).add(finding.id))
			try {
				await appRpc.request.publishReviewComment({ finding, pullRequest: detail })
			} catch (error) {
				setPublishError(getErrorMessage(error))
			} finally {
				setPublishingFindingIds((current) => {
					const next = new Set(current)
					next.delete(finding.id)
					return next
				})
			}
		},
		[detail],
	)

	const publishAll = useCallback(
		async (findings: ReviewFinding[]) => {
			if (!detail) return
			setPublishError('')
			setPublishingAll(true)
			try {
				await appRpc.request.publishReviewComments({ findings, pullRequest: detail })
			} catch (error) {
				setPublishError(getErrorMessage(error))
			} finally {
				setPublishingAll(false)
			}
		},
		[detail],
	)

	const submitReview = useCallback(
		async ({
			body,
			event,
			findings,
		}: {
			body?: string
			event: ReviewSubmitEvent
			findings?: ReviewFinding[]
		}) => {
			if (!detail) return
			setPublishError('')
			setSubmittingReviewEvent(event)
			try {
				await appRpc.request.submitReview({ body, event, findings, pullRequest: detail })
				showToast({
					title: event === 'approve' ? 'Pull request approved' : 'Changes requested',
					description: 'The review was submitted on GitHub.',
					tone: 'success',
				})
			} catch (error) {
				setPublishError(getErrorMessage(error))
			} finally {
				setSubmittingReviewEvent(null)
			}
		},
		[detail, showToast],
	)

	return {
		generateReview,
		generatedReview,
		generationError,
		generationMessage,
		generationOutputText,
		generationState,
		publishAll,
		publishError,
		publishFinding,
		publishingAll,
		publishingFindingIds,
		submitReview,
		submittingReviewEvent,
	}
}
