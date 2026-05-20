import { describe, expect, it } from 'vitest'
import { pruneRecordByUpdatedAt } from './json-store'

describe('json store utilities', () => {
	it('keeps the newest entries by updatedAt', () => {
		const pruned = pruneRecordByUpdatedAt(
			{
				old: { updatedAt: '2024-01-01T00:00:00.000Z' },
				newest: { updatedAt: '2024-01-03T00:00:00.000Z' },
				middle: { updatedAt: '2024-01-02T00:00:00.000Z' },
			},
			2,
		)

		expect(Object.keys(pruned)).toEqual(['newest', 'middle'])
	})
})
