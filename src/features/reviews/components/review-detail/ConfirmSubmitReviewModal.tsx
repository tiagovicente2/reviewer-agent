import { Box, HStack, Stack } from 'styled-system/jsx'
import { Button } from '@/components/ui'

export type PendingSubmitAction = 'approve' | 'request_changes' | null

export function ConfirmSubmitReviewModal({
	action,
	findingsCount,
	onClose,
	onConfirm,
	submitting,
}: {
	action: Exclude<PendingSubmitAction, null>
	findingsCount: number
	onClose: () => void
	onConfirm: () => void
	submitting: boolean
}) {
	const isRequestChanges = action === 'request_changes'

	return (
		<Box
			alignItems="center"
			bg="black/40"
			display="flex"
			inset="0"
			justifyContent="center"
			onClick={submitting ? undefined : onClose}
			position="fixed"
			zIndex="modal"
		>
			<Box
				bg="gray.1"
				borderColor="gray.4"
				borderRadius="l3"
				borderWidth="1px"
				boxShadow="2xl"
				maxW="28rem"
				onClick={(event) => event.stopPropagation()}
				p="6"
				w="100%"
			>
				<Stack gap="4">
					<Box>
						<Box fontWeight="bold" textStyle="lg">
							{isRequestChanges ? 'Request changes?' : 'Approve pull request?'}
						</Box>
						<Box color="fg.muted" mt="1" textStyle="sm">
							{isRequestChanges
								? `This will submit a request changes review with ${findingsCount} generated inline comment${findingsCount === 1 ? '' : 's'}.`
								: 'This will approve the pull request on GitHub.'}
						</Box>
					</Box>
					<HStack gap="2" justify="flex-end">
						<Button disabled={submitting} onClick={onClose} variant="outline">
							Cancel
						</Button>
						<Button loading={submitting} onClick={onConfirm}>
							{isRequestChanges ? 'Request changes' : 'Approve'}
						</Button>
					</HStack>
				</Stack>
			</Box>
		</Box>
	)
}
