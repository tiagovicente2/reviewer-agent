import { useCallback, useEffect, useState } from 'react'
import { appRpc } from '@/app/rpc'
import type { UpdateStatus } from '@/shared/update'
import type { AsyncState } from '../types'

export function useUpdateStatus() {
	const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
	const [updateState, setUpdateState] = useState<AsyncState>('idle')

	const refreshUpdateStatus = useCallback(async () => {
		setUpdateState('loading')
		try {
			setUpdateStatus(await appRpc.request.getUpdateStatus())
			setUpdateState('idle')
		} catch {
			setUpdateState('error')
		}
	}, [])

	useEffect(() => {
		void refreshUpdateStatus()
	}, [refreshUpdateStatus])

	return { refreshUpdateStatus, updateState, updateStatus }
}
