import { Dialog } from '@ark-ui/react/dialog'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import { Button } from '@/components/ui'
import type { UpdateStatus } from '@/shared/update'
import { ConfirmUpdateModal } from './ConfirmUpdateModal'

export function UpdateModal({ onClose }: { onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null)
	const restartRef = useRef<HTMLButtonElement>(null)
	const installRef = useRef<HTMLButtonElement>(null)
	const [status, setStatus] = useState<UpdateStatus | null>(null)
	const [state, setState] = useState<AsyncState>('loading')
	const [confirmingInstall, setConfirmingInstall] = useState(false)
	const [restarting, setRestarting] = useState(false)
	const { showToast } = useToast()

	const refresh = useCallback(async () => {
		setState('loading')
		try {
			const nextStatus = await appRpc.request.getUpdateStatus()
			setStatus(nextStatus)
			setState('idle')
		} catch (error) {
			setStatus(null)
			setState('error')
			showToast({
				title: 'Could not check for updates',
				description: getErrorMessage(error),
				tone: 'error',
			})
		}
	}, [showToast])

	useEffect(() => {
		void refresh()

		const handleStatusChanged = ({ status: nextStatus }: { status: UpdateStatus }) => {
			setStatus(nextStatus)
		}
		appRpc.addMessageListener('updateStatusChanged', handleStatusChanged)
		return () => {
			appRpc.removeMessageListener('updateStatusChanged', handleStatusChanged)
		}
	}, [refresh])

	const isDownloading = status?.stage === 'downloading'
	const isInstalling = status?.stage === 'installing'
	const isProgressing = isDownloading || isInstalling
	const isReady = status?.stage === 'ready'

	const startInstall = async () => {
		setConfirmingInstall(false)
		try {
			const result = await appRpc.request.installUpdate()
			if (!result.ok) {
				showToast({
					title: 'Update failed',
					description: result.message,
					tone: 'error',
				})
			}
		} catch (error) {
			showToast({ title: 'Update failed', description: getErrorMessage(error), tone: 'error' })
		}
	}

	const handleRestart = async () => {
		setRestarting(true)
		try {
			await appRpc.request.restartApp()
		} catch (error) {
			setRestarting(false)
			showToast({ title: 'Restart failed', description: getErrorMessage(error), tone: 'error' })
		}
	}

	const title = isReady
		? 'Update ready'
		: isProgressing
			? isDownloading
				? 'Downloading update…'
				: 'Installing update…'
			: status?.available
				? 'Update available'
				: 'App updates'

	const badgeText = isReady
		? 'ready'
		: isDownloading
			? `${status?.progress ?? 0}%`
			: isInstalling
				? 'installing'
				: status?.available
					? 'available'
					: state === 'loading'
						? 'checking'
						: 'current'

	const body = status?.error
		? status.error
		: isReady
			? `Version ${status.latestVersion} has been downloaded and is ready to apply. Restart now to use the updated version, or restart later.`
			: isProgressing
				? (status?.statusMessage ?? 'Downloading and preparing update in the background…')
				: status?.available
					? `Version ${status.latestVersion} is available. You are running ${status.currentVersion}.`
					: status
						? `You are running the latest version (${status.currentVersion}).`
						: 'Checking for updates...'

	return (
		<>
			<Dialog.Root
				initialFocusEl={() => (isReady ? restartRef.current : closeRef.current)}
				modal
				onOpenChange={({ open }) => {
					if (!open) onClose()
				}}
				open
				restoreFocus
				role="dialog"
				trapFocus
			>
				<Dialog.Backdrop asChild>
					<Box bg="black/40" inset="0" position="fixed" zIndex="modal" />
				</Dialog.Backdrop>
				<Dialog.Positioner asChild>
					<Box
						alignItems="center"
						display="flex"
						inset="0"
						justifyContent="center"
						position="fixed"
						zIndex="modal"
					>
						<Dialog.Content asChild>
							<Box
								bg="gray.1"
								borderColor="gray.4"
								borderRadius="l3"
								borderWidth="1px"
								boxShadow="2xl"
								maxW="26rem"
								p="6"
								w="100%"
							>
								<Stack gap="4">
									<HStack justify="space-between" alignItems="flex-start">
										<Box minW="0" flex="1">
											<Dialog.Title asChild>
												<Box fontWeight="bold" textStyle="lg">
													{title}
												</Box>
											</Dialog.Title>
											<Dialog.Description asChild>
												<Box color={status?.error ? 'red.11' : 'fg.muted'} mt="1" textStyle="sm">
													{body}
												</Box>
											</Dialog.Description>
										</Box>
										<Box
											bg={isReady || status?.available ? 'cyan.3' : 'gray.3'}
											borderRadius="full"
											color={isReady || status?.available ? 'cyan.11' : 'fg.muted'}
											fontWeight="medium"
											ml="3"
											px="2.5"
											py="1"
											textStyle="xs"
											whiteSpace="nowrap"
										>
											{badgeText}
										</Box>
									</HStack>

									{isProgressing ? (
										<Stack gap="1.5" mt="1">
											<Box
												bg="gray.4"
												borderRadius="full"
												h="2"
												overflow="hidden"
												position="relative"
												w="100%"
											>
												<Box
													bg="cyan.9"
													borderRadius="full"
													h="100%"
													style={{
														width: isDownloading
															? `${Math.max(5, Math.min(100, status?.progress ?? 0))}%`
															: '100%',
													}}
													transition="width 250ms ease"
												/>
											</Box>
											<Box color="fg.muted" textAlign="right" textStyle="xs">
												{isDownloading
													? `${status?.progress ?? 0}% completed`
													: 'Applying update files…'}
											</Box>
										</Stack>
									) : null}

									<HStack gap="2" justify="flex-end" mt="2">
										{isReady ? (
											<>
												<Button ref={closeRef} variant="outline" onClick={onClose}>
													Restart later
												</Button>
												<Button
													ref={restartRef}
													loading={restarting}
													onClick={() => void handleRestart()}
												>
													Restart now
												</Button>
											</>
										) : isProgressing ? (
											<Button ref={closeRef} variant="outline" onClick={onClose}>
												Close (runs in background)
											</Button>
										) : (
											<>
												<Button ref={closeRef} variant="outline" onClick={onClose}>
													Close
												</Button>
												<Button
													variant="outline"
													loading={state === 'loading'}
													onClick={() => void refresh()}
												>
													Check again
												</Button>
												{status?.available ? (
													<Button ref={installRef} onClick={() => setConfirmingInstall(true)}>
														Install update
													</Button>
												) : null}
											</>
										)}
									</HStack>
								</Stack>
							</Box>
						</Dialog.Content>
					</Box>
				</Dialog.Positioner>
			</Dialog.Root>

			{confirmingInstall ? (
				<ConfirmUpdateModal
					latestVersion={status?.latestVersion}
					onCancel={() => setConfirmingInstall(false)}
					onConfirm={() => void startInstall()}
				/>
			) : null}
		</>
	)
}
