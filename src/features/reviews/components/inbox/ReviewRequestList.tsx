import { Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { StatusCard } from '@/components/common'
import type { GitHubReviewRequest } from '@/shared/github'
import { ReviewRequestCard } from './ReviewRequestCard'

export function ReviewRequestList({
	onSelectReview,
	reviews,
	reviewsState,
	selectedReviewId,
}: {
	onSelectReview: (id: string) => void
	reviews: GitHubReviewRequest[]
	reviewsState: AsyncState
	selectedReviewId: string | null
}) {
	return (
		<Stack gap="3">
			{reviewsState === 'loading' ? (
				<StatusCard
					title="Loading GitHub PRs"
					body="Calling gh search prs --review-requested=@me..."
				/>
			) : null}

			{reviewsState !== 'loading' && reviews.length === 0 ? (
				<StatusCard
					title="No requested reviews found"
					body="GitHub did not return any open PRs where you are currently requested as a reviewer."
				/>
			) : null}

			{reviews.map((review) => (
				<ReviewRequestCard
					key={review.id}
					review={review}
					selected={review.id === selectedReviewId}
					onSelect={onSelectReview}
				/>
			))}
		</Stack>
	)
}
