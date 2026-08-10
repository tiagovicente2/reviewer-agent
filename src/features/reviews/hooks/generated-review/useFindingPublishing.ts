import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useState } from 'react'
import { appRpc } from '@/app/rpc'
import { getErrorMessage } from '@/app/utils'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { GeneratedReview, ReviewFinding } from '@/shared/review'
import { getPullRequestIdentity, isFindingInlineComment } from './reviewGenerationUtils'

export function useFindingPublishing({
	detail,
	generatedReview,
	setGeneratedReview,
}: {
	detail: GitHubPullRequestDetails | null
	generatedReview: GeneratedReview | null
	setGeneratedReview: Dispatch<SetStateAction<GeneratedReview | null>>
}) {
	const [publishErrorState, setPublishErrorState] = useState<{
		message: string
		pullRequestIdentity: string
	} | null>(null)
	const [publishingFindingIds, setPublishingFindingIds] = useState<Set<string>>(() => new Set())
	const pullRequestIdentity = detail ? getPullRequestIdentity(detail) : null
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

	const publishFinding = useCallback(
		async (finding: ReviewFinding) => {
			if (!detail || !generatedReview) return
			setPublishErrorState(null)
			setPublishingFindingIds((current) => new Set(current).add(finding.id))
			try {
				await appRpc.request.publishReviewComment({
					finding,
					pullRequest: detail,
					reviewedHeadSha: generatedReview.reviewedHeadSha,
				})
			} catch (error) {
				reportPublishError(error)
			} finally {
				setPublishingFindingIds((current) => {
					const next = new Set(current)
					next.delete(finding.id)
					return next
				})
			}
		},
		[detail, generatedReview, reportPublishError],
	)

	const discardFinding = useCallback(
		(findingId: string) => {
			setPublishErrorState(null)
			setGeneratedReview((current) => {
				if (!current) return current
				const finding = current.findings.find((item) => item.id === findingId)
				if (!finding) return current

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
			discardFinding,
			publishError,
			publishFinding,
			publishingFindingIds,
		},
		reportPublishError,
	}
}
