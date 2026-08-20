import { Dialog } from '@ark-ui/react/dialog'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import { Button } from '@/components/ui'
import type { CacheStats } from '@/shared/cache'

export function CacheModal({ onClose }: { onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null)
	const clearCacheRef = useRef<HTMLButtonElement>(null)
	const keepCacheRef = useRef<HTMLButtonElement>(null)
	const [stats, setStats] = useState<CacheStats | null>(null)
	const [state, setState] = useState<AsyncState>('loading')
	const [confirmingClear, setConfirmingClear] = useState(false)
	const { showToast } = useToast()

	const refresh = useCallback(async () => {
		setState('loading')
		try {
			setStats(await appRpc.request.getCacheStats())
			setState('idle')
		} catch (error) {
			setState('error')
			showToast({
				title: 'Could not load cache status',
				description: getErrorMessage(error),
				tone: 'error',
			})
		}
	}, [showToast])

	useEffect(() => {
		void refresh()
	}, [refresh])

	useEffect(() => {
		if (confirmingClear) keepCacheRef.current?.focus()
	}, [confirmingClear])

	const cancelClear = () => {
		setConfirmingClear(false)
		requestAnimationFrame(() => clearCacheRef.current?.focus())
	}

	const clearCache = async () => {
		setState('loading')
		try {
			const result = await appRpc.request.clearAppCache()
			showToast({
				title: 'Cache cleared',
				description: `Removed ${result.removedPullRequestDetails} PR details, ${result.removedPullRequestDiffs} diffs, and ${result.removedGeneratedReviews} generated reviews.`,
				tone: 'success',
			})
			setConfirmingClear(false)
			requestAnimationFrame(() => closeRef.current?.focus())
			await refresh()
		} catch (error) {
			setState('error')
			showToast({
				title: 'Could not clear cache',
				description: getErrorMessage(error),
				tone: 'error',
			})
		}
	}

	return (
		<Dialog.Root
			initialFocusEl={() => closeRef.current}
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
								<Box>
									<Dialog.Title asChild>
										<Box fontWeight="bold" textStyle="lg">
											Local cache
										</Box>
									</Dialog.Title>
									<Dialog.Description asChild>
										<Box color="fg.muted" mt="1" textStyle="sm">
											Cached PR details, diffs, and generated review drafts are pruned
											automatically.
										</Box>
									</Dialog.Description>
								</Box>

								<HStack color="fg.muted" flexWrap="wrap" gap="3" textStyle="sm">
									<Box>{stats?.pullRequestDetails ?? 0} PR details</Box>
									<Box>{stats?.pullRequestDiffs ?? 0} diffs</Box>
									<Box>{stats?.generatedReviews ?? 0} reviews</Box>
								</HStack>

								{confirmingClear ? (
									<Stack
										bg="red.subtle.bg"
										borderColor="red.7"
										borderRadius="l2"
										borderWidth="1px"
										gap="3"
										p="4"
									>
										<Box>
											<Box color="red.11" fontWeight="semibold">
												Delete cached review drafts?
											</Box>
											<Box color="red.11" mt="1" textStyle="sm">
												This permanently deletes {stats?.generatedReviews ?? 0} generated review
												drafts. PR details and diffs can be downloaded again, but drafts cannot be
												recovered.
											</Box>
										</Box>
										<HStack flexWrap="wrap" gap="2" justify="flex-end">
											<Button
												ref={keepCacheRef}
												disabled={state === 'loading'}
												onClick={cancelClear}
												variant="outline"
											>
												Keep cache
											</Button>
											<Button
												colorPalette="red"
												loading={state === 'loading'}
												onClick={() => void clearCache()}
											>
												Delete drafts and clear cache
											</Button>
										</HStack>
									</Stack>
								) : (
									<HStack flexWrap="wrap" gap="2" justify="flex-end" mt="2">
										<Button ref={closeRef} variant="outline" onClick={onClose}>
											Close
										</Button>
										<Button
											disabled={state === 'loading'}
											onClick={() => void refresh()}
											variant="plain"
										>
											Refresh
										</Button>
										<Button
											ref={clearCacheRef}
											colorPalette="red"
											disabled={state === 'loading' || !stats}
											onClick={() => setConfirmingClear(true)}
											variant="outline"
										>
											Clear cache
										</Button>
									</HStack>
								)}
							</Stack>
						</Box>
					</Dialog.Content>
				</Box>
			</Dialog.Positioner>
		</Dialog.Root>
	)
}
