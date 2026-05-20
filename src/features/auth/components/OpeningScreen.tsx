import { Grid, Stack } from 'styled-system/jsx'
import { StatusCard } from '@/components/common'
import { Button, Card, Spinner } from '@/components/ui'

export function OpeningScreen({
	error,
	onOpenSettings,
	onRetry,
}: {
	error?: string
	onOpenSettings: () => void
	onRetry: () => void
}) {
	return (
		<Grid h="100%" minH="0" overflowY="auto" placeItems="center" p="6">
			<Card.Root maxW="520px" w="full">
				<Card.Header alignItems="center" textAlign="center">
					<Card.Title>Opening Reviewer Agent</Card.Title>
					<Card.Description>
						Checking your setup and loading review requests before opening the inbox.
					</Card.Description>
				</Card.Header>
				<Card.Body>
					{error ? (
						<Stack gap="4">
							<StatusCard tone="red" title="Could not open app" body={error} />
							<Button onClick={onRetry}>Try again</Button>
							<Button onClick={onOpenSettings} variant="outline">
								Open settings
							</Button>
						</Stack>
					) : (
						<Stack alignItems="center" gap="4" py="6" textAlign="center">
							<Spinner size="lg" />
							<StatusCard
								title="Loading workspace"
								body="This should only take a moment. If setup is incomplete, onboarding will open next."
							/>
						</Stack>
					)}
				</Card.Body>
			</Card.Root>
		</Grid>
	)
}
