export type ProgressHandler = (progress: { message?: string; outputText?: string }) => void
export type JsonStreamEvent = Record<string, unknown>

type JsonStreamAdapter = {
	getFinalText?: (event: JsonStreamEvent) => string | undefined
	getStatusMessage?: (event: JsonStreamEvent) => string | undefined
	getTextDelta?: (event: JsonStreamEvent) => string | undefined
}

export function createJsonStreamProgressHandler(params: {
	adapter: JsonStreamAdapter
	initialStatusMessages?: string[]
	onProgress?: ProgressHandler
	promptLabel?: string
}) {
	const { adapter, initialStatusMessages = [], onProgress, promptLabel } = params
	if (!onProgress) return undefined

	let buffered = ''
	let transcript = formatInitialVisibleReviewOutput({
		promptLabel,
		statusMessages: initialStatusMessages,
	})
	let lastTextLength = 0
	let streamLineBuffer = ''
	let visibleStreamLines: string[] = []
	let visiblePartialLine: string | undefined
	return (chunk: string) => {
		buffered += chunk
		const lines = buffered.split(/\r?\n/)
		buffered = lines.pop() ?? ''
		let didUpdateOutput = false
		let statusMessage: string | undefined

		for (const line of lines) {
			const event = parseJsonLine(line)
			if (!event) continue

			const textDelta = adapter.getTextDelta?.(event)
			if (textDelta) {
				const updated = appendVisibleReviewText(textDelta, {
					lineBuffer: streamLineBuffer,
					partialLine: visiblePartialLine,
					lines: visibleStreamLines,
				})
				streamLineBuffer = updated.lineBuffer
				visibleStreamLines = updated.lines
				visiblePartialLine = updated.partialLine
				didUpdateOutput = true
			}

			const text = adapter.getFinalText?.(event)
			if (text && text.length !== lastTextLength) {
				lastTextLength = text.length
				const formatted = formatReviewText(text)
				streamLineBuffer = formatted.lineBuffer
				visibleStreamLines = formatted.lines
				visiblePartialLine = formatted.partialLine
				didUpdateOutput = true
			}

			const message = adapter.getStatusMessage?.(event)
			if (message) {
				if (visibleStreamLines.length === 0 && !visiblePartialLine) {
					transcript = appendTranscriptLine(transcript, `:: ${message}`)
				}
				statusMessage = message
				didUpdateOutput = true
			}
		}

		if (didUpdateOutput) {
			onProgress({
				message: statusMessage,
				outputText: formatVisibleReviewOutput(transcript, visibleStreamLines, visiblePartialLine),
			})
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

export function formatVisibleReviewOutput(
	transcript: string,
	lines: string[],
	partialLine?: string,
) {
	const visibleLines = partialLine ? [...lines, partialLine] : lines
	if (visibleLines.length === 0) return transcript
	return `${transcript}${visibleLines.join('\n')}`
}

export function formatInitialVisibleReviewOutput({
	promptLabel,
	statusMessages,
}: {
	promptLabel?: string
	statusMessages?: string[]
}) {
	let transcript = promptLabel ? `${promptLabel}\n\n` : ''
	for (const message of statusMessages ?? []) {
		transcript = appendTranscriptLine(transcript, `:: ${message}`)
	}
	return transcript
}

export function getNestedValue(value: unknown, path: string[]) {
	return path.reduce<unknown>((current, key) => {
		if (!current || typeof current !== 'object') return undefined
		return (current as Record<string, unknown>)[key]
	}, value)
}

function formatReviewEventLine(line: string, isPartial: boolean) {
	if (isPartial && line.startsWith('{"type":"final"'))
		return ':: Reading legacy final review JSON...'

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

function appendVisibleReviewText(
	text: string,
	current: { lineBuffer: string; lines: string[]; partialLine?: string },
) {
	const combined = current.lineBuffer + text
	const lines = combined.split(/\r?\n/)
	const lineBuffer = lines.pop() ?? ''
	const formattedLines = [...current.lines]

	for (const line of lines) {
		const formatted = formatCompleteReviewTextLine(line)
		if (formatted) formattedLines.push(formatted)
	}

	return {
		lineBuffer,
		lines: formattedLines,
		partialLine: formatPartialReviewTextLine(lineBuffer),
	}
}

function formatReviewText(text: string) {
	const lines = text.split(/\r?\n/)
	const hasTrailingNewline = /\r?\n$/.test(text)
	const lineBuffer = hasTrailingNewline ? '' : (lines.pop() ?? '')
	const formattedLines = lines
		.map(formatCompleteReviewTextLine)
		.filter((line): line is string => Boolean(line))

	return {
		lineBuffer,
		lines: formattedLines,
		partialLine: formatPartialReviewTextLine(lineBuffer),
	}
}

function formatCompleteReviewTextLine(line: string) {
	const trimmed = line.trim()
	return trimmed ? formatReviewEventLine(trimmed, false) : undefined
}

function formatPartialReviewTextLine(line: string) {
	const trimmed = line.trim()
	return trimmed ? formatReviewEventLine(trimmed, true) : undefined
}

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value : undefined
}

function appendTranscriptLine(transcript: string, line: string) {
	if (transcript.includes(line)) return transcript
	return `${transcript}${line}\n`
}
