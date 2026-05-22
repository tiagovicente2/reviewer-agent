import {
	createJsonStreamProgressHandler,
	getNestedValue,
	type JsonStreamEvent,
	normalizeJsonStreamOutput,
	type ProgressHandler,
} from './agent-json-stream'

const piStreamAdapter = {
	getFinalText: getPiFinalText,
	getStatusMessage: getPiStatusMessage,
	getTextDelta: getPiTextDelta,
}

export function createPiJsonProgressHandler(params: {
	onProgress?: ProgressHandler
	promptLabel?: string
}) {
	return createJsonStreamProgressHandler({ ...params, adapter: piStreamAdapter })
}

export function normalizePiJsonOutput(stdout: string) {
	return normalizeJsonStreamOutput(stdout, piStreamAdapter)
}

function getPiTextDelta(event: JsonStreamEvent) {
	const delta = getNestedValue(event, ['assistantMessageEvent', 'delta'])
	if (event.type === 'message_update' && typeof delta === 'string') return delta

	return undefined
}

function getPiFinalText(event: JsonStreamEvent) {
	if (event.type === 'message_end') return getPiMessageText(event.message)

	if (event.type === 'agent_end') {
		const messages = event.messages
		if (!Array.isArray(messages)) return undefined

		const assistantMessages = messages.filter(
			(message) =>
				message &&
				typeof message === 'object' &&
				(message as { role?: unknown }).role === 'assistant',
		)
		return getPiMessageText(assistantMessages[assistantMessages.length - 1])
	}

	return undefined
}

function getPiStatusMessage(event: JsonStreamEvent) {
	if (event.type === 'agent_start') return 'Pi started the review session...'
	if (event.type === 'turn_start') return 'Pi is reviewing the supplied diff...'
	if (event.type === 'message_start') return 'Pi is drafting the review output...'
	if (event.type === 'turn_end') return 'Pi is formatting the review output...'

	return undefined
}

function getPiMessageText(message: unknown) {
	if (!message || typeof message !== 'object') return undefined

	const value = message as { content?: unknown; role?: unknown }
	if (value.role !== 'assistant' && value.role !== undefined) return undefined
	if (!Array.isArray(value.content)) return undefined

	return value.content
		.map((item) => {
			if (!item || typeof item !== 'object') return ''
			const content = item as { text?: unknown; type?: unknown }
			return content.type === 'text' && typeof content.text === 'string' ? content.text : ''
		})
		.join('')
}
