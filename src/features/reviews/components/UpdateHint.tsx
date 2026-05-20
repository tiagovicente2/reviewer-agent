import { useState } from 'react'
import { Box, HStack } from 'styled-system/jsx'
import { Button } from '@/components/ui'
import { UpdateModal } from '@/features/settings/components/UpdateModal'
import type { UpdateStatus } from '@/shared/update'

export function UpdateHint({ status }: { status: UpdateStatus | null }) {
	const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)

	if (!status?.available) return null

	return (
		<>
			<HStack
				role="button"
				tabIndex={0}
				bg="cyan.3"
				borderColor="cyan.6"
				borderRadius="l2"
				borderWidth="1px"
				cursor="pointer"
				gap="3"
				onClick={() => setIsUpdateModalOpen(true)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') setIsUpdateModalOpen(true)
				}}
				p="3"
				textAlign="left"
				w="100%"
				_hover={{ bg: 'cyan.4' }}
			>
				<Box color="cyan.11" flex="1" textStyle="sm">
					Update {status.latestVersion} is available.
				</Box>
				<Button size="sm" variant="outline">
					Update
				</Button>
			</HStack>
			{isUpdateModalOpen && <UpdateModal onClose={() => setIsUpdateModalOpen(false)} />}
		</>
	)
}
