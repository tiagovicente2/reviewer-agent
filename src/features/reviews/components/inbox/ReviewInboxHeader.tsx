import { Box, HStack, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { Button } from '@/components/ui'

export function ReviewInboxHeader({
	onCollapse,
	onOpenSettings,
	onRefresh,
	reviewsState,
	username,
}: {
	onCollapse: () => void
	onOpenSettings: () => void
	onRefresh: () => void
	reviewsState: AsyncState
	username?: string
}) {
	return (
		<Stack gap="3">
			<Box as="h1" textStyle="4xl" fontWeight="bold" letterSpacing="-0.04em">
				Review inbox
			</Box>
			<Box color="fg.muted" textStyle="sm" truncate>
				Connected as @{username ?? 'unknown'}
			</Box>
			<HStack gap="3">
				<Button flex="1" size="sm" variant="outline" onClick={onOpenSettings}>
					Settings
				</Button>
				<Button
					flex="1"
					loading={reviewsState === 'loading'}
					onClick={onRefresh}
					size="sm"
					variant="plain"
				>
					Refresh
				</Button>
			</HStack>
			<Button
				aria-controls="review-inbox-content"
				aria-expanded={true}
				aria-label="Collapse review inbox"
				onClick={onCollapse}
				size="xs"
				variant="plain"
				w="full"
			>
				<Box aria-hidden="true">‹</Box>
				Collapse review inbox
			</Button>
		</Stack>
	)
}
