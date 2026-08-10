import { useCallback, useState } from 'react'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { GeneratedReview, ReviewFinding, ReviewSubmitEvent } from '@/shared/review'

export function useReviewSubmission({
	clearPublishError,
	detail,
	generatedReview,
	reportPublishError,
}: {
	clearPublishError: () => void
	detail: GitHubPullRequestDetails | null
	generatedReview: GeneratedReview | null
	reportPublishError: (error: unknown) => void
}) {
	const [submittingReviewEvent, setSubmittingReviewEvent] = useState<ReviewSubmitEvent | null>(null)
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
			if (!detail || !generatedReview) return
			clearPublishError()
			setSubmittingReviewEvent(event)
			try {
				await appRpc.request.submitReview({
					body,
					event,
					findings,
					pullRequest: detail,
					reviewedHeadSha: generatedReview.reviewedHeadSha,
				})
				showToast({
					title: event === 'approve' ? 'Pull request approved' : 'Changes requested',
					description: 'The review was submitted on GitHub.',
					tone: 'success',
				})
			} catch (error) {
				reportPublishError(error)
			} finally {
				setSubmittingReviewEvent(null)
			}
		},
		[clearPublishError, detail, generatedReview, reportPublishError, showToast],
	)

	return { submitReview, submittingReviewEvent }
}
