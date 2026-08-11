import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useState } from 'react'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import { getErrorMessage } from '@/app/utils'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { GeneratedReview, ReviewFinding } from '@/shared/review'
import { markFindingsPublished, reconcilePublishedFindings } from '@/shared/review-publication'
import {
	createPullRequestSelectionGuard,
	getPullRequestIdentity,
	isFindingInlineComment,
	updateFindingComment,
} from './reviewGenerationUtils'

export function useFindingPublishing({
	detail,
	generatedReview,
	onPullRequestDetailRefresh,
	setGeneratedReview,
}: {
	detail: GitHubPullRequestDetails | null
	generatedReview: GeneratedReview | null
	onPullRequestDetailRefresh: (detail: GitHubPullRequestDetails) => void
	setGeneratedReview: Dispatch<SetStateAction<GeneratedReview | null>>
}) {
	const [publishErrorState, setPublishErrorState] = useState<{
		message: string
		pullRequestIdentity: string
	} | null>(null)
	const [publishingFindingIds, setPublishingFindingIds] = useState<Set<string>>(() => new Set())
	const pullRequestIdentity = detail ? getPullRequestIdentity(detail) : null
	const [selectionGuard] = useState(createPullRequestSelectionGuard)
	selectionGuard.select(pullRequestIdentity)
	const { showToast } = useToast()
	const publishError =
		publishErrorState?.pullRequestIdentity === pullRequestIdentity ? publishErrorState.message : ''

	const clearPublishError = useCallback(() => {
		setPublishErrorState(null)
	}, [])

	const reportPublishError = useCallback(
		(error: unknown) => {
			if (!pullRequestIdentity) return
			setPublishErrorState({
				message: getErrorMessage(error),
				pullRequestIdentity,
			})
		},
		[pullRequestIdentity],
	)

	const changeFindingComment = useCallback(
		(findingId: string, commentBody: string) => {
			setPublishErrorState(null)
			setGeneratedReview((current) =>
				current ? updateFindingComment(current, findingId, commentBody) : current,
			)
		},
		[setGeneratedReview],
	)

	const publishFinding = useCallback(
		async (finding: ReviewFinding) => {
			if (!detail || !generatedReview || !pullRequestIdentity) return
			const operationIdentity = pullRequestIdentity
			setPublishErrorState(null)
			setPublishingFindingIds((current) => new Set(current).add(finding.id))
			try {
				const result = await appRpc.request.publishReviewComment({
					finding,
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
				showPublicationToasts(result, showToast)
				if (result.failures.length > 0) {
					reportPublishError(
						new Error(result.failures.map((failure) => failure.message).join('\n')),
					)
				}

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
			} catch (error) {
				if (selectionGuard.isSelected(operationIdentity)) reportPublishError(error)
			} finally {
				setPublishingFindingIds((current) => {
					const next = new Set(current)
					next.delete(finding.id)
					return next
				})
			}
		},
		[
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

	const discardFinding = useCallback(
		(findingId: string) => {
			setPublishErrorState(null)
			setGeneratedReview((current) => {
				if (!current) return current
				const finding = current.findings.find((item) => item.id === findingId)
				if (!finding || finding.publication?.state === 'published') return current

				return {
					...current,
					findings: current.findings.filter((item) => item.id !== findingId),
					inlineComments: current.inlineComments.filter(
						(comment) => !isFindingInlineComment(finding, comment),
					),
				}
			})
		},
		[setGeneratedReview],
	)

	return {
		clearPublishError,
		publicState: {
			changeFindingComment,
			discardFinding,
			publishError,
			publishFinding,
			publishingFindingIds,
		},
		reportPublishError,
	}
}

function showPublicationToasts(
	result: {
		publishedFindingIds: string[]
		alreadyPublishedFindingIds: string[]
	},
	showToast: ReturnType<typeof useToast>['showToast'],
) {
	if (result.publishedFindingIds.length > 0) {
		showToast({
			title: 'Comment published',
			description: 'The inline review comment was published on GitHub.',
			tone: 'success',
		})
	}
	if (result.alreadyPublishedFindingIds.length > 0) {
		showToast({
			title: 'Comment already published',
			description: 'The existing GitHub comment was reconciled with this finding.',
			tone: 'info',
		})
	}
}
