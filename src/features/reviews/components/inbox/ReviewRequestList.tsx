import { useMemo, useState } from 'react'
import { css } from 'styled-system/css'
import { Box, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { StatusCard } from '@/components/common'
import type { GitHubReviewRequest } from '@/shared/github'
import { ReviewRequestCard } from './ReviewRequestCard'

export function ReviewRequestList({
	groupByReviewRequest,
	onSelectReview,
	reviews,
	reviewsState,
	selectedReviewId,
}: {
	groupByReviewRequest: boolean
	onSelectReview: (id: string) => void
	reviews: GitHubReviewRequest[]
	reviewsState: AsyncState
	selectedReviewId: string | null
}) {
	const directReviews = useMemo(
		() => reviews.filter((review) => review.reviewRequestType !== 'team'),
		[reviews],
	)
	const teamReviews = useMemo(
		() => reviews.filter((review) => review.reviewRequestType === 'team'),
		[reviews],
	)

	if (reviewsState === 'loading') {
		return (
			<StatusCard
				title="Loading GitHub PRs"
				body="Loading your direct and team review requests..."
			/>
		)
	}

	if (reviews.length === 0) {
		return (
			<StatusCard
				title="No requested reviews found"
				body="GitHub did not return any open PRs where you or one of your teams is requested as a reviewer."
			/>
		)
	}

	if (!groupByReviewRequest) {
		return (
			<ReviewRequestGroup
				title="Pull requests"
				reviews={reviews}
				onSelectReview={onSelectReview}
				selectedReviewId={selectedReviewId}
			/>
		)
	}

	return (
		<Stack gap="5">
			<ReviewRequestGroup
				title="Needs your review"
				reviews={directReviews}
				onSelectReview={onSelectReview}
				selectedReviewId={selectedReviewId}
			/>
			<ReviewRequestGroup
				title="Needs your teams' review"
				reviews={teamReviews}
				onSelectReview={onSelectReview}
				selectedReviewId={selectedReviewId}
			/>
		</Stack>
	)
}

function ReviewRequestGroup({
	onSelectReview,
	reviews,
	selectedReviewId,
	title,
}: {
	onSelectReview: (id: string) => void
	reviews: GitHubReviewRequest[]
	selectedReviewId: string | null
	title: string
}) {
	const [expanded, setExpanded] = useState(true)
	const panelId = `review-group-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`

	return (
		<Box>
			<button
				aria-controls={panelId}
				aria-expanded={expanded}
				className={css({
					alignItems: 'center',
					appearance: 'none',
					bg: 'transparent',
					color: 'fg.default',
					cursor: 'pointer',
					display: 'flex',
					font: 'inherit',
					gap: '2',
					mb: '2',
					p: '0',
					textAlign: 'left',
					'&:focus-visible': {
						borderRadius: 'sm',
						outline: '2px solid token(colors.cyan.8)',
						outlineOffset: '2px',
					},
				})}
				onClick={() => setExpanded((current) => !current)}
				type="button"
			>
				<Box
					aria-hidden="true"
					color="fg.muted"
					fontSize="sm"
					transform={expanded ? 'rotate(90deg)' : 'rotate(0deg)'}
					transition="transform 150ms ease"
				>
					›
				</Box>
				<Box fontWeight="semibold">{title}</Box>
				<Box
					bg="gray.4"
					borderRadius="full"
					color="fg.muted"
					alignItems="center"
					display="inline-flex"
					fontSize="xs"
					fontWeight="semibold"
					h="5"
					justifyContent="center"
					minW="5"
					px="1.5"
				>
					{reviews.length}
				</Box>
			</button>

			{expanded && reviews.length > 0 ? (
				<Box borderWidth="1px" borderRadius="md" id={panelId} overflow="hidden">
					{reviews.map((review) => (
						<ReviewRequestCard
							key={review.id}
							review={review}
							selected={review.id === selectedReviewId}
							onSelect={onSelectReview}
						/>
					))}
				</Box>
			) : null}
		</Box>
	)
}
