import { describe, expect, it } from 'vitest'
import { compareVersions, normalizeVersion } from './version'

describe('version utilities', () => {
	it('normalizes v-prefixed versions', () => {
		expect(normalizeVersion('v1.2.3')).toBe('1.2.3')
		expect(normalizeVersion('  V2.0.0 ')).toBe('2.0.0')
	})

	it('compares semantic version numbers', () => {
		expect(compareVersions('1.2.4', '1.2.3')).toBeGreaterThan(0)
		expect(compareVersions('1.2.3', '1.2.4')).toBeLessThan(0)
		expect(compareVersions('v1.2.3', '1.2.3')).toBe(0)
		expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0)
	})
})
