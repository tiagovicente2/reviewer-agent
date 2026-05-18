import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
	AgentAvailability,
	AppSettings,
	AvailablePiModel,
	CodeAgent,
	ReviewLanguage,
	SaveAppSettingsParams,
} from '@/shared/settings'
import { runCommand } from '../process'

const settingsPath = getSettingsPath()
const instructionsPath = getInstructionsPath()
const availableModelsCache = new Map<CodeAgent, AvailablePiModel[]>()

export function getAppSettings(): AppSettings {
	ensureSettingsFiles()
	const saved = readJsonSettings()
	return {
		colorMode: saved.colorMode ?? 'system',
		codeAgent: saved.codeAgent ?? 'pi',
		model: saved.model ?? getDefaultPiModel(),
		reviewLanguage: getReviewLanguage(saved.reviewLanguage),
		onboardingComplete: saved.onboardingComplete === true,
		reviewerInstructions: readFileSync(instructionsPath, 'utf8'),
		reviewerInstructionsPath: instructionsPath,
	}
}

export function saveAppSettings(params: SaveAppSettingsParams): AppSettings {
	ensureSettingsFiles()
	const saved = readJsonSettings()
	const codeAgent = getCodeAgentValue(params.codeAgent)
	writeFileSync(
		settingsPath,
		`${JSON.stringify(
			{
				colorMode: params.colorMode,
				codeAgent,
				model: params.model || 'pi-agent',
				reviewLanguage: getReviewLanguage(params.reviewLanguage),
				onboardingComplete: saved.onboardingComplete === true,
			},
			null,
			2,
		)}\n`,
	)
	writeFileSync(instructionsPath, params.reviewerInstructions)
	return getAppSettings()
}

export function completeOnboarding(): AppSettings {
	ensureSettingsFiles()
	const saved = readJsonSettings()
	writeFileSync(
		settingsPath,
		`${JSON.stringify({ ...saved, onboardingComplete: true }, null, 2)}\n`,
	)
	return getAppSettings()
}

export function getReviewCodeAgent(): CodeAgent {
	ensureSettingsFiles()
	return getCodeAgentValue(readJsonSettings().codeAgent)
}

export function getReviewerInstructions() {
	ensureSettingsFiles()
	return readFileSync(instructionsPath, 'utf8').trim()
}

export function getReviewModel() {
	ensureSettingsFiles()
	const settings = readJsonSettings()
	return settings.model || getDefaultModelForAgent(getCodeAgentValue(settings.codeAgent))
}

export async function listAgentAvailability(): Promise<AgentAvailability[]> {
	return Promise.all(
		(['pi', 'claude', 'opencode', 'codex'] as CodeAgent[]).map(async (agent) => {
			const command = agent
			const installed = await commandExists(command)
			if (!installed) {
				return {
					agent,
					label: getAgentLabel(agent),
					installed: false,
					ready: false,
					message: `${getAgentLabel(agent)} CLI was not found on PATH.`,
				}
			}

			const auth = await checkAgentReady(agent)
			return {
				agent,
				label: getAgentLabel(agent),
				installed: true,
				ready: auth.ready,
				message: auth.message,
			}
		}),
	)
}

export async function listAvailablePiModels(params?: {
	agent?: CodeAgent
}): Promise<AvailablePiModel[]> {
	const agent = getCodeAgentValue(params?.agent ?? readJsonSettings().codeAgent)
	const cached = availableModelsCache.get(agent)
	if (cached) return cached

	let models: AvailablePiModel[] = []
	if (agent === 'pi') models = await listAvailableModelsForPi()
	if (agent === 'claude') models = defaultClaudeModels()
	if (agent === 'opencode') models = await listAvailableModelsForOpencode()
	if (agent === 'codex') models = listAvailableModelsForCodex()

	availableModelsCache.set(agent, models)
	return models
}

async function listAvailableModelsForPi(): Promise<AvailablePiModel[]> {
	const saved = readJsonSettings()
	const piSettings = readPiAgentSettings()
	const searches = uniqueValues([
		'',
		saved.model,
		piSettings.defaultModel,
		piSettings.defaultProvider,
	])

	for (const search of searches) {
		const models = parseProviderModels(await listPiModelsBySearch(search))
		if (models.length > 0) return models
	}

	return defaultPiModels()
}

