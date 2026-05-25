import { useCallback, useState } from 'react'
import { useToast } from '@/app/toast'
import type { AppErrorLog } from '@/features/errors/components/ErrorLogPage'
import { getErrorMessage } from '../utils'

export function useErrorLog(openErrorLog: () => void) {
	const [errors, setErrors] = useState<AppErrorLog[]>([])
	const { showToast } = useToast()

	const logError = useCallback(
		(title: string, error: unknown, context?: string) => {
			const message = getErrorMessage(error)
			const entry: AppErrorLog = {
				context,
				createdAt: new Date().toISOString(),
				id: crypto.randomUUID(),
				message,
				title,
			}
			setErrors((current) => [entry, ...current])
			showToast({
				description: 'Click to open the error log.',
				onClick: openErrorLog,
				title,
				tone: 'error',
			})
			return message
		},
		[openErrorLog, showToast],
	)

	return {
		clearErrors: () => setErrors([]),
		dismissError: (id: string) =>
			setErrors((current) => current.filter((error) => error.id !== id)),
		errors,
		logError,
	}
}
