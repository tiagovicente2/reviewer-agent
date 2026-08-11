import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useState } from 'react'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { GeneratedReview, ReviewFinding, ReviewSubmitEvent } from '@/shared/review'
import { markFindingsPublished, reconcilePublishedFindings } from '@/shared/review-publication'
import { createPullRequestSelectionGuard, getPullRequestIdentity } from './reviewGenerationUtils'

export function useReviewSubmission({
	clearPublishError,
	detail,
	generatedReview,
	onPullRequestDetailRefresh,
	reportPublishError,
	setGeneratedReview,
}: {
	clearPublishError: () => void
	detail: GitHubPullRequestDetails | null
	generatedReview: GeneratedReview | null
	onPullRequestDetailRefresh: (detail: GitHubPullRequestDetails) => void
	reportPublishError: (error: unknown) => void
	setGeneratedReview: Dispatch<SetStateAction<GeneratedReview | null>>
}) {
	const [submittingReviewEvent, setSubmittingReviewEvent] = useState<ReviewSubmitEvent | null>(null)
	const pullRequestIdentity = detail ? getPullRequestIdentity(detail) : null
	const [selectionGuard] = useState(createPullRequestSelectionGuard)
	selectionGuard.select(pullRequestIdentity)
	const { showToast } = useToast()

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
			if (!detail || !generatedReview || !pullRequestIdentity) return
			const operationIdentity = pullRequestIdentity
			clearPublishError()
			setSubmittingReviewEvent(event)
			try {
				const result = await appRpc.request.submitReview({
					body,
					event,
					findings,
					pullRequest: detail,
					reviewedHeadSha: generatedReview.reviewedHeadSha,
				})
				if (!selectionGuard.isSelected(operationIdentity)) return

				const publishedIds = [...result.publishedFindingIds, ...result.alreadyPublishedFindingIds]
				setGeneratedReview((current) =>
					current
						? markFindingsPublished(current, publishedIds, new Date().toISOString())
						: current,
				)
				showToast({
					title: event === 'approve' ? 'Pull request approved' : 'Changes requested',
					description: 'The review was submitted on GitHub.',
					tone: 'success',
				})
				if (event === 'request_changes' && result.alreadyPublishedFindingIds.length > 0) {
					showToast({
						title: 'Existing comments reconciled',
						description: 'Already-published inline comments were not submitted again.',
						tone: 'info',
					})
				}

				if (event === 'request_changes') {
					const refreshedDetail = await appRpc.request.getGitHubPullRequestDetails({
						forceRefresh: true,
						pullRequestNumber: detail.pullRequestNumber,
						repo: detail.repo,
					})
					if (!selectionGuard.isSelected(operationIdentity)) return
					onPullRequestDetailRefresh(refreshedDetail)
					setGeneratedReview((current) =>
						current ? reconcilePublishedFindings(current, refreshedDetail.reviewThreads) : current,
					)
				}
			} catch (error) {
				if (selectionGuard.isSelected(operationIdentity)) reportPublishError(error)
			} finally {
				setSubmittingReviewEvent(null)
			}
		},
		[
			clearPublishError,
			detail,
			generatedReview,
			onPullRequestDetailRefresh,
			pullRequestIdentity,
			reportPublishError,
			selectionGuard,
			setGeneratedReview,
			showToast,
		],
	)

	return { submitReview, submittingReviewEvent }
}
