import { useFindingPublishing } from './generated-review/useFindingPublishing'
import {
	type UseReviewGenerationParams,
	useReviewGeneration,
} from './generated-review/useReviewGeneration'
import { useReviewSubmission } from './generated-review/useReviewSubmission'

export type UseGeneratedReviewParams = UseReviewGenerationParams

export function useGeneratedReview(params: UseGeneratedReviewParams) {
	const generation = useReviewGeneration(params)
	const findings = useFindingPublishing({
		detail: params.detail,
		generatedReview: generation.publicState.generatedReview,
		onPullRequestDetailRefresh: params.onPullRequestDetailRefresh,
		setGeneratedReview: generation.setGeneratedReview,
	})
	const submission = useReviewSubmission({
		clearPublishError: findings.clearPublishError,
		detail: params.detail,
		generatedReview: generation.publicState.generatedReview,
		onPullRequestDetailRefresh: params.onPullRequestDetailRefresh,
		reportPublishError: findings.reportPublishError,
		setGeneratedReview: generation.setGeneratedReview,
	})

	return {
		...generation.publicState,
		...findings.publicState,
		...submission,
	}
}
