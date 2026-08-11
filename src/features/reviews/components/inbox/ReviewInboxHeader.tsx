import { Box, HStack, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { Button } from '@/components/ui'
import { ChevronLeftIcon, RefreshIcon, SettingsIcon } from './InboxIcons'

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
			<HStack alignItems="flex-start" gap="3" justify="space-between">
				<Box minW="0">
					<Box as="h1" textStyle="4xl" fontWeight="bold" letterSpacing="-0.04em">
						Review inbox
					</Box>
					<Box color="fg.muted" mt="1" textStyle="sm" truncate>
						Connected as @{username ?? 'unknown'}
					</Box>
				</Box>
				<HStack flexShrink="0" gap="1">
					<HeaderIconButton ariaLabel="Settings" onClick={onOpenSettings}>
						<SettingsIcon />
					</HeaderIconButton>
					<HeaderIconButton
						ariaLabel="Refresh review inbox"
						loading={reviewsState === 'loading'}
						onClick={onRefresh}
					>
						<RefreshIcon />
					</HeaderIconButton>
					<HeaderIconButton
						ariaControls="review-inbox-content"
						ariaExpanded={true}
						ariaLabel="Collapse review inbox"
						onClick={onCollapse}
					>
						<ChevronLeftIcon />
					</HeaderIconButton>
				</HStack>
			</HStack>
		</Stack>
	)
}

function HeaderIconButton({
	ariaControls,
	ariaExpanded,
	ariaLabel,
	children,
	loading,
	onClick,
}: {
	ariaControls?: string
	ariaExpanded?: boolean
	ariaLabel: string
	children: React.ReactNode
	loading?: boolean
	onClick: () => void
}) {
	return (
		<Button
			aria-controls={ariaControls}
			aria-expanded={ariaExpanded}
			aria-label={ariaLabel}
			h="8"
			loading={loading}
			minW="8"
			onClick={onClick}
			p="0"
			size="xs"
			title={ariaLabel}
			variant="plain"
			w="8"
		>
			{children}
		</Button>
	)
}
