import {
	createJsonStreamProgressHandler,
	type JsonStreamEvent,
	normalizeJsonStreamOutput,
	type ProgressHandler,
} from './agent-json-stream'

const opencodeStreamAdapter = {
	getStatusMessage: getOpencodeStatusMessage,
	getTextDelta: getOpencodeText,
}

export function createOpencodeJsonProgressHandler(params: {
	initialStatusMessages?: string[]
	onProgress?: ProgressHandler
	promptLabel?: string
}) {
	return createJsonStreamProgressHandler({ ...params, adapter: opencodeStreamAdapter })
}

export function normalizeOpencodeJsonOutput(stdout: string) {
	return normalizeJsonStreamOutput(stdout, opencodeStreamAdapter)
}

function getOpencodeText(event: JsonStreamEvent) {
	if (event.type !== 'text') return undefined

	const part = event.part
	if (!part || typeof part !== 'object') return undefined

	const value = part as { text?: unknown; type?: unknown }
	return value.type === 'text' && typeof value.text === 'string' ? value.text : undefined
}

function getOpencodeStatusMessage(event: JsonStreamEvent) {
	if (event.type === 'step_start') return 'opencode started a review step...'
	if (event.type === 'step_finish') return 'opencode finished a review step...'

	return undefined
}
