import { describe, expect, it } from 'vitest'
import type { AppSettings } from '@/shared/settings'
import { hasUnsavedSettings } from './settingsDirtyState'

const defaultInstruction = { id: 'default', name: 'Default', content: '# Review' }

const persisted: AppSettings = {
	colorMode: 'system',
	codeAgent: 'pi',
	model: 'openai/gpt-5',
	reviewLanguage: 'english',
	reviewExportDirectory: '/tmp/reviews',
	reviewerInstructions: [defaultInstruction],
	reviewerInstructionsPath: '/tmp/instructions.json',
	onboardingComplete: true,
}

describe('hasUnsavedSettings', () => {
	it.each([
		['color mode', { colorMode: 'dark' }],
		['code agent', { codeAgent: 'claude' }],
		['model', { model: 'anthropic/claude-sonnet-4' }],
		['review language', { reviewLanguage: 'portuguese' }],
		['review export directory', { reviewExportDirectory: '/tmp/other' }],
	] as const)('detects a changed %s', (_label, change) => {
		expect(hasUnsavedSettings({ ...persisted, ...change }, persisted)).toBe(true)
	})

	it('detects instruction identity, name, content, order, and length changes', () => {
		const secondInstruction = { id: 'second', name: 'Second', content: '# Second' }
		const withTwoInstructions = {
			...persisted,
			reviewerInstructions: [...persisted.reviewerInstructions, secondInstruction],
		}

		expect(
			hasUnsavedSettings(
				{
					...persisted,
					reviewerInstructions: [{ ...defaultInstruction, id: 'changed' }],
				},
				persisted,
			),
		).toBe(true)
		expect(
			hasUnsavedSettings(
				{
					...persisted,
					reviewerInstructions: [{ ...defaultInstruction, name: 'Changed' }],
				},
				persisted,
			),
		).toBe(true)
		expect(
			hasUnsavedSettings(
				{
					...persisted,
					reviewerInstructions: [{ ...defaultInstruction, content: '# Changed' }],
				},
				persisted,
			),
		).toBe(true)
		expect(hasUnsavedSettings(withTwoInstructions, persisted)).toBe(true)
		expect(
			hasUnsavedSettings(
				{
					...withTwoInstructions,
					reviewerInstructions: [...withTwoInstructions.reviewerInstructions].reverse(),
				},
				withTwoInstructions,
			),
		).toBe(true)
	})

	it('returns clean for equal settings and absent values', () => {
		expect(hasUnsavedSettings({ ...persisted }, persisted)).toBe(false)
		expect(hasUnsavedSettings(null, persisted)).toBe(false)
		expect(hasUnsavedSettings(persisted, null)).toBe(false)
	})

	it('ignores derived and non-editable fields', () => {
		expect(
			hasUnsavedSettings(
				{ ...persisted, onboardingComplete: false, reviewerInstructionsPath: '/other/path' },
				persisted,
			),
		).toBe(false)
	})
})