async function listAvailableModelsForOpencode(): Promise<AvailablePiModel[]> {
	const models = parseProviderModels(await listOpencodeModels())
	return models.length > 0 ? models : defaultOpencodeModels()
}

async function commandExists(command: string) {
	try {
		return (await runCommand('which', [command])).exitCode === 0
	} catch {
		return false
	}
}

async function checkAgentReady(agent: CodeAgent): Promise<{ ready: boolean; message: string }> {
	// Keep onboarding/settings checks lightweight. Running real model prompts here can take a
	// long time and make first boot feel frozen, especially right after settings are reset.
	if (agent === 'pi') {
		const ready = existsSync(join(getPiAgentDir(), 'auth.json'))
		return ready
			? { ready: true, message: 'Pi is installed and has local auth configuration.' }
			: { ready: false, message: 'Pi is installed. Run `pi /login` in a terminal to authenticate.' }
	}

	if (agent === 'claude') {
		const ready =
			Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_OAUTH_TOKEN) ||
			existsSync(join(getHomeDir(), '.claude', '.credentials.json'))
		return ready
			? { ready: true, message: 'Claude is installed and has local credentials.' }
			: {
					ready: false,
					message: 'Claude is installed. Run `claude /login` in a terminal to authenticate.',
				}
	}

	if (agent === 'opencode') {
		const ready =
			Boolean(process.env.OPENCODE_API_KEY) || existsSync(join(getHomeDir(), '.config', 'opencode'))
		return ready
			? { ready: true, message: 'opencode is installed and has local configuration.' }
			: {
					ready: false,
					message:
						'opencode is installed. Run `opencode providers` in a terminal to configure credentials.',
				}
	}

	const ready =
		Boolean(process.env.OPENAI_API_KEY) || existsSync(join(getHomeDir(), '.codex', 'auth.json'))
	return ready
		? { ready: true, message: 'Codex is installed and has local credentials.' }
		: {
				ready: false,
				message: 'Codex is installed. Run `codex login` in a terminal to authenticate.',
			}
}

async function listPiModelsBySearch(search: string) {
	const args = search ? ['--list-models', search] : ['--list-models']
	const { stdout, stderr, exitCode } = await runCommand('pi', args, {
		env: { ...process.env, PI_SKIP_VERSION_CHECK: '1' },
		timeoutMs: 8000,
	})
	return exitCode === 0 ? `${stdout}\n${stderr}` : ''
}

export function getReviewLanguage(value?: unknown): ReviewLanguage {
	if (value !== undefined) {
		return getReviewLanguageValue(value)
	}
	ensureSettingsFiles()
	return getReviewLanguageValue(readJsonSettings().reviewLanguage)
}

function ensureSettingsFiles() {
	mkdirSync(dirname(settingsPath), { recursive: true })
	if (!existsSync(settingsPath)) {
		writeFileSync(
			settingsPath,
			`${JSON.stringify(
				{
					colorMode: 'system',
					codeAgent: 'pi',
					model: 'pi-agent',
					reviewLanguage: 'english',
					onboardingComplete: false,
				},
				null,
				2,
			)}\n`,
		)
	}
	if (!existsSync(instructionsPath)) {
		writeFileSync(instructionsPath, '')
	}
}

async function listOpencodeModels() {
	const { stdout, stderr, exitCode } = await runCommand('opencode', ['models'], {
		env: { ...process.env },
		timeoutMs: 8000,
	})
	return exitCode === 0 ? `${stdout}\n${stderr}` : ''
}

function parseProviderModels(output: string): AvailablePiModel[] {
	return output
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.filter((line) => !line.startsWith('provider '))
		.filter((line) => !line.startsWith('No models matching'))
		.map((line) => line.split(/\s+/))
		.map((columns) => {
			if (columns.length >= 2) return { provider: columns[0] ?? '', model: columns[1] ?? '' }
			const [provider, ...modelParts] = (columns[0] ?? '').split('/')
			return { provider: provider ?? '', model: modelParts.join('/') }
		})
		.filter(({ provider, model }) => provider && model)
		.map(({ provider, model }) => ({
			id: `${provider}/${model}`,
			label: `${provider}/${model}`,
			provider,
			model,
		}))
}

function defaultPiModels(): AvailablePiModel[] {
	return [{ id: 'pi-agent', label: 'pi-agent', provider: 'pi', model: 'agent' }]
}

