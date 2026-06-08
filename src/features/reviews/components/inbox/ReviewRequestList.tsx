import { useMemo } from 'react'
import { css } from 'styled-system/css'
import { Box, HStack, Stack } from 'styled-system/jsx'
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
	const reviewGroups = useMemo(() => {
		const groups = new Map<string, GitHubReviewRequest[]>()
		for (const review of reviews) {
			groups.set(review.repo, [...(groups.get(review.repo) ?? []), review])
		}
		return Array.from(groups, ([repo, items]) => ({ repo, items }))
	}, [reviews])

	return (
		<Stack gap="3">
			{reviewsState === 'loading' ? (
				<StatusCard
					title="Loading GitHub notifications"
					body="Calling gh api notifications and filtering pull request threads..."
				/>
			) : null}

			{reviewsState !== 'loading' && reviews.length === 0 ? (
				<StatusCard
					title="No pull request notifications found"
					body="GitHub did not return any PR notification threads."
				/>
			) : null}

			{reviewGroups.map((group) => (
				<Stack key={group.repo} gap="2">
					<HStack
						className={css({
							borderBottomWidth: '1px',
							borderColor: 'border.subtle',
							color: 'fg.default',
							fontWeight: 'semibold',
							justifyContent: 'space-between',
							pb: '2',
							textStyle: 'sm',
						})}
					>
						<Box minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
							{group.repo}
						</Box>
						<Box color="fg.muted" flexShrink="0" textStyle="xs">
							{group.items.length}
						</Box>
					</HStack>
					{group.items.map((review) => (
						<ReviewRequestCard
							key={review.id}
							review={review}
							selected={review.id === selectedReviewId}
							onSelect={onSelectReview}
						/>
					))}
				</Stack>
			))}
		</Stack>
	)
}
