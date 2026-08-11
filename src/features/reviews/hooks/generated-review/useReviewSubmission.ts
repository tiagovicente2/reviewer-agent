import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import { getErrorMessage } from '@/app/utils'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { GeneratedReview, ReviewFinding, ReviewSubmitEvent } from '@/shared/review'
import { markFindingsPublished, reconcilePublishedFindings } from '@/shared/review-publication'
import { getReviewSubmissionPolicy } from '@/shared/review-submission'
import { getPullRequestIdentity } from './reviewGenerationUtils'

type SubmitReviewRequest = {
	body?: string
	event: ReviewSubmitEvent
	findings?: ReviewFinding[]
}

export function useReviewSubmission({
	clearPublishError,
	currentUsername,
	detail,
	generatedReview,
	onPullRequestDetailRefresh,
	reportPublishError,
	setGeneratedReview,
}: {
	clearPublishError: () => void
	currentUsername?: string
	detail: GitHubPullRequestDetails | null
	generatedReview: GeneratedReview | null
	onPullRequestDetailRefresh: (detail: GitHubPullRequestDetails) => void
	reportPublishError: (error: unknown) => void
	setGeneratedReview: Dispatch<SetStateAction<GeneratedReview | null>>
}) {
	const submissionLockRef = useRef(false)
	const [submittingReviewEvent, setSubmittingReviewEvent] = useState<ReviewSubmitEvent | null>(null)
	const [submittedReviewState, setSubmittedReviewState] = useState<{
		pullRequestIdentity: string
		event: ReviewSubmitEvent
	} | null>(null)
	const pullRequestIdentity = detail ? getPullRequestIdentity(detail) : null
	const selectedPullRequestIdentityRef = useRef<string | null>(pullRequestIdentity)
	useLayoutEffect(() => {
		selectedPullRequestIdentityRef.current = pullRequestIdentity
	}, [pullRequestIdentity])
	const submittedReviewEvent =
		submittedReviewState?.pullRequestIdentity === pullRequestIdentity
			? submittedReviewState.event
			: null
	const { showToast } = useToast()

	const submitReview = useCallback(
		async (request: SubmitReviewRequest): Promise<boolean> => {
			if (!detail || !generatedReview || !pullRequestIdentity || submissionLockRef.current) {
				return false
			}

			const operationIdentity = pullRequestIdentity
			const policy = getReviewSubmissionPolicy({
				currentUsername,
				detail,
				event: request.event,
				hasReviewBody: Boolean(request.body?.trim()),
				publishableFindingsCount: request.findings?.length ?? 0,
				reviewedHeadSha: generatedReview.reviewedHeadSha,
				submissionLocked: false,
				submittedEvent: submittedReviewEvent,
			})
			if (!policy.allowed) {
				reportPublishError(policy.reason)
				return false
			}

			submissionLockRef.current = true
			setSubmittingReviewEvent(request.event)
			clearPublishError()
			try {
				const result = await appRpc.request.submitReview({
					body: request.body,
					event: request.event,
					findings: request.findings,
					pullRequest: detail,
					reviewedHeadSha: generatedReview.reviewedHeadSha,
				})
				setSubmittedReviewState({ event: request.event, pullRequestIdentity: operationIdentity })

				if (selectedPullRequestIdentityRef.current === operationIdentity) {
					const publishedIds = [...result.publishedFindingIds, ...result.alreadyPublishedFindingIds]
					setGeneratedReview((current) =>
						current
							? markFindingsPublished(current, publishedIds, new Date().toISOString())
							: current,
					)
				}
				showToast({
					title: request.event === 'approve' ? 'Pull request approved' : 'Changes requested',
					description: 'The review was submitted on GitHub.',
					tone: 'success',
				})
				if (request.event === 'request_changes' && result.alreadyPublishedFindingIds.length > 0) {
					showToast({
						title: 'Existing comments reconciled',
						description: 'Already-published inline comments were not submitted again.',
						tone: 'info',
					})
				}

				try {
					const refreshedDetail = await appRpc.request.getGitHubPullRequestDetails({
						forceRefresh: true,
						pullRequestNumber: detail.pullRequestNumber,
						repo: detail.repo,
					})
					if (selectedPullRequestIdentityRef.current === operationIdentity) {
						onPullRequestDetailRefresh(refreshedDetail)
						setGeneratedReview((current) =>
							current
								? reconcilePublishedFindings(current, refreshedDetail.reviewThreads)
								: current,
						)
					}
				} catch (error) {
					if (selectedPullRequestIdentityRef.current === operationIdentity) {
						reportPublishError(
							`The review was submitted, but pull request details could not be refreshed. Refresh the pull request to update its status. ${getErrorMessage(error)}`,
						)
					}
				}
				return true
			} catch (error) {
				if (selectedPullRequestIdentityRef.current === operationIdentity) {
					reportPublishError(error)
				}
				return false
			} finally {
				submissionLockRef.current = false
				setSubmittingReviewEvent(null)
			}
		},
		[
			clearPublishError,
			currentUsername,
			detail,
			generatedReview,
			onPullRequestDetailRefresh,
			pullRequestIdentity,
			reportPublishError,
			setGeneratedReview,
			showToast,
			submittedReviewEvent,
		],
	)

	return { submitReview, submittedReviewEvent, submittingReviewEvent }
}
