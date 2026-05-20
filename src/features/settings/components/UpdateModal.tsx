import { useCallback, useEffect, useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import { Button } from '@/components/ui'
import type { UpdateStatus } from '@/shared/update'

export function UpdateModal({ onClose }: { onClose: () => void }) {
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

	const update = async () => {
		setConfirmingInstall(false)
		setInstalling(true)
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
		<Box
			position="fixed"
			inset="0"
			bg="black/40"
			display="flex"
			alignItems="center"
			justifyContent="center"
			zIndex="modal"
			onClick={installing ? undefined : onClose}
		>
			<Box
				bg="gray.1"
				borderRadius="l3"
				borderWidth="1px"
				borderColor="gray.4"
				boxShadow="2xl"
				maxW="24rem"
				w="100%"
				p="6"
				onClick={(e) => e.stopPropagation()}
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
								The update will install in the background. This app will restart automatically when
								it finishes.
							</Box>
							<HStack gap="2" justify="flex-end" mt="3">
								<Button variant="outline" onClick={() => setConfirmingInstall(false)}>
									Not now
								</Button>
								<Button onClick={() => void update()}>OK</Button>
							</HStack>
						</Box>
					) : null}
					<HStack justify="space-between" alignItems="flex-start">
						<Box>
							<Box fontWeight="bold" textStyle="lg">
								{title}
							</Box>
							<Box color={status?.error ? 'red.11' : 'fg.muted'} mt="1" textStyle="sm">
								{body}
							</Box>
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
						<Button variant="outline" disabled={installing} onClick={onClose}>
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
		</Box>
	)
}
