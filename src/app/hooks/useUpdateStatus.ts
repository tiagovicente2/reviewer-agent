import { useCallback, useEffect, useState } from 'react'
import { appRpc } from '@/app/rpc'
import type { UpdateResult, UpdateStatus } from '@/shared/update'
import type { AsyncState } from '../types'

export function useUpdateStatus() {
	const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
	const [updateState, setUpdateState] = useState<AsyncState>('idle')

	const refreshUpdateStatus = useCallback(async () => {
		setUpdateState('loading')
		try {
			const status = await appRpc.request.getUpdateStatus()
			setUpdateStatus(status)
			setUpdateState('idle')
			return status
		} catch {
			setUpdateState('error')
			return null
		}
	}, [])

	const install = useCallback(async (): Promise<UpdateResult> => {
		return appRpc.request.installUpdate()
	}, [])

	const restart = useCallback(async () => {
		return appRpc.request.restartApp()
	}, [])

	useEffect(() => {
		void refreshUpdateStatus()

		const handleStatusChanged = ({ status }: { status: UpdateStatus }) => {
			setUpdateStatus(status)
		}

		appRpc.addMessageListener('updateStatusChanged', handleStatusChanged)
		return () => {
			appRpc.removeMessageListener('updateStatusChanged', handleStatusChanged)
		}
	}, [refreshUpdateStatus])

	return { install, refreshUpdateStatus, restart, updateState, updateStatus }
}
