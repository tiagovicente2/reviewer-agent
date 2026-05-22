import {
	createJsonStreamProgressHandler,
	getNestedValue,
	type JsonStreamEvent,
	normalizeJsonStreamOutput,
	type ProgressHandler,
} from './agent-json-stream'

const claudeStreamAdapter = {
	getFinalText: getClaudeEventText,
	getStatusMessage: getClaudeEventStatusMessage,
	getTextDelta: getClaudeTextDelta,
}

export function createClaudeStreamJsonProgressHandler(params: {
	onProgress?: ProgressHandler
	promptLabel?: string
}) {
	return createJsonStreamProgressHandler({ ...params, adapter: claudeStreamAdapter })
}

export function normalizeClaudeStreamJsonOutput(stdout: string) {
	return normalizeJsonStreamOutput(stdout, claudeStreamAdapter)
}

function getClaudeEventText(event: JsonStreamEvent) {
	const result = event.result
	if (typeof result === 'string') return result

	return (
		getClaudeMessageContent(event.message) ??
		getClaudeMessageContent(getNestedValue(event, ['event', 'message']))
	)
}

function getClaudeEventStatusMessage(event: JsonStreamEvent) {
	if (event.type === 'init') return 'Claude started the review session...'
	if (event.type === 'assistant') return 'Claude is drafting the review JSON...'
	if (event.type === 'result') return 'Claude is formatting the review output...'

	const streamType = getNestedValue(event, ['event', 'type'])
	if (streamType === 'message_start') return 'Claude is drafting the review JSON...'
	if (streamType === 'message_stop') return 'Claude is formatting the review output...'

	return undefined
}

function getClaudeTextDelta(event: JsonStreamEvent) {
	const deltaText = getNestedValue(event, ['event', 'delta', 'text'])
	if (typeof deltaText === 'string') return deltaText

	const contentDeltaText = getNestedValue(event, ['delta', 'text'])
	if (typeof contentDeltaText === 'string') return contentDeltaText

	return undefined
}

function getClaudeMessageContent(message: unknown) {
	if (!message || typeof message !== 'object') return undefined

	const content = (message as { content?: unknown }).content
	if (typeof content === 'string') return content
	if (!Array.isArray(content)) return undefined

	return content
		.map((item) => {
			if (!item || typeof item !== 'object') return ''
			const value = item as { text?: unknown; type?: unknown }
			return value.type === undefined || value.type === 'text'
				? typeof value.text === 'string'
					? value.text
					: ''
				: ''
		})
		.join('')
}
