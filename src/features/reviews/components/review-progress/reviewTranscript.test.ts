import { describe, expect, it } from 'vitest'
import { getTranscriptLines, parseTranscriptLine } from './reviewTranscript'

describe('parseTranscriptLine', () => {
	it.each([
		{
			expected: { kind: 'status', raw: ':: Inspecting changes', text: 'Inspecting changes' },
			raw: ':: Inspecting changes',
		},
		{
			expected: {
				kind: 'thought',
				label: 'Thought',
				raw: 'Thought: Check the failure path',
				text: 'Check the failure path',
			},
			raw: 'Thought: Check the failure path',
		},
		{
			expected: {
				kind: 'summary',
				label: 'Summary',
				raw: 'Summary: One issue found',
				text: 'One issue found',
			},
			raw: 'Summary: One issue found',
		},
		{
			expected: {
				kind: 'prompt',
				raw: 'Generate a review comment',
				text: 'Generate a review comment',
			},
			raw: 'Generate a review comment',
		},
		{
			expected: {
				kind: 'output',
				raw: 'Unprefixed agent output',
				text: 'Unprefixed agent output',
			},
			raw: 'Unprefixed agent output',
		},
	])('parses $raw', ({ expected, raw }) => {
		expect(parseTranscriptLine(raw)).toEqual(expected)
	})

	it.each([
		{
			expected: {
				detail: 'HIGH',
				kind: 'finding',
				label: 'Finding',
				raw: 'Finding (HIGH): Missing guard',
				text: 'Missing guard',
			},
			raw: 'Finding (HIGH): Missing guard',
		},
		{
			expected: {
				detail: undefined,
				kind: 'finding',
				label: 'Finding',
				raw: 'Finding: Missing guard',
				text: 'Missing guard',
			},
			raw: 'Finding: Missing guard',
		},
	])('parses finding detail in $raw', ({ expected, raw }) => {
		expect(parseTranscriptLine(raw)).toEqual(expected)
	})

	it.each([
		{
			expected: {
				detail: 'src/review.ts',
				kind: 'check',
				label: 'Check',
				raw: '-> src/review.ts: Verify fallback',
				text: 'Verify fallback',
			},
			raw: '-> src/review.ts: Verify fallback',
		},
		{
			expected: {
				detail: undefined,
				kind: 'check',
				label: 'Check',
				raw: '-> Verify fallback',
				text: 'Verify fallback',
			},
			raw: '-> Verify fallback',
		},
	])('parses check detail in $raw', ({ expected, raw }) => {
		expect(parseTranscriptLine(raw)).toEqual(expected)
	})
})

describe('getTranscriptLines', () => {
	it('filters blank lines and assigns stable IDs after trimming', () => {
		const timestamps = new Map<string, string>()
		const initialLines = getTranscriptLines(
			'\n  Thought: inspect this  \r\n\r\n  plain output  \n',
			timestamps,
		)
		const appendedLines = getTranscriptLines(
			'\n  Thought: inspect this  \r\n\r\n  plain output  \nSummary: done',
			timestamps,
		)

		expect(initialLines.map(({ id, raw }) => ({ id, raw }))).toEqual([
			{ id: '0:Thought: inspect this', raw: 'Thought: inspect this' },
			{ id: '1:plain output', raw: 'plain output' },
		])
		expect(appendedLines.slice(0, 2).map((line) => line.id)).toEqual(
			initialLines.map((line) => line.id),
		)
	})

	it('assigns deterministic status timestamps once and reuses them by line ID', () => {
		const timestamps = new Map<string, string>()
		const providedTimestamps = ['09:41', '09:42']
		let timestampIndex = 0
		const getTimestamp = () => providedTimestamps[timestampIndex++] ?? 'unexpected'

		const initialLines = getTranscriptLines(
			':: Inspecting\nThought: continue',
			timestamps,
			getTimestamp,
		)
		const appendedLines = getTranscriptLines(
			':: Inspecting\nThought: continue\n:: Finished',
			timestamps,
			getTimestamp,
		)

		expect(initialLines.map((line) => line.timestamp)).toEqual(['09:41', undefined])
		expect(appendedLines.map((line) => line.timestamp)).toEqual(['09:41', undefined, '09:42'])
		expect(timestampIndex).toBe(2)
		expect(timestamps).toEqual(
			new Map([
				['0::: Inspecting', '09:41'],
				['2::: Finished', '09:42'],
			]),
		)
	})
})
