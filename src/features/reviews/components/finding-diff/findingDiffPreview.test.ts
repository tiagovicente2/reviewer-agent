import type { FileDiffMetadata } from '@pierre/diffs'
import { describe, expect, it } from 'vitest'
import { parsePatch } from '../diff-viewer/diffDisplayUtils'
import { getFocusedFileDiff } from './findingDiffPreviewUtils'

function getFileDiff(patch: string) {
	const fileDiff = parsePatch(patch).files[0]
	if (!fileDiff) throw new Error('Expected patch fixture to contain a file')
	return fileDiff
}

function getLines(lines: string[]) {
	return lines.map((line) => line.replace(/\n$/, ''))
}

const mixedPatch = `diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -8,9 +8,10 @@ function example() {
 before
-old first
-old second
+new first
+new second
+new third
 after one
 after two
 after three
 after four
 after five
 after six`

const addedFilePatch = `diff --git a/src/added.ts b/src/added.ts
new file mode 100644
--- /dev/null
+++ b/src/added.ts
@@ -0,0 +1,6 @@
+one
+two
+three
+four
+five
+six`

describe('getFocusedFileDiff', () => {
	it('keeps a three-line context window around the target', () => {
		const focusedDiff = getFocusedFileDiff(getFileDiff(mixedPatch), 12)

		expect(focusedDiff).not.toBeNull()
		expect(getLines(focusedDiff?.additionLines ?? [])).toEqual([
			'new first',
			'new second',
			'new third',
			'after one',
			'after two',
			'after three',
			'after four',
		])
		expect(focusedDiff?.hunks[0]).toMatchObject({
			additionCount: 7,
			additionStart: 9,
			deletionCount: 6,
			deletionStart: 9,
			hunkContext: 'function example() {',
		})
	})

	it('keeps the complete deletion group when its additions are in the window', () => {
		const focusedDiff = getFocusedFileDiff(getFileDiff(mixedPatch), 12)

		expect(getLines(focusedDiff?.deletionLines ?? [])).toEqual([
			'old first',
			'old second',
			'after one',
			'after two',
			'after three',
			'after four',
		])
	})

	it('returns null when the requested right-side line is outside every hunk', () => {
		expect(getFocusedFileDiff(getFileDiff(mixedPatch), 100)).toBeNull()
	})

	it('returns null when the selected hunk has no addition for the target line', () => {
		const deletionOnlyDiff = getFileDiff(`diff --git a/src/deleted.ts b/src/deleted.ts
--- a/src/deleted.ts
+++ b/src/deleted.ts
@@ -4,2 +4,0 @@
-old first
-old second`)
		const missingTargetDiff: FileDiffMetadata = {
			...deletionOnlyDiff,
			hunks: deletionOnlyDiff.hunks.map((hunk) => ({ ...hunk, additionCount: 1 })),
		}

		expect(getFocusedFileDiff(missingTargetDiff, 4)).toBeNull()
	})

	it('formats single-line hunk ranges without counts', () => {
		const focusedDiff = getFocusedFileDiff(
			getFileDiff(`diff --git a/src/single.ts b/src/single.ts
--- a/src/single.ts
+++ b/src/single.ts
@@ -5 +5 @@
-old
+new`),
			5,
		)

		expect(focusedDiff?.hunks[0]?.hunkSpecs?.trim()).toBe('@@ -5 +5 @@')
	})

	it('focuses lines from a renamed file', () => {
		const renamedDiff = getFileDiff(`diff --git a/src/old.ts b/src/new.ts
similarity index 80%
rename from src/old.ts
rename to src/new.ts
--- a/src/old.ts
+++ b/src/new.ts
@@ -5 +5 @@
-old
+new`)
		expect(renamedDiff).toMatchObject({ name: 'src/new.ts', prevName: 'src/old.ts' })

		const focusedDiff = getFocusedFileDiff(renamedDiff, 5)

		expect(focusedDiff?.name).toBe('src/new.ts')
		expect(getLines(focusedDiff?.additionLines ?? [])).toEqual(['new'])
		expect(getLines(focusedDiff?.deletionLines ?? [])).toEqual(['old'])
	})

	it.each([
		{ expectedLines: ['one', 'two', 'three', 'four'], lineNumber: 1 },
		{ expectedLines: ['three', 'four', 'five', 'six'], lineNumber: 6 },
	])('clamps the context window at the file boundary for line $lineNumber', (fixture) => {
		const focusedDiff = getFocusedFileDiff(getFileDiff(addedFilePatch), fixture.lineNumber)

		expect(getLines(focusedDiff?.additionLines ?? [])).toEqual(fixture.expectedLines)
	})
})
