import { Dialog } from '@ark-ui/react/dialog'
import { useRef } from 'react'
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
	const cancelRef = useRef<HTMLButtonElement>(null)
	const isRequestChanges = action === 'request_changes'

	return (
		<Dialog.Root
			initialFocusEl={() => cancelRef.current}
			modal
			onOpenChange={({ open }) => {
				if (!open && !submitting) onClose()
			}}
			open
			restoreFocus
			role="alertdialog"
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
							maxW="28rem"
							p="6"
							w="100%"
						>
							<Stack gap="4">
								<Box>
									<Dialog.Title asChild>
										<Box fontWeight="bold" textStyle="lg">
											{isRequestChanges ? 'Request changes?' : 'Approve pull request?'}
										</Box>
									</Dialog.Title>
									<Dialog.Description asChild>
										<Box color="fg.muted" mt="1" textStyle="sm">
											{isRequestChanges
												? `This will submit a request changes review with ${findingsCount} generated inline comment${findingsCount === 1 ? '' : 's'}.`
												: 'This will approve the pull request on GitHub.'}
										</Box>
									</Dialog.Description>
								</Box>
								<HStack gap="2" justify="flex-end">
									<Button ref={cancelRef} disabled={submitting} onClick={onClose} variant="outline">
										Cancel
									</Button>
									<Button loading={submitting} onClick={onConfirm}>
										{isRequestChanges ? 'Request changes' : 'Approve'}
									</Button>
								</HStack>
							</Stack>
						</Box>
					</Dialog.Content>
				</Box>
			</Dialog.Positioner>
		</Dialog.Root>
	)
}
