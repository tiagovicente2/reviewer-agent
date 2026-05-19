import { useCallback, useEffect, useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import { Button } from '@/components/ui'
import type { UpdateStatus } from '@/shared/update'

export function UpdateStatusCard() {
	const [status, setStatus] = useState<UpdateStatus | null>(null)
	const [state, setState] = useState<AsyncState>('loading')
	const [installing, setInstalling] = useState(false)
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
		setInstalling(true)
		try {
			const result = await appRpc.request.installUpdate()
			showToast({
				title: result.ok ? 'Installing update' : 'Update failed',
				description: result.message,
				tone: result.ok ? 'info' : 'error',
			})
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
		<Stack bg="gray.2" borderRadius="l2" gap="3" p="4">
			<HStack alignItems="flex-start" justify="space-between" gap="3">
				<Box>
					<Box fontWeight="semibold">{title}</Box>
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
			<HStack gap="2">
				<Button variant="outline" loading={state === 'loading'} onClick={() => void refresh()}>
					Check again
				</Button>
				{status?.available ? (
					<Button loading={installing} onClick={update}>
						Install update
					</Button>
				) : null}
			</HStack>
		</Stack>
	)
}
