import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
	AgentAvailability,
	AppSettings,
	AvailablePiModel,
	CodeAgent,
	ReviewerInstruction,
	ReviewLanguage,
	SaveAppSettingsParams,
} from '@/shared/settings'
import { getHomePath, getLegacyConfigDir } from '../paths'
import { runCommand } from '../process'

const settingsPath = getSettingsPath()
const instructionsPath = getInstructionsPath()
const AVAILABLE_MODELS_CACHE_TTL_MS = 10 * 60 * 1000
const availableModelsCache = new Map<CodeAgent, { models: AvailablePiModel[]; fetchedAt: number }>()

export function getAppSettings(): AppSettings {
	ensureSettingsFiles()
	const saved = readJsonSettings()
	return {
		colorMode: saved.colorMode ?? 'system',
		codeAgent: saved.codeAgent ?? 'pi',
		model: saved.model ?? getDefaultPiModel(),
		reviewLanguage: getReviewLanguage(saved.reviewLanguage),
		reviewExportDirectory:
			typeof saved.reviewExportDirectory === 'string'
				? saved.reviewExportDirectory
				: getDefaultReviewExportDirectory(),
		onboardingComplete: saved.onboardingComplete === true,
		reviewerInstructions: readReviewerInstructions(),
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
				reviewExportDirectory: params.reviewExportDirectory.trim(),
				onboardingComplete: saved.onboardingComplete === true,
			},
			null,
			2,
		)}\n`,
	)
	writeReviewerInstructions(params.reviewerInstructions)
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

export function getReviewerInstructions(instructionId?: string) {
	ensureSettingsFiles()
	const instructions = readReviewerInstructions()
	const selected = instructionId
		? instructions.find((instruction) => instruction.id === instructionId)
		: instructions[0]
	return (selected ?? instructions[0])?.content.trim() ?? ''
}

function readReviewerInstructions(): ReviewerInstruction[] {
	try {
		const parsed = JSON.parse(readFileSync(instructionsPath, 'utf8')) as unknown
		if (!Array.isArray(parsed)) return [defaultReviewerInstruction()]
		const instructions = parsed
			.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
			.map((item) => ({
				id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
				name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Untitled',
				content: typeof item.content === 'string' ? item.content : '',
			}))
		return instructions.length > 0 ? instructions : [defaultReviewerInstruction()]
	} catch {
		return [defaultReviewerInstruction()]
	}
}

function writeReviewerInstructions(instructions: ReviewerInstruction[]) {
	const sanitized = instructions.map((instruction) => ({
		id: instruction.id || randomUUID(),
		name: instruction.name.trim() || 'Untitled',
		content: instruction.content,
	}))
	writeFileSync(
		instructionsPath,
		`${JSON.stringify(sanitized.length > 0 ? sanitized : [defaultReviewerInstruction()], null, 2)}\n`,
	)
}

function defaultReviewerInstruction(content = ''): ReviewerInstruction {
	return { id: randomUUID(), name: 'Default', content }
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
	if (cached && Date.now() - cached.fetchedAt < AVAILABLE_MODELS_CACHE_TTL_MS) {
		return cached.models
	}

	let models: AvailablePiModel[] = []
	if (agent === 'pi') models = await listAvailableModelsForPi()
	if (agent === 'claude') models = await listAvailableModelsForClaude()
	if (agent === 'opencode') models = await listAvailableModelsForOpencode()
	if (agent === 'codex') models = listAvailableModelsForCodex()

	availableModelsCache.set(agent, { models, fetchedAt: Date.now() })
	return models
}

async function listAvailableModelsForClaude(): Promise<AvailablePiModel[]> {
	const apiModels = await listAnthropicApiModels()
	// Aliases first — they always work with the CLI and track the latest release.
	// Full model IDs from the Models API follow, for pinning a specific model.
	return [...defaultClaudeModels(), ...apiModels]
}

async function listAnthropicApiModels(): Promise<AvailablePiModel[]> {
	const apiKey = process.env.ANTHROPIC_API_KEY
	if (!apiKey) return []
	try {
		const response = await fetch('https://api.anthropic.com/v1/models?limit=100', {
			headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
			signal: AbortSignal.timeout(8000),
		})
		if (!response.ok) return []
		const payload = (await response.json()) as {
			data?: Array<{ id?: unknown; display_name?: unknown }>
		}
		return (payload.data ?? []).flatMap((model) => {
			const id = typeof model.id === 'string' ? model.id : ''
			return id
				? [
						{
							id,
							label: typeof model.display_name === 'string' ? `${model.display_name} (${id})` : id,
							provider: 'claude',
							model: id,
						},
					]
				: []
		})
	} catch {
		return []
	}
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
		const models = parsePiModels(await listPiModelsBySearch(search))
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
	const { stdout, exitCode } = await runCommand('pi', args, {
		env: { ...process.env, PI_SKIP_VERSION_CHECK: '1' },
		timeoutMs: 8000,
	})
	// Environment managers such as mise may emit diagnostics on stderr even when
	// the command succeeds. Only stdout contains the model table.
	return exitCode === 0 ? stdout : ''
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
					reviewExportDirectory: getDefaultReviewExportDirectory(),
					onboardingComplete: false,
				},
				null,
				2,
			)}\n`,
		)
	}
	if (!existsSync(instructionsPath)) {
		// Migrate the legacy single-instruction markdown file into the named list.
		const legacyContent = readLegacyInstructions()
		writeReviewerInstructions([defaultReviewerInstruction(legacyContent)])
	}
}

