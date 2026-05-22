import { describe, expect, it } from 'vitest'
import {
	createClaudeStreamJsonProgressHandler,
	normalizeClaudeStreamJsonOutput,
} from './claude-stream-json'
import { normalizeCodexJsonOutput } from './codex-json-stream'
import { parseGeneratedReview } from './generated-review-parser'
import { normalizeOpencodeJsonOutput } from './opencode-json-stream'
import { createPiJsonProgressHandler, normalizePiJsonOutput } from './pi-json-stream'

describe('review generation output adapters', () => {
	it('extracts the final Claude stream-json result', () => {
		const reviewJson = JSON.stringify({
			summary: 'Looks good.',
			publishableBody: 'Looks good.',
			verdictRecommendation: 'comment',
			severity: 'info',
			findings: [],
			inlineComments: [],
		})
		const output = [
			JSON.stringify({ type: 'init', session_id: 'session-1' }),
			JSON.stringify({
				type: 'assistant',
				message: { content: [{ type: 'text', text: 'draft' }] },
			}),
			JSON.stringify({ type: 'result', result: reviewJson, session_id: 'session-1' }),
		].join('\n')

		expect(normalizeClaudeStreamJsonOutput(output)).toBe(reviewJson)
	})

	it('falls back to accumulated text deltas when no result event exists', () => {
		const output = [
			JSON.stringify({
				type: 'stream_event',
				event: { delta: { type: 'text_delta', text: '{"summary":' } },
			}),
			JSON.stringify({
				type: 'stream_event',
				event: { delta: { type: 'text_delta', text: '"ok"}' } },
			}),
		].join('\n')

		expect(normalizeClaudeStreamJsonOutput(output)).toBe('{"summary":"ok"}')
	})

	it('leaves non-NDJSON output unchanged for legacy or error output', () => {
		expect(normalizeClaudeStreamJsonOutput('plain output')).toBe('plain output')
	})

	it('streams accumulated Claude text deltas through progress updates', () => {
		const updates: string[] = []
		const handleChunk = createClaudeStreamJsonProgressHandler({
			onProgress: ({ outputText }) => {
				if (outputText) updates.push(outputText)
			},
		})

		handleChunk?.(
			[
				JSON.stringify({
					type: 'stream_event',
					event: { delta: { type: 'text_delta', text: '{"summary":' } },
				}),
				JSON.stringify({
					type: 'stream_event',
					event: { delta: { type: 'text_delta', text: '"ok"}' } },
				}),
				'',
			].join('\n'),
		)

		expect(updates).toEqual(['{"summary":', '{"summary":"ok"}'])
	})

	it('shows a transcript before Claude emits answer tokens', () => {
		const updates: string[] = []
		const handleChunk = createClaudeStreamJsonProgressHandler({
			onProgress: ({ outputText }) => {
				if (outputText) updates.push(outputText)
			},
			promptLabel: 'Generate review',
		})

		handleChunk?.(
			[
				JSON.stringify({ type: 'system', subtype: 'init' }),
				JSON.stringify({ type: 'stream_event', event: { type: 'message_start' } }),
				'',
			].join('\n'),
		)

		const lastUpdate = updates[updates.length - 1]
		expect(lastUpdate).toContain('Generate review')
		expect(lastUpdate).toContain(':: Claude is drafting the review JSON...')
	})

	it('formats review protocol events for the live transcript', () => {
		const updates: string[] = []
		const handleChunk = createClaudeStreamJsonProgressHandler({
			onProgress: ({ outputText }) => {
				if (outputText) updates.push(outputText)
			},
			promptLabel: 'Generate review',
		})

		handleChunk?.(
			[
				JSON.stringify({
					type: 'stream_event',
					event: {
						delta: {
							type: 'text_delta',
							text: [
								JSON.stringify({ type: 'progress', message: 'Reading PR metadata...' }),
								JSON.stringify({ type: 'thought', message: 'Focus on risky state changes.' }),
								JSON.stringify({
									type: 'check',
									target: 'src/example.ts',
									message: 'Checking fallback behavior...',
								}),
								JSON.stringify({
									type: 'finding',
									finding: {
										body: 'Fallback may regress.',
										confidence: 0.8,
										filePath: 'src/example.ts',
										id: 'finding-1',
										severity: 'medium',
										title: 'Fallback may regress',
									},
								}),
								JSON.stringify({
									type: 'summary',
									summary: 'One fallback issue needs attention.',
								}),
								'',
							].join('\n'),
						},
					},
				}),
				'',
			].join('\n'),
		)

		const lastUpdate = updates[updates.length - 1]
		expect(lastUpdate).toContain(':: Reading PR metadata...')
		expect(lastUpdate).toContain('Thought: Focus on risky state changes.')
		expect(lastUpdate).toContain('-> src/example.ts: Checking fallback behavior...')
		expect(lastUpdate).toContain('Finding (medium): Fallback may regress in src/example.ts')
		expect(lastUpdate).toContain('Summary: One fallback issue needs attention.')
	})

	it('assembles generated reviews from streamed review events', () => {
		const output = [
			JSON.stringify({
				type: 'finding',
				finding: {
					body: 'The fallback can route unknown origins incorrectly.',
					confidence: 0.84,
					filePath: 'src/routes.ts',
					id: 'finding-1',
					lineEnd: null,
					lineStart: 42,
					severity: 'medium',
					suggestedCommentBody: 'Could we make the fallback explicit here?',
					title: 'Fallback accepts unknown origins',
				},
			}),
			JSON.stringify({
				type: 'inline_comment',
				comment: {
					body: 'Could we make the fallback explicit here?',
					line: 42,
					path: 'src/routes.ts',
					side: 'RIGHT',
				},
			}),
			JSON.stringify({
				type: 'summary',
				publishableBody: 'One fallback issue needs attention.',
				severity: 'medium',
				summary: 'Found one fallback issue.',
				verdictRecommendation: 'request_changes',
			}),
			JSON.stringify({ type: 'done' }),
		].join('\n')

		const review = parseGeneratedReview(output)

		expect(review.summary).toBe('Found one fallback issue.')
		expect(review.verdictRecommendation).toBe('request_changes')
		expect(review.findings).toHaveLength(1)
		expect(review.findings[0]?.filePath).toBe('src/routes.ts')
		expect(review.inlineComments).toHaveLength(1)
		expect(review.inlineComments[0]?.path).toBe('src/routes.ts')
	})

	it('extracts Pi JSON text deltas and final assistant messages', () => {
		const output = [
			JSON.stringify({
				type: 'message_update',
				assistantMessageEvent: { type: 'text_delta', delta: '{"type":"progress"}\n' },
			}),
			JSON.stringify({
				type: 'message_update',
				assistantMessageEvent: {
					type: 'text_delta',
					delta: '{"type":"final","review":{"summary":"ok"}}',
				},
			}),
		].join('\n')

		expect(normalizePiJsonOutput(output)).toBe(
			'{"type":"progress"}\n{"type":"final","review":{"summary":"ok"}}',
		)
	})

	it('streams Pi text deltas through progress updates', () => {
		const updates: string[] = []
		const handleChunk = createPiJsonProgressHandler({
			onProgress: ({ outputText }) => {
				if (outputText) updates.push(outputText)
			},
			promptLabel: 'Generate review',
		})

		handleChunk?.(
			[
				JSON.stringify({
					type: 'message_update',
					assistantMessageEvent: {
						type: 'text_delta',
						delta: `${JSON.stringify({ type: 'check', target: 'src/app.ts', message: 'Checking state.' })}\n`,
					},
				}),
				'',
			].join('\n'),
		)

		expect(updates[updates.length - 1]).toContain('-> src/app.ts: Checking state.')
	})

	it('extracts opencode JSON text events', () => {
		const output = [
			JSON.stringify({ type: 'step_start' }),
			JSON.stringify({ type: 'text', part: { type: 'text', text: '{"summary":"ok"}' } }),
			JSON.stringify({ type: 'step_finish' }),
		].join('\n')

		expect(normalizeOpencodeJsonOutput(output)).toBe('{"summary":"ok"}')
	})

	it('extracts Codex JSON agent messages', () => {
		const output = [
			JSON.stringify({ type: 'thread.started' }),
			JSON.stringify({ type: 'turn.started' }),
			JSON.stringify({
				type: 'item.completed',
				item: { type: 'agent_message', text: '{"summary":"ok"}' },
			}),
			JSON.stringify({ type: 'turn.completed' }),
		].join('\n')

		expect(normalizeCodexJsonOutput(output)).toBe('{"summary":"ok"}')
	})
})
