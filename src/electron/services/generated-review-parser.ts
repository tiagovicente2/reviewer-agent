import type { GeneratedReview, ReviewFinding, ReviewInlineComment } from '@/shared/review'

export function parseGeneratedReview(
	output: string,
): Omit<GeneratedReview, 'rawOutput' | 'modelLabel' | 'generatedAt' | 'diffWasTruncated'> {
	const assembled = assembleGeneratedReviewFromEvents(output)
	if (assembled) return assembled

	const jsonText = extractJson(output)
	const parsed = JSON.parse(jsonText) as Partial<GeneratedReview>
	const findings = normalizeFindings(parsed.findings)

	return {
		summary: typeof parsed.summary === 'string' ? parsed.summary : 'A draft review was generated.',
		publishableBody:
			typeof parsed.publishableBody === 'string'
				? parsed.publishableBody
				: typeof parsed.summary === 'string'
					? parsed.summary
					: '',
		verdictRecommendation: isVerdict(parsed.verdictRecommendation)
			? parsed.verdictRecommendation
			: 'comment',
		severity: isSeverity(parsed.severity) ? parsed.severity : inferOverallSeverity(findings),
		findings,
		inlineComments: normalizeInlineComments(parsed.inlineComments),
	}
}

function assembleGeneratedReviewFromEvents(
	output: string,
): Omit<GeneratedReview, 'rawOutput' | 'modelLabel' | 'generatedAt' | 'diffWasTruncated'> | null {
	const events = output
		.split(/\r?\n/)
		.map(parseReviewEventLine)
		.filter((event): event is Record<string, unknown> => Boolean(event))

	if (
		!events.some((event) =>
			['done', 'finding', 'inline_comment', 'summary'].includes(String(event.type)),
		)
	) {
		return null
	}

	const summaryEvent = [...events].reverse().find((event) => event.type === 'summary') as
		| Record<string, unknown>
		| undefined
	const findings = normalizeFindings(
		events.filter((event) => event.type === 'finding').map((event) => event.finding ?? event),
	)
	const inlineComments = normalizeInlineComments(
		events
			.filter((event) => event.type === 'inline_comment')
			.map((event) => event.comment ?? event),
	)
	const summary =
		typeof summaryEvent?.summary === 'string'
			? summaryEvent.summary
			: findings.length
				? `Generated ${findings.length} review finding${findings.length === 1 ? '' : 's'}.`
				: 'A draft review was generated.'

	return {
		findings,
		inlineComments,
		publishableBody:
			typeof summaryEvent?.publishableBody === 'string' ? summaryEvent.publishableBody : summary,
		severity: isSeverity(summaryEvent?.severity)
			? summaryEvent.severity
			: inferOverallSeverity(findings),
		summary,
		verdictRecommendation: isVerdict(summaryEvent?.verdictRecommendation)
			? summaryEvent.verdictRecommendation
			: findings.length
				? 'request_changes'
				: 'comment',
	}
}

function parseReviewEventLine(line: string) {
	const trimmed = line.trim()
	if (!trimmed.startsWith('{')) return null

	try {
		const parsed = JSON.parse(trimmed) as unknown
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
	} catch {
		return null
	}
}

function extractJson(output: string) {
	const trimmed = output.trim()
	const reviewFromNdjson = extractFinalReviewJsonFromNdjson(trimmed)
	if (reviewFromNdjson) return reviewFromNdjson

	try {
		JSON.parse(trimmed)
		return trimmed
	} catch {
		// Continue to fenced/sub-string extraction.
	}

	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
	if (fenced?.[1]) {
		return fenced[1].trim()
	}

	const start = trimmed.indexOf('{')
	const end = trimmed.lastIndexOf('}')
	if (start >= 0 && end > start) {
		return trimmed.slice(start, end + 1)
	}

	throw new Error('The reviewer did not return parseable JSON.')
}

function extractFinalReviewJsonFromNdjson(output: string) {
	const lines = output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)

	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const line = lines[index]
		if (!line?.startsWith('{')) continue

		try {
			const parsed = JSON.parse(line) as unknown
			if (!parsed || typeof parsed !== 'object') continue

			const value = parsed as { review?: unknown; type?: unknown }
			if (value.type !== 'final' || !value.review || typeof value.review !== 'object') continue

			return JSON.stringify(value.review)
		} catch {
			// Keep looking for an earlier complete final event line.
		}
	}

	return undefined
}

function normalizeFindings(findings: unknown): ReviewFinding[] {
	if (!Array.isArray(findings)) {
		return []
	}

	return findings
		.filter((finding) => finding && typeof finding === 'object')
		.map((finding, index) => {
			const value = finding as Record<string, unknown>
			return {
				body: typeof value.body === 'string' ? value.body : '',
				codeSnippet: typeof value.codeSnippet === 'string' ? value.codeSnippet : undefined,
				confidence: typeof value.confidence === 'number' ? value.confidence : 0.5,
				filePath: typeof value.filePath === 'string' ? value.filePath : '',
				fixSuggestion: typeof value.fixSuggestion === 'string' ? value.fixSuggestion : undefined,
				id: typeof value.id === 'string' ? value.id : `finding-${index + 1}`,
				lineEnd: typeof value.lineEnd === 'number' ? value.lineEnd : undefined,
				lineStart: typeof value.lineStart === 'number' ? value.lineStart : undefined,
				severity: isSeverity(value.severity) ? value.severity : 'info',
				suggestedCommentBody:
					typeof value.suggestedCommentBody === 'string' ? value.suggestedCommentBody : undefined,
				title: typeof value.title === 'string' ? value.title : 'Untitled finding',
			}
		})
		.filter((finding) => finding.title && finding.body)
}

function normalizeInlineComments(comments: unknown): ReviewInlineComment[] {
	if (!Array.isArray(comments)) {
		return []
	}

	return comments
		.filter((comment) => comment && typeof comment === 'object')
		.map((comment) => {
			const value = comment as {
				author?: unknown
				body?: unknown
				createdAt?: unknown
				line?: unknown
				path?: unknown
				side?: unknown
			}
			const side: ReviewInlineComment['side'] = value.side === 'LEFT' ? 'LEFT' : 'RIGHT'
			return {
				author: typeof value.author === 'string' ? value.author : undefined,
				body: typeof value.body === 'string' ? value.body : '',
				createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
				line: typeof value.line === 'number' ? value.line : 1,
				path: typeof value.path === 'string' ? value.path : '',
				side,
			}
		})
		.filter((comment) => comment.path && comment.body)
}

function isSeverity(value: unknown): value is GeneratedReview['severity'] {
	return ['critical', 'high', 'medium', 'low', 'info'].includes(String(value))
}

function isVerdict(value: unknown): value is GeneratedReview['verdictRecommendation'] {
	return ['comment', 'approve', 'request_changes'].includes(String(value))
}

function inferOverallSeverity(findings: ReviewFinding[]): GeneratedReview['severity'] {
	for (const severity of ['critical', 'high', 'medium', 'low', 'info'] as const) {
		if (findings.some((finding) => finding.severity === severity)) {
			return severity
		}
	}

	return 'info'
}
