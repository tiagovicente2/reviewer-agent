import { Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import { Button, Card, Input } from '@/components/ui'
import type { AppSettings } from '@/shared/settings'
import { InlineField } from './InlineField'

export function ReviewExportCard({
	onChange,
	settings,
}: {
	onChange: (settings: AppSettings) => void
	settings: AppSettings
}) {
	const selectFolder = async () => {
		const result = await appRpc.request.selectReviewExportDirectory({
			currentDirectory: settings.reviewExportDirectory,
		})
		if (result.directory) onChange({ ...settings, reviewExportDirectory: result.directory })
	}

	return (
		<Card.Root minH="0" overflow="visible">
			<Card.Header>
				<Card.Title>Review export</Card.Title>
				<Card.Description>Default folder for saved review files.</Card.Description>
			</Card.Header>
			<Card.Body minH="0" overflow="visible">
				<Stack gap="3">
					<InlineField label="Folder">
						<Stack direction="row" gap="2" maxW="30rem" w="100%">
							<Input
								value={settings.reviewExportDirectory}
								onChange={(event) =>
									onChange({ ...settings, reviewExportDirectory: event.currentTarget.value })
								}
								placeholder="/home/user/reviewer-agent-exports"
							/>
							<Button onClick={() => void selectFolder()} type="button" variant="outline">
								Choose
							</Button>
						</Stack>
					</InlineField>
				</Stack>
			</Card.Body>
		</Card.Root>
	)
}
