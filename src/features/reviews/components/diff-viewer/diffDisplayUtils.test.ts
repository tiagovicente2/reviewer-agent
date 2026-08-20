import { describe, expect, it } from 'vitest'
import {
	codeDiffDisplaySettings,
	getDiffOptions,
	parsePatch,
	reviewDiffDisplaySettings,
} from './diffDisplayUtils'

describe('diffDisplayUtils', () => {
	it('returns diff options respecting the active color mode', () => {
		const darkOptions = getDiffOptions(codeDiffDisplaySettings, {}, 'dark')
		expect(darkOptions.themeType).toBe('dark')
		expect(darkOptions.theme).toEqual({ dark: 'pierre-dark', light: 'pierre-light' })
		expect(darkOptions.diffStyle).toBe('unified')

		const lightOptions = getDiffOptions(reviewDiffDisplaySettings, {}, 'light')
		expect(lightOptions.themeType).toBe('light')
		expect(lightOptions.theme).toEqual({ dark: 'pierre-dark', light: 'pierre-light' })
		expect(lightOptions.diffStyle).toBe('split')
	})

	it('parses valid git patches', () => {
		const patch = `diff --git a/a.txt b/a.txt
--- a/a.txt
+++ b/a.txt
@@ -1 +1 @@
-old
+new`
		const result = parsePatch(patch)
		expect(result.error).toBeUndefined()
		expect(result.files).toHaveLength(1)
		expect(result.files[0]?.name).toBe('a.txt')
	})
})