function readLegacyInstructions() {
	try {
		return readFileSync(getLegacyInstructionsPath(), 'utf8')
	} catch {
		return ''
	}
}

async function listOpencodeModels() {
	const { stdout, exitCode } = await runCommand('opencode', ['models'], {
		env: { ...process.env },
		timeoutMs: 8000,
	})
	return exitCode === 0 ? stdout : ''
}

function parsePiModels(output: string): AvailablePiModel[] {
	return (
		output
			.split('\n')
			.map((line) => line.trim().split(/\s+/))
			// Pi's table has provider, model, context, max-out, thinking, and images.
			// Requiring the complete row prevents shell/environment diagnostics from
			// being interpreted as provider/model pairs.
			.filter((columns) => columns.length >= 6 && columns[0] !== 'provider')
			.map(([provider = '', model = '']) => ({
				id: `${provider}/${model}`,
				label: `${provider}/${model}`,
				provider,
				model,
			}))
	)
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
	// CLI aliases resolve to the latest model in each tier, so keep aliases here
	// instead of pinning release-specific model IDs that quickly become stale.
	return ['fable', 'opus', 'sonnet', 'haiku'].map((model) => ({
		id: model,
		label: `${model} (latest)`,
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
	return ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini'].map(
		(model) => ({
			id: model,
			label: model,
			provider: 'codex',
			model,
		}),
	)
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
		const models: AvailablePiModel[] = []
		for (const model of cache.models ?? []) {
			if (model.visibility !== 'list' || model.supported_in_api === false) continue
			const slug = typeof model.slug === 'string' ? model.slug : ''
			const label = typeof model.display_name === 'string' ? model.display_name : slug
			if (slug && label) {
				models.push({
					id: slug,
					label,
					provider: 'codex',
					model: slug,
				})
			}
		}
		return models
	} catch {
		return []
	}
}

function getDefaultModelForAgent(agent: CodeAgent) {
	if (agent === 'claude') return 'opus'
	if (agent === 'opencode') return defaultOpencodeModels()[0]?.id ?? 'opencode/default'
	if (agent === 'codex') return defaultCodexModels()[0]?.id ?? 'gpt-5.6-sol'
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
	return join(getConfigDir(), 'reviewer-instructions.json')
}

function getLegacyInstructionsPath() {
	return join(getConfigDir(), 'reviewer-instructions.md')
}

function getDefaultReviewExportDirectory() {
	return join(getHomeDir(), 'reviewer-agent-exports')
}

function getConfigDir() {
	return getLegacyConfigDir()
}

function getPiAgentDir() {
	return process.env.PI_CODING_AGENT_DIR ?? (getHomeDir() ? join(getHomeDir(), '.pi', 'agent') : '')
}

function getHomeDir() {
	return getHomePath()
}
