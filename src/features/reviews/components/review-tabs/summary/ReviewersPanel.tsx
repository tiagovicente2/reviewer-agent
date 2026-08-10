import { css } from 'styled-system/css'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { Card } from '@/components/ui'
import type { GitHubPullRequestDetails } from '@/shared/github'
import { getReviewerStatus, getSummaryReviewers, type SummaryReviewer } from './reviewerStatus'

export function ReviewersPanel({ detail }: { detail: GitHubPullRequestDetails | null }) {
	const reviewers = getSummaryReviewers(detail)

	return (
		<Card.Root alignSelf="start" maxH="100%" minH="0" overflow="hidden" variant="outline">
			<Card.Header p="3" pb="1.5">
				<Card.Title textStyle="sm">Reviewers</Card.Title>
			</Card.Header>
			<Card.Body minH="0" overflowY="auto" px="3" pb="3" pt="1">
				{reviewers.length ? (
					<Stack gap="2">
						{reviewers.map((reviewer) => {
							const status = getReviewerStatus(reviewer.state)
							return (
								<HStack key={`${reviewer.type}:${reviewer.login}`} gap="2" minW="0">
									<ReviewerAvatar reviewer={reviewer} />
									<Stack flex="1" gap="0" minW="0">
										<Box fontWeight="medium" textStyle="sm" truncate>
											{reviewer.login}
										</Box>
										<HStack color={status.color} gap="1" minW="0" textStyle="xs">
											<Box bg={status.color} borderRadius="full" flexShrink="0" h="1.5" w="1.5" />
											<Box title={status.label} truncate>
												{status.label}
											</Box>
										</HStack>
									</Stack>
								</HStack>
							)
						})}
					</Stack>
				) : (
					<Box color="fg.muted" textStyle="sm">
						No reviewers assigned.
					</Box>
				)}
			</Card.Body>
		</Card.Root>
	)
}

function ReviewerAvatar({ reviewer }: { reviewer: SummaryReviewer }) {
	return (
		<Box
			alignItems="center"
			bg="gray.4"
			borderRadius="full"
			color="fg.muted"
			display="flex"
			flexShrink="0"
			fontSize="xs"
			fontWeight="bold"
			h="5"
			justifyContent="center"
			overflow="hidden"
			position="relative"
			w="5"
		>
			{reviewer.type === 'team' ? 'T' : reviewer.login.charAt(0).toUpperCase()}
			{reviewer.type === 'user' ? (
				<img
					alt=""
					className={css({
						h: '100%',
						inset: '0',
						objectFit: 'cover',
						position: 'absolute',
						w: '100%',
					})}
					loading="lazy"
					onError={(event) => {
						event.currentTarget.style.display = 'none'
					}}
					src={`https://github.com/${encodeURIComponent(reviewer.login)}.png?size=48`}
				/>
			) : null}
		</Box>
	)
}
