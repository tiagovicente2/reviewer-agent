import { Stack } from 'styled-system/jsx'
import { Card, InfoTooltip, Select } from '@/components/ui'
import type {
	AgentAvailability,
	AppSettings,
	AvailablePiModel,
	CodeAgent,
	ColorModePreference,
	ReviewLanguage,
} from '@/shared/settings'
import { InlineField } from './InlineField'

export function PreferencesCard({
	availableModels,
	onChange,
	selectedAgentAvailability,
	settings,
}: {
	availableModels: AvailablePiModel[]
	onChange: (settings: AppSettings) => void
	selectedAgentAvailability?: AgentAvailability
	settings: AppSettings
}) {
	return (
		<Card.Root
			display="grid"
			flexShrink="0"
			gridTemplateRows="auto minmax(0, 1fr)"
			minH="0"
			overflow="visible"
		>
			<Card.Header>
				<Card.Title>Preferences</Card.Title>
				<Card.Description>Local UI and agent selection.</Card.Description>
			</Card.Header>
			<Card.Body minH="0" overflow="visible">
				<Stack gap="3" minH="100%">
					<InlineField label="Color mode">
						<Select
							label="Color mode"
							value={settings.colorMode}
							onChange={(value) =>
								onChange({ ...settings, colorMode: value as ColorModePreference })
							}
							options={['system', 'dark', 'light']}
						/>
					</InlineField>
					<InlineField
						label="Code agent"
						labelAccessory={
							selectedAgentAvailability ? (
								<InfoTooltip message={selectedAgentAvailability.message} />
							) : null
						}
					>
						<Select
							label="Code agent"
							value={settings.codeAgent}
							onChange={(value) =>
								onChange({ ...settings, codeAgent: value as CodeAgent, model: '' })
							}
							options={['pi', 'claude', 'opencode', 'codex']}
						/>
					</InlineField>
					<InlineField label="Model">
						<Select
							label="Model"
							value={settings.model}
							onChange={(model) => onChange({ ...settings, model })}
							options={getModelOptions(settings.model, availableModels)}
							loading={availableModels.length === 0}
							disabled={availableModels.length === 0}
						/>
					</InlineField>
					<InlineField label="Review language">
						<Select
							label="Review language"
							value={settings.reviewLanguage}
							onChange={(value) =>
								onChange({ ...settings, reviewLanguage: value as ReviewLanguage })
							}
							options={['english', 'portuguese']}
						/>
					</InlineField>
				</Stack>
			</Card.Body>
		</Card.Root>
	)
}

function getModelOptions(currentModel: string, models: AvailablePiModel[]) {
	const options = models.map((model) => model.id)
	if (!currentModel) return options
	return options.includes(currentModel) ? options : [currentModel, ...options]
}
