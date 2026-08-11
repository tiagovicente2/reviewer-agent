import { Dialog } from '@ark-ui/react/dialog'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import { Button } from '@/components/ui'
import type { UpdateStatus } from '@/shared/update'

export function UpdateModal({ onClose }: { onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const installRef = useRef<HTMLButtonElement>(null)
	const notNowRef = useRef<HTMLButtonElement>(null)
	const [status, setStatus] = useState<UpdateStatus | null>(null)
	const [state, setState] = useState<AsyncState>('loading')
	const [installing, setInstalling] = useState(false)
	const [confirmingInstall, setConfirmingInstall] = useState(false)
	const { showToast } = useToast()

	const refresh = useCallback(async () => {
		setState('loading')
		try {
			setStatus(await appRpc.request.getUpdateStatus())
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
	}, [refresh])

	useEffect(() => {
		if (confirmingInstall) notNowRef.current?.focus()
	}, [confirmingInstall])

	const cancelInstall = () => {
		setConfirmingInstall(false)
		requestAnimationFrame(() => installRef.current?.focus())
	}

	const update = async () => {
		setConfirmingInstall(false)
		setInstalling(true)
		requestAnimationFrame(() => contentRef.current?.focus())
		try {
			const result = await appRpc.request.installUpdate()
			showToast({
				title: result.ok ? 'Update installed' : 'Update failed',
				description: result.message,
				tone: result.ok ? 'success' : 'error',
			})
			if (!result.ok) setInstalling(false)
		} catch (error) {
			showToast({ title: 'Update failed', description: getErrorMessage(error), tone: 'error' })
			setInstalling(false)
		}
	}

	const title = status?.available ? 'Update available' : 'App updates'
	const body = status?.error
		? status.error
		: status?.available
			? `Version ${status.latestVersion} is available. You are running ${status.currentVersion}.`
			: status
				? `You are running the latest version (${status.currentVersion}).`
				: 'Checking for updates...'

	return (
		<Dialog.Root
			initialFocusEl={() => closeRef.current}
			modal
			onOpenChange={({ open }) => {
				if (!open && !installing) onClose()
			}}
			open
			restoreFocus
			role="dialog"
			trapFocus
		>
			<Dialog.Backdrop asChild>
				<Box bg="black/40" inset="0" position="fixed" />
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
							ref={contentRef}
							bg="gray.1"
							borderColor="gray.4"
							borderRadius="l3"
							borderWidth="1px"
							boxShadow="2xl"
							maxW="24rem"
							p="6"
							w="100%"
						>
							<Stack gap="4">
								{installing ? (
									<Box
										bg="cyan.2"
										borderColor="cyan.6"
										borderRadius="l2"
										borderWidth="1px"
										color="cyan.11"
										p="3"
										textStyle="sm"
									>
										Installing update in the background. The app will restart automatically when the
										update finishes.
									</Box>
								) : null}
								{confirmingInstall ? (
									<Box bg="gray.2" borderColor="gray.6" borderRadius="l2" borderWidth="1px" p="3">
										<Box color="fg.default" fontWeight="medium" textStyle="sm">
											Install update now?
										</Box>
										<Box color="fg.muted" mt="1" textStyle="sm">
											The update will install in the background. This app will restart automatically
											when it finishes.
										</Box>
										<HStack gap="2" justify="flex-end" mt="3">
											<Button ref={notNowRef} variant="outline" onClick={cancelInstall}>
												Not now
											</Button>
											<Button onClick={() => void update()}>OK</Button>
										</HStack>
									</Box>
								) : null}
								<HStack justify="space-between" alignItems="flex-start">
									<Box>
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
										bg={status?.available ? 'cyan.3' : 'gray.3'}
										borderRadius="full"
										color={status?.available ? 'cyan.11' : 'fg.muted'}
										fontWeight="medium"
										px="2.5"
										py="1"
										textStyle="xs"
										whiteSpace="nowrap"
									>
										{status?.available ? 'available' : state === 'loading' ? 'checking' : 'current'}
									</Box>
								</HStack>

								<HStack gap="2" justify="flex-end" mt="2">
									<Button ref={closeRef} variant="outline" disabled={installing} onClick={onClose}>
										Close
									</Button>
									<Button
										variant="outline"
										disabled={installing}
										loading={state === 'loading'}
										onClick={() => void refresh()}
									>
										Check again
									</Button>
									{status?.available ? (
										<Button
											ref={installRef}
											disabled={confirmingInstall}
											loading={installing}
											onClick={() => setConfirmingInstall(true)}
										>
											{installing ? 'Installing…' : 'Install update'}
										</Button>
									) : null}
								</HStack>
							</Stack>
						</Box>
					</Dialog.Content>
				</Box>
			</Dialog.Positioner>
		</Dialog.Root>
	)
}
