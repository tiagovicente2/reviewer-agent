export type ColorModePreference = 'dark' | 'light' | 'system'
export type CodeAgent = 'pi' | 'claude' | 'opencode' | 'codex'
export type ReviewLanguage = 'english' | 'portuguese'

export type AgentAvailability = {
	agent: CodeAgent
	label: string
	installed: boolean
	ready: boolean
	message: string
}

export type AvailablePiModel = {
	id: string
	label: string
	provider: string
	model: string
}

export type AppSettings = {
	colorMode: ColorModePreference
	codeAgent: CodeAgent
	model: string
	reviewLanguage: ReviewLanguage
	reviewExportDirectory: string
	reviewerInstructions: string
	reviewerInstructionsPath: string
	onboardingComplete: boolean
}

export type SaveAppSettingsParams = {
	colorMode: ColorModePreference
	codeAgent: CodeAgent
	model: string
	reviewLanguage: ReviewLanguage
	reviewExportDirectory: string
	reviewerInstructions: string
}
