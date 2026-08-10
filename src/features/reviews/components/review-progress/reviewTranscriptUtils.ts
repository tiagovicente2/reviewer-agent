export type TranscriptLineKind =
	| 'check'
	| 'finding'
	| 'output'
	| 'prompt'
	| 'status'
	| 'summary'
	| 'thought'

export type TranscriptLineModel = {
	detail?: string
	id: string
	kind: TranscriptLineKind
	label?: string
	raw: string
	text: string
	timestamp?: string
}

type TranscriptTimestampProvider = () => string

export function getTranscriptLines(
	outputText: string | undefined,
	timestampByLineId: Map<string, string>,
	getTimestamp: TranscriptTimestampProvider = formatTranscriptTimestamp,
): TranscriptLineModel[] {
	return (outputText ?? '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line, index) => {
			const parsedLine = parseTranscriptLine(line)
			const id = `${index}:${line}`
			let timestamp: string | undefined

			if (parsedLine.kind === 'status') {
				timestamp = timestampByLineId.get(id)
				if (!timestamp) {
					timestamp = getTimestamp()
					timestampByLineId.set(id, timestamp)
				}
			}

			return {
				...parsedLine,
				id,
				timestamp,
			}
		})
}

export function parseTranscriptLine(raw: string): Omit<TranscriptLineModel, 'id'> {
	if (raw.startsWith('::')) {
		return { kind: 'status', raw, text: raw.replace(/^::\s*/, '') }
	}

	if (raw.startsWith('Thought:')) {
		return {
			kind: 'thought',
			label: 'Thought',
			raw,
			text: raw.replace(/^Thought:\s*/, ''),
		}
	}

	if (raw.startsWith('Finding')) {
		const match = raw.match(/^Finding(?:\s+\(([^)]+)\))?:\s*(.*)$/)
		return {
			detail: match?.[1],
			kind: 'finding',
			label: 'Finding',
			raw,
			text: match?.[2] || raw,
		}
	}

	if (raw.startsWith('Summary:')) {
		return {
			kind: 'summary',
			label: 'Summary',
			raw,
			text: raw.replace(/^Summary:\s*/, ''),
		}
	}

	if (raw.startsWith('->')) {
		const text = raw.replace(/^->\s*/, '')
		const separatorIndex = text.indexOf(': ')
		return {
			detail: separatorIndex > 0 ? text.slice(0, separatorIndex) : undefined,
			kind: 'check',
			label: 'Check',
			raw,
			text: separatorIndex > 0 ? text.slice(separatorIndex + 2) : text,
		}
	}

	if (/^Generate\b/.test(raw)) {
		return { kind: 'prompt', raw, text: raw }
	}

	return { kind: 'output', raw, text: raw }
}

const transcriptTimestampFormatter = new Intl.DateTimeFormat(undefined, {
	hour: '2-digit',
	hour12: false,
	minute: '2-digit',
})

export function formatTranscriptTimestamp() {
	return transcriptTimestampFormatter.format(new Date())
}

export const transcriptLineTone: Record<
	TranscriptLineKind,
	{ detailColor: string; label: string; labelColor: string; textColor: string }
> = {
	check: {
		detailColor: 'cyan.11',
		label: 'Check',
		labelColor: 'cyan.11',
		textColor: 'fg.default',
	},
	finding: {
		detailColor: 'red.11',
		label: 'Finding',
		labelColor: 'red.11',
		textColor: 'fg.default',
	},
	output: {
		detailColor: 'fg.muted',
		label: 'Output',
		labelColor: 'fg.muted',
		textColor: 'fg.default',
	},
	prompt: {
		detailColor: 'fg.muted',
		label: 'Prompt',
		labelColor: 'fg.muted',
		textColor: 'fg.default',
	},
	status: {
		detailColor: 'fg.muted',
		label: 'Status',
		labelColor: 'fg.muted',
		textColor: 'fg.muted',
	},
	summary: {
		detailColor: 'fg.muted',
		label: 'Summary',
		labelColor: 'cyan.11',
		textColor: 'fg.default',
	},
	thought: {
		detailColor: 'fg.muted',
		label: 'Thought',
		labelColor: 'green.11',
		textColor: 'fg.default',
	},
}
