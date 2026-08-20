import { useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import { Button, Spinner } from '@/components/ui'
import { UpdateModal } from '@/features/settings/components/UpdateModal'
import type { UpdateStatus } from '@/shared/update'

export function UpdateHint({ status }: { status: UpdateStatus | null }) {
	const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
	const [restarting, setRestarting] = useState(false)

	if (
		!status?.available &&
		status?.stage !== 'downloading' &&
		status?.stage !== 'installing' &&
		status?.stage !== 'ready'
	) {
		return null
	}

	const isDownloading = status?.stage === 'downloading'
	const isInstalling = status?.stage === 'installing'
	const isReady = status?.stage === 'ready'

	const handleRestart = async (event: React.MouseEvent) => {
		event.stopPropagation()
		setRestarting(true)
		try {
			await appRpc.request.restartApp()
		} catch {
			setRestarting(false)
		}
	}

	const label = isReady
		? `Update ${status.latestVersion ?? ''} is installed. Restart to apply.`
		: isDownloading
			? `Downloading update ${status.latestVersion ?? ''} (${status.progress ?? 0}%)…`
			: isInstalling
				? `Installing update ${status.latestVersion ?? ''} in background…`
				: `Update ${status.latestVersion ?? ''} is available.`

	return (
		<>
			<Box
				role="button"
				tabIndex={0}
				bg={isReady ? 'green.3' : 'cyan.3'}
				borderColor={isReady ? 'green.6' : 'cyan.6'}
				borderRadius="l2"
				borderWidth="1px"
				cursor="pointer"
				onClick={() => setIsUpdateModalOpen(true)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') setIsUpdateModalOpen(true)
				}}
				p="3"
				textAlign="left"
				w="100%"
				_hover={{ bg: isReady ? 'green.4' : 'cyan.4' }}
			>
				<Stack gap="2">
					<HStack justify="space-between" gap="3" w="100%">
						<HStack gap="2" minW="0" flex="1">
							{isDownloading || isInstalling ? <Spinner size="xs" color="cyan.11" /> : null}
							<Box
								color={isReady ? 'green.11' : 'cyan.11'}
								flex="1"
								textStyle="sm"
								fontWeight="medium"
							>
								{label}
							</Box>
						</HStack>
						{isReady ? (
							<Button loading={restarting} onClick={handleRestart} size="sm">
								Restart now
							</Button>
						) : isDownloading || isInstalling ? (
							<Button size="sm" variant="outline">
								Progress
							</Button>
						) : (
							<Button size="sm" variant="outline">
								Update
							</Button>
						)}
					</HStack>
					{isDownloading ? (
						<Box
							bg="gray.4"
							borderRadius="full"
							h="1.5"
							overflow="hidden"
							position="relative"
							w="100%"
						>
							<Box
								bg="cyan.9"
								borderRadius="full"
								h="100%"
								style={{ width: `${Math.max(5, Math.min(100, status.progress ?? 0))}%` }}
								transition="width 250ms ease"
							/>
						</Box>
					) : null}
				</Stack>
			</Box>
			{isUpdateModalOpen && <UpdateModal onClose={() => setIsUpdateModalOpen(false)} />}
		</>
	)
}
