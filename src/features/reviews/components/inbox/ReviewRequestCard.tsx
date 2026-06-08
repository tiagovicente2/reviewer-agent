import { css, cx } from 'styled-system/css'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { formatDate } from '@/app/utils'
import { Badge, Card } from '@/components/ui'
import type { GitHubReviewRequest } from '@/shared/github'

export function ReviewRequestCard({
	onSelect,
	review,
	selected,
}: {
	onSelect: (id: string) => void
	review: GitHubReviewRequest
	selected: boolean
}) {
	const badgeLabel = review.notificationReason
		? review.notificationReason.replace(/_/g, ' ')
		: review.isDraft
			? 'draft'
			: 'open'

	return (
		<Card.Root
			asChild
			className={cx(
				css({
					appearance: 'none',
					bg: 'gray.surface.bg',
					color: 'fg.default',
					cursor: 'pointer',
					font: 'inherit',
					transition: 'all 150ms ease',
					w: '100%',
				}),
				selected && css({ borderColor: 'cyan.8', boxShadow: '0 0 0 1px token(colors.cyan.8)' }),
			)}
		>
			<button onClick={() => onSelect(review.id)} type="button">
				<Card.Body p="4" textAlign="left">
					<HStack alignItems="flex-start" justify="space-between" gap="3" w="100%">
						<Stack gap="1" minW="0" flex="1">
							<Box color="cyan.11" fontWeight="semibold" textStyle="sm">
								{review.repo}
							</Box>
							<Box fontWeight="medium" textAlign="left">
								#{review.pullRequestNumber} {review.title}
							</Box>
						</Stack>
						<Badge colorPalette={review.unread === false || review.isDraft ? 'gray' : 'cyan'}>
							{badgeLabel}
						</Badge>
					</HStack>
					<HStack justify="space-between" mt="4" color="fg.muted" textStyle="xs">
						<Box>{review.author === 'unknown' ? 'GitHub notification' : `@${review.author}`}</Box>
						<Box>{formatDate(review.updatedAt)}</Box>
					</HStack>
				</Card.Body>
			</button>
		</Card.Root>
	)
}
