import { Dialog } from '@ark-ui/react/dialog'
import { useRef } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { Button } from '@/components/ui'

export function ConfirmUpdateModal({
	latestVersion,
	onCancel,
	onConfirm,
}: {
	latestVersion?: string
	onCancel: () => void
	onConfirm: () => void
}) {
	const cancelRef = useRef<HTMLButtonElement>(null)

	return (
		<Dialog.Root
			initialFocusEl={() => cancelRef.current}
			modal
			onOpenChange={({ open }) => {
				if (!open) onCancel()
			}}
			open
			restoreFocus
			role="alertdialog"
			trapFocus
		>
			<Dialog.Backdrop asChild>
				<Box bg="black/50" inset="0" position="fixed" zIndex="modal" />
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
							maxW="26rem"
							p="6"
							w="100%"
						>
							<Stack gap="4">
								<Box>
									<Dialog.Title asChild>
										<Box fontWeight="bold" textStyle="lg">
											Install update now?
										</Box>
									</Dialog.Title>
									<Dialog.Description asChild>
										<Box color="fg.muted" mt="1" textStyle="sm">
											{latestVersion
												? `Version ${latestVersion} will be downloaded and installed in the background. You can restart the app when it finishes.`
												: 'The update will be downloaded and installed in the background. You can restart the app when it finishes.'}
										</Box>
									</Dialog.Description>
								</Box>
								<HStack gap="2" justify="flex-end" mt="2">
									<Button ref={cancelRef} variant="outline" onClick={onCancel}>
										Not now
									</Button>
									<Button onClick={onConfirm}>OK</Button>
								</HStack>
							</Stack>
						</Box>
					</Dialog.Content>
				</Box>
			</Dialog.Positioner>
		</Dialog.Root>
	)
}
