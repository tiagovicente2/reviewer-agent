import { css, cx } from 'styled-system/css'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { formatDate } from '@/app/utils'
import { Badge } from '@/components/ui'
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
	return (
		<button
			className={cx(
				css({
					appearance: 'none',
					bg: 'gray.surface.bg',
					borderBottomWidth: '1px',
					color: 'fg.default',
					cursor: 'pointer',
					font: 'inherit',
					p: '0',
					textAlign: 'left',
					transition: 'background 150ms ease, box-shadow 150ms ease',
					w: '100%',
					'&:last-child': { borderBottomWidth: '0' },
					'&:hover': { bg: 'gray.3' },
					'&:focus-visible': {
						outline: '2px solid token(colors.cyan.8)',
						outlineOffset: '-2px',
					},
				}),
				selected && css({ bg: 'cyan.a2', boxShadow: 'inset 3px 0 token(colors.cyan.9)' }),
			)}
			onClick={() => onSelect(review.id)}
			type="button"
		>
			<Stack gap="2" px="4" py="3">
				<HStack alignItems="flex-start" justify="space-between" gap="4" w="100%">
					<HStack alignItems="flex-start" gap="2" minW="0" flex="1">
						<PullRequestIcon isDraft={review.isDraft} />
						<Box fontWeight="medium" lineHeight="1.4" minW="0">
							{review.title}
						</Box>
					</HStack>
					{review.isDraft ? (
						<Badge colorPalette="gray" flexShrink="0">
							draft
						</Badge>
					) : (
						<HStack color="fg.muted" flexShrink="0" gap="1.5" textStyle="xs">
							<Box bg="yellow.9" borderRadius="full" h="2" w="2" />
							<Box display={{ base: 'none', xl: 'block' }}>Awaiting review</Box>
						</HStack>
					)}
				</HStack>
				<HStack color="fg.muted" gap="1" pl="6" textStyle="xs" flexWrap="wrap">
					<Box color="fg.default">
						{review.repo}#{review.pullRequestNumber}
					</Box>
					<Box aria-hidden="true">•</Box>
					<Box>@{review.author}</Box>
					<Box aria-hidden="true">•</Box>
					<Box>Updated {formatDate(review.updatedAt)}</Box>
				</HStack>
			</Stack>
		</button>
	)
}

function PullRequestIcon({ isDraft }: { isDraft: boolean }) {
	return (
		<svg
			aria-hidden="true"
			className={css({
				color: isDraft ? 'fg.muted' : 'red.10',
				flexShrink: '0',
				h: '4',
				mt: '0.5',
				w: '4',
			})}
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.7"
			viewBox="0 0 16 16"
		>
			<circle cx="4" cy="3" r="1.5" />
			<circle cx="4" cy="13" r="1.5" />
			<circle cx="12" cy="13" r="1.5" />
			<path d="M4 4.5v7M9 3h1a2 2 0 0 1 2 2v6.5M9 3l2-2M9 3l2 2" />
		</svg>
	)
}
