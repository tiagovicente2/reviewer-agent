import { css } from 'styled-system/css'
import { Box, Grid, HStack, Stack } from 'styled-system/jsx'
import { Card } from '@/components/ui'

const skeletonClassName = css({
	animation: 'fade-in 900ms ease-in-out infinite alternate',
	bg: 'gray.4',
	_motionReduce: { animation: 'none' },
})

export function SummaryTabSkeleton() {
	return (
		<Grid
			aria-label="Loading pull request summary"
			aria-live="polite"
			gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 14rem' }}
			gap="2"
			h="100%"
			minH="0"
			role="status"
		>
			<Card.Root h="100%" minH="0" overflow="hidden" variant="outline">
				<Card.Header flexShrink="0">
					<Card.Title>Pull request summary</Card.Title>
					<Card.Description>Loading PR description and metadata...</Card.Description>
				</Card.Header>
				<Card.Body minH="0" overflow="hidden">
					<Stack gap="4">
						<Box className={skeletonClassName} borderRadius="sm" h="5" w="32" />
						<Stack gap="2.5">
							<Box className={skeletonClassName} borderRadius="sm" h="3" w="full" />
							<Box className={skeletonClassName} borderRadius="sm" h="3" w="92%" />
							<Box className={skeletonClassName} borderRadius="sm" h="3" w="78%" />
						</Stack>
						<Stack gap="2.5" pt="2">
							<Box className={skeletonClassName} borderRadius="sm" h="3" w="96%" />
							<Box className={skeletonClassName} borderRadius="sm" h="3" w="85%" />
							<Box className={skeletonClassName} borderRadius="sm" h="3" w="64%" />
						</Stack>
					</Stack>
				</Card.Body>
			</Card.Root>
			<Card.Root alignSelf="start" overflow="hidden" variant="outline">
				<Card.Header p="3" pb="1.5">
					<Card.Title textStyle="sm">Reviewers</Card.Title>
				</Card.Header>
				<Card.Body px="3" pb="3" pt="1">
					<Stack gap="3">
						{[0, 1, 2].map((index) => (
							<HStack key={index} gap="2">
								<Box className={skeletonClassName} borderRadius="full" flexShrink="0" h="5" w="5" />
								<Stack flex="1" gap="1">
									<Box className={skeletonClassName} borderRadius="sm" h="3" w="80%" />
									<Box className={skeletonClassName} borderRadius="sm" h="2" w="55%" />
								</Stack>
							</HStack>
						))}
					</Stack>
				</Card.Body>
			</Card.Root>
		</Grid>
	)
}
