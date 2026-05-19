import { Box, HStack } from 'styled-system/jsx'
import { Button } from '@/components/ui'
import type { UpdateStatus } from '@/shared/update'

export function UpdateHint({
	onOpenSettings,
	status,
}: {
	onOpenSettings: () => void
	status: UpdateStatus | null
}) {
	if (!status?.available) return null

	return (
		<HStack bg="cyan.3" borderColor="cyan.6" borderRadius="l2" borderWidth="1px" gap="3" p="3">
			<Box color="cyan.11" flex="1" textStyle="sm">
				Update {status.latestVersion} is available.
			</Box>
			<Button size="sm" variant="outline" onClick={onOpenSettings}>
				Update
			</Button>
		</HStack>
	)
}
