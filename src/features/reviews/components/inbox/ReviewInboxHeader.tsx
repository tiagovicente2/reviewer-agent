import { Box, HStack, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { Button, Spinner } from '@/components/ui'
import type { UpdateStatus } from '@/shared/update'
import { ChevronLeftIcon, RefreshIcon, RestartIcon, SettingsIcon } from './InboxIcons'

export function ReviewInboxHeader({
	onCollapse,
	onOpenSettings,
	onOpenUpdateModal,
	onRefresh,
	reviewsState,
	updateStatus,
	username,
}: {
	onCollapse: () => void
	onOpenSettings: () => void
	onOpenUpdateModal?: () => void
	onRefresh: () => void
	reviewsState: AsyncState
	updateStatus?: UpdateStatus | null
	username?: string
}) {
	const isDownloading = updateStatus?.stage === 'downloading'
	const isInstalling = updateStatus?.stage === 'installing'
	const isReady = updateStatus?.stage === 'ready'

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
					{isDownloading || isInstalling ? (
						<HeaderIconButton
							ariaLabel={`Installing update${updateStatus?.progress !== undefined ? ` (${updateStatus.progress}%)` : ''}`}
							onClick={onOpenUpdateModal}
						>
							<Spinner size="xs" color="cyan.11" />
						</HeaderIconButton>
					) : isReady ? (
						<HeaderIconButton
							ariaLabel="Update ready. Restart application"
							onClick={onOpenUpdateModal}
						>
							<Box color="cyan.11">
								<RestartIcon />
							</Box>
						</HeaderIconButton>
					) : null}
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
	onClick?: () => void
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