function defaultClaudeModels(): AvailablePiModel[] {
	return ['sonnet', 'opus', 'haiku'].map((model) => ({
		id: model,
		label: model,
		provider: 'claude',
		model,
	}))
}

function defaultOpencodeModels(): AvailablePiModel[] {
	return [
		{ id: 'opencode/default', label: 'opencode/default', provider: 'opencode', model: 'default' },
	]
}

function listAvailableModelsForCodex(): AvailablePiModel[] {
	const models = readCodexModelsCache()
	return models.length > 0 ? models : defaultCodexModels()
}

function defaultCodexModels(): AvailablePiModel[] {
	return ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.2'].map((model) => ({
		id: model,
		label: model,
		provider: 'codex',
		model,
	}))
}

function readCodexModelsCache(): AvailablePiModel[] {
	try {
		const cache = JSON.parse(
			readFileSync(join(getHomeDir(), '.codex', 'models_cache.json'), 'utf8'),
		) as {
			models?: Array<{
				display_name?: unknown
				slug?: unknown
				supported_in_api?: unknown
				visibility?: unknown
			}>
		}
		return (cache.models ?? [])
			.filter((model) => model.visibility === 'list')
			.filter((model) => model.supported_in_api !== false)
			.map((model) => {
				const slug = typeof model.slug === 'string' ? model.slug : ''
				return {
					id: slug,
					label: typeof model.display_name === 'string' ? model.display_name : slug,
					provider: 'codex',
					model: slug,
				}
			})
			.filter((model) => model.id && model.label)
	} catch {
		return []
	}
}

function getDefaultModelForAgent(agent: CodeAgent) {
	if (agent === 'claude') return defaultClaudeModels()[0]?.id ?? 'sonnet'
	if (agent === 'opencode') return defaultOpencodeModels()[0]?.id ?? 'opencode/default'
	if (agent === 'codex') return defaultCodexModels()[0]?.id ?? 'gpt-5.3-codex'
	return getDefaultPiModel()
}

function getDefaultPiModel() {
	const piSettings = readPiAgentSettings()
	return piSettings.defaultProvider && piSettings.defaultModel
		? `${piSettings.defaultProvider}/${piSettings.defaultModel}`
		: 'pi-agent'
}

function readPiAgentSettings(): { defaultProvider?: string; defaultModel?: string } {
	try {
		const settings = JSON.parse(readFileSync(join(getPiAgentDir(), 'settings.json'), 'utf8')) as {
			defaultProvider?: unknown
			defaultModel?: unknown
		}
		return {
			defaultProvider:
				typeof settings.defaultProvider === 'string' ? settings.defaultProvider : undefined,
			defaultModel: typeof settings.defaultModel === 'string' ? settings.defaultModel : undefined,
		}
	} catch {
		return {}
	}
}

function uniqueValues(values: Array<string | undefined>) {
	return [
		...new Set(
			values.filter((value): value is string => value !== undefined && value !== 'pi-agent'),
		),
	]
}

function getReviewLanguageValue(value: unknown): ReviewLanguage {
	return value === 'portuguese' ? 'portuguese' : 'english'
}

function getCodeAgentValue(value: unknown): CodeAgent {
	return value === 'claude' || value === 'opencode' || value === 'codex' ? value : 'pi'
}

function getAgentLabel(agent: CodeAgent) {
	if (agent === 'claude') return 'Claude'
	if (agent === 'opencode') return 'opencode'
	if (agent === 'codex') return 'Codex'
	return 'Pi'
}

function readJsonSettings() {
	try {
		return JSON.parse(readFileSync(settingsPath, 'utf8')) as Partial<AppSettings>
	} catch {
		return {}
	}
}

function getSettingsPath() {
	return join(getConfigDir(), 'settings.json')
}

function getInstructionsPath() {
	return join(getConfigDir(), 'reviewer-instructions.md')
}

function getConfigDir() {
	const baseDir =
		process.env.XDG_CONFIG_HOME ??
		(process.env.HOME ? join(process.env.HOME, '.config') : join(process.cwd(), '.config'))
	return join(baseDir, 'pr-review-agent')
}

function getPiAgentDir() {
	return process.env.PI_CODING_AGENT_DIR ?? (getHomeDir() ? join(getHomeDir(), '.pi', 'agent') : '')
}

function getHomeDir() {
	return process.env.HOME ?? ''
}
