import { useCallback, useEffect, useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import { Button } from '@/components/ui'
import type { CacheStats } from '@/shared/cache'

export function CacheModal({
	onClose,
}: {
	onClose: () => void
}) {
	const [stats, setStats] = useState<CacheStats | null>(null)
	const [state, setState] = useState<AsyncState>('loading')
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

	const clearCache = async () => {
		setState('loading')
		try {
			const result = await appRpc.request.clearAppCache()
			showToast({
				title: 'Cache cleared',
				description: `Removed ${result.removedPullRequestDetails} PR details, ${result.removedPullRequestDiffs} diffs, and ${result.removedGeneratedReviews} generated reviews.`,
				tone: 'success',
			})
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
		<Box
			position="fixed"
			inset="0"
			bg="black/40"
			display="flex"
			alignItems="center"
			justifyContent="center"
			zIndex="modal"
			onClick={onClose}
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
					<Box>
						<Box fontWeight="bold" textStyle="lg">
							Local cache
						</Box>
						<Box color="fg.muted" mt="1" textStyle="sm">
							Cached PR details, diffs, and generated review drafts are pruned automatically.
						</Box>
					</Box>

					<HStack color="fg.muted" flexWrap="wrap" gap="3" textStyle="sm">
						<Box>{stats?.pullRequestDetails ?? 0} PR details</Box>
						<Box>{stats?.pullRequestDiffs ?? 0} diffs</Box>
						<Box>{stats?.generatedReviews ?? 0} reviews</Box>
					</HStack>

					<HStack gap="2" justify="flex-end" mt="2">
						<Button variant="outline" onClick={onClose}>
							Close
						</Button>
						<Button variant="outline" loading={state === 'loading'} onClick={() => void refresh()}>
							Refresh
						</Button>
						<Button variant="outline" loading={state === 'loading'} onClick={() => void clearCache()}>
							Clear cache
						</Button>
					</HStack>
				</Stack>
			</Box>
		</Box>
	)
}
