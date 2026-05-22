import {
	createJsonStreamProgressHandler,
	type JsonStreamEvent,
	normalizeJsonStreamOutput,
	type ProgressHandler,
} from './agent-json-stream'

const codexStreamAdapter = {
	getStatusMessage: getCodexStatusMessage,
	getTextDelta: getCodexText,
}

export function createCodexJsonProgressHandler(params: {
	onProgress?: ProgressHandler
	promptLabel?: string
}) {
	return createJsonStreamProgressHandler({ ...params, adapter: codexStreamAdapter })
}

export function normalizeCodexJsonOutput(stdout: string) {
	return normalizeJsonStreamOutput(stdout, codexStreamAdapter)
}

function getCodexText(event: JsonStreamEvent) {
	if (event.type !== 'item.completed') return undefined

	const item = event.item
	if (!item || typeof item !== 'object') return undefined

	const value = item as { text?: unknown; type?: unknown }
	return value.type === 'agent_message' && typeof value.text === 'string' ? value.text : undefined
}

function getCodexStatusMessage(event: JsonStreamEvent) {
	if (event.type === 'thread.started') return 'Codex started the review thread...'
	if (event.type === 'turn.started') return 'Codex is reviewing the supplied diff...'
	if (event.type === 'turn.completed') return 'Codex finished the review turn...'

	return undefined
}
