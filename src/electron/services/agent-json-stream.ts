export type ProgressHandler = (progress: { message?: string; outputText?: string }) => void
export type JsonStreamEvent = Record<string, unknown>

type JsonStreamAdapter = {
	getFinalText?: (event: JsonStreamEvent) => string | undefined
	getStatusMessage?: (event: JsonStreamEvent) => string | undefined
	getTextDelta?: (event: JsonStreamEvent) => string | undefined
}

export function createJsonStreamProgressHandler(params: {
	adapter: JsonStreamAdapter
	onProgress?: ProgressHandler
	promptLabel?: string
}) {
	const { adapter, onProgress, promptLabel } = params
	if (!onProgress) return undefined

	let buffered = ''
	let transcript = promptLabel ? `${promptLabel}\n\n` : ''
	let streamedText = ''
	let lastTextLength = 0
	return (chunk: string) => {
		buffered += chunk
		const lines = buffered.split(/\r?\n/)
		buffered = lines.pop() ?? ''

		for (const line of lines) {
			const event = parseJsonLine(line)
			if (!event) continue

			const textDelta = adapter.getTextDelta?.(event)
			if (textDelta) {
				streamedText += textDelta
				onProgress({ outputText: formatVisibleReviewOutput(transcript, streamedText) })
			}

			const text = adapter.getFinalText?.(event)
			if (text && text.length !== lastTextLength) {
				lastTextLength = text.length
				onProgress({ outputText: formatVisibleReviewOutput(transcript, text) })
			}

			const message = adapter.getStatusMessage?.(event)
			if (message) {
				if (!streamedText) transcript = appendTranscriptLine(transcript, `:: ${message}`)
				onProgress({ message, outputText: formatVisibleReviewOutput(transcript, streamedText) })
			}
		}
	}
}

export function normalizeJsonStreamOutput(stdout: string, adapter: JsonStreamAdapter) {
	const events = stdout
		.split(/\r?\n/)
		.map(parseJsonLine)
		.filter((event): event is JsonStreamEvent => Boolean(event))

	if (events.length === 0) return stdout

	const finalTexts = events
		.map((event) => adapter.getFinalText?.(event))
		.filter((text): text is string => Boolean(text))
	const finalText = finalTexts[finalTexts.length - 1]
	if (finalText) return finalText

	const streamedText = events
		.map((event) => adapter.getTextDelta?.(event))
		.filter(Boolean)
		.join('')

	return streamedText || stdout
}

export function parseJsonLine(line: string) {
	const trimmed = line.trim()
	if (!trimmed.startsWith('{')) return null

	try {
		const parsed = JSON.parse(trimmed) as unknown
		return parsed && typeof parsed === 'object' ? (parsed as JsonStreamEvent) : null
	} catch {
		return null
	}
}

export function formatVisibleReviewOutput(transcript: string, text: string) {
	if (!transcript) return text
	if (!text.trim()) return transcript

	const lines = text.split(/\r?\n/)
	const hasTrailingNewline = /\r?\n$/.test(text)
	const formattedLines: string[] = []

	for (const [index, line] of lines.entries()) {
		const trimmed = line.trim()
		if (!trimmed) continue

		const isLastPartialLine = index === lines.length - 1 && !hasTrailingNewline
		const formatted = formatReviewEventLine(trimmed, isLastPartialLine)
		if (formatted) formattedLines.push(formatted)
	}

	if (formattedLines.length === 0) return transcript
	return `${transcript}${formattedLines.join('\n')}`
}

export function getNestedValue(value: unknown, path: string[]) {
	return path.reduce<unknown>((current, key) => {
		if (!current || typeof current !== 'object') return undefined
		return (current as Record<string, unknown>)[key]
	}, value)
}

function formatReviewEventLine(line: string, isPartial: boolean) {
	if (isPartial && line.startsWith('{"type":"final"')) return ':: Formatting final review JSON...'

	try {
		const parsed = JSON.parse(line) as unknown
		if (!parsed || typeof parsed !== 'object') return line

		const event = parsed as Record<string, unknown>
		if (event.type === 'progress') return `:: ${getString(event.message) ?? 'Reviewing...'}`
		if (event.type === 'thought')
			return `Thought: ${getString(event.message) ?? 'Planning next check...'}`
		if (event.type === 'check') {
			const target = getString(event.target)
			const message = getString(event.message) ?? 'Checking changed code...'
			return target ? `-> ${target}: ${message}` : `-> ${message}`
		}
		if (event.type === 'finding') {
			const finding = event.finding && typeof event.finding === 'object' ? event.finding : event
			const severity = getString((finding as Record<string, unknown>).severity)
			const title = getString((finding as Record<string, unknown>).title)
			const filePath = getString((finding as Record<string, unknown>).filePath)
			const message = title ?? getString(event.message) ?? 'Potential finding identified.'
			const suffix = filePath ? ` in ${filePath}` : ''
			return severity
				? `Finding (${severity}): ${message}${suffix}`
				: `Finding: ${message}${suffix}`
		}
		if (event.type === 'inline_comment') {
			const comment = event.comment && typeof event.comment === 'object' ? event.comment : event
			const path = getString((comment as Record<string, unknown>).path)
			const line = (comment as Record<string, unknown>).line
			const location = path
				? `${path}${typeof line === 'number' ? `:${line}` : ''}`
				: 'inline comment'
			return `-> ${location}: Drafted inline comment`
		}
		if (event.type === 'summary') {
			const message = getString(event.summary) ?? 'Review summary generated.'
			return `Summary: ${message}`
		}
		if (event.type === 'done') return ':: Review events assembled.'
		if (event.type === 'final') {
			const message = event.review ? ':: Legacy final review JSON generated.' : undefined
			if (message) return message

			const severity = getString(event.severity)
			const messageText = getString(event.message) ?? 'Potential finding identified.'
			return severity ? `Finding (${severity}): ${messageText}` : `Finding: ${messageText}`
		}

		return line
	} catch {
		return isPartial ? undefined : line
	}
}

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value : undefined
}

function appendTranscriptLine(transcript: string, line: string) {
	if (transcript.includes(line)) return transcript
	return `${transcript}${line}\n`
}
