import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { Box, Stack } from 'styled-system/jsx'

type ToastTone = 'success' | 'error' | 'info'

type Toast = {
	id: string
	title: string
	description?: string
	tone: ToastTone
	onClick?: () => void
}

type ToastContextValue = {
	showToast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toastToneClassNames: Record<ToastTone, string> = {
	success: css({ bg: 'review.blue', borderColor: 'review.blue', color: 'white' }),
	error: css({ bg: 'red.9', borderColor: 'red.9', color: 'white' }),
	info: css({ bg: 'black', borderColor: 'black', color: 'white' }),
}

const toastDescriptionClassNames: Record<ToastTone, string> = {
	success: css({ color: 'white' }),
	error: css({ color: 'white' }),
	info: css({ color: 'white' }),
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([])

	const removeToast = useCallback((id: string) => {
		setToasts((current) => current.filter((toast) => toast.id !== id))
	}, [])

	const showToast = useCallback(
		(toast: Omit<Toast, 'id'>) => {
			const id = crypto.randomUUID()
			setToasts((current) => [...current, { ...toast, id }])
			window.setTimeout(() => removeToast(id), 4000)
		},
		[removeToast],
	)

	const value = useMemo(() => ({ showToast }), [showToast])

	return (
		<ToastContext.Provider value={value}>
			{children}
			<Stack
				bottom="5"
				gap="3"
				position="fixed"
				right="5"
				w="min(24rem, calc(100vw - 2.5rem))"
				zIndex="toast"
			>
				{toasts.map((toast) => (
					<Box
						className={toastToneClassNames[toast.tone]}
						borderLeftWidth="4px"
						borderRadius="l2"
						boxShadow="xl"
						cursor={toast.onClick ? 'pointer' : 'default'}
						key={toast.id}
						onClick={toast.onClick}
						p="4"
						role={toast.onClick ? 'button' : 'status'}
						tabIndex={toast.onClick ? 0 : undefined}
					>
						<Box alignItems="flex-start" display="flex" gap="3" justifyContent="space-between">
							<Box minW="0">
								<Box fontWeight="semibold">{toast.title}</Box>
								{toast.description ? (
									<Box className={toastDescriptionClassNames[toast.tone]} mt="1" textStyle="sm">
										{toast.description}
									</Box>
								) : null}
							</Box>
							<Box
								as="button"
								aria-label="Dismiss notification"
								onClick={(event) => {
									event.stopPropagation()
									removeToast(toast.id)
								}}
								className={cx(toastDescriptionClassNames[toast.tone], css({ fontWeight: 'bold' }))}
							>
								×
							</Box>
						</Box>
					</Box>
				))}
			</Stack>
		</ToastContext.Provider>
	)
}

export function useToast() {
	const context = useContext(ToastContext)
	if (!context) {
		throw new Error('useToast must be used inside ToastProvider')
	}
	return context
}
