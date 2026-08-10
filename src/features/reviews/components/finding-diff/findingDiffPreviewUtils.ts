import type { FileDiffMetadata } from '@pierre/diffs'
import { parsePatch } from '../diff-viewer/diffDisplayUtils'

type FocusedPatchLine = {
	additionLineNumber?: number
	deletionLineNumber?: number
	prefix: ' ' | '+' | '-'
	text: string
}

export function getFocusedFileDiff(fileDiff: FileDiffMetadata, lineNumber: number) {
	const contextRadius = 3
	const hunk = findHunkForRightLine(fileDiff, lineNumber)
	if (!hunk) return null

	const patchLines = getFocusedPatchLines(
		fileDiff,
		hunk,
		lineNumber - contextRadius,
		lineNumber + contextRadius,
	)
	if (!patchLines.some((line) => line.additionLineNumber === lineNumber)) return null

	return parsePatch(buildFocusedPatch(fileDiff, patchLines, hunk.hunkContext)).files[0] ?? null
}

function findHunkForRightLine(fileDiff: FileDiffMetadata, lineNumber: number) {
	return (
		fileDiff.hunks.find(
			(hunk) =>
				lineNumber >= hunk.additionStart && lineNumber < hunk.additionStart + hunk.additionCount,
		) ?? null
	)
}

function getFocusedPatchLines(
	fileDiff: FileDiffMetadata,
	hunk: FileDiffMetadata['hunks'][number],
	windowStart: number,
	windowEnd: number,
) {
	const patchLines: FocusedPatchLine[] = []

	for (const content of hunk.hunkContent) {
		if (content.type === 'context') {
			for (let offset = 0; offset < content.lines; offset += 1) {
				const additionLineNumber = getAdditionLineNumber(hunk, content.additionLineIndex, offset)
				if (additionLineNumber < windowStart || additionLineNumber > windowEnd) continue

				patchLines.push({
					additionLineNumber,
					deletionLineNumber: getDeletionLineNumber(hunk, content.deletionLineIndex, offset),
					prefix: ' ',
					text: fileDiff.additionLines[content.additionLineIndex + offset] ?? '',
				})
			}
			continue
		}

		const additionLines = Array.from({ length: content.additions }, (_, offset) => ({
			additionLineNumber: getAdditionLineNumber(hunk, content.additionLineIndex, offset),
			prefix: '+' as const,
			text: fileDiff.additionLines[content.additionLineIndex + offset] ?? '',
		})).filter(
			(line) => line.additionLineNumber >= windowStart && line.additionLineNumber <= windowEnd,
		)
		if (additionLines.length === 0) continue

		for (let offset = 0; offset < content.deletions; offset += 1) {
			patchLines.push({
				deletionLineNumber: getDeletionLineNumber(hunk, content.deletionLineIndex, offset),
				prefix: '-',
				text: fileDiff.deletionLines[content.deletionLineIndex + offset] ?? '',
			})
		}
		patchLines.push(...additionLines)
	}

	return patchLines
}

function buildFocusedPatch(
	fileDiff: FileDiffMetadata,
	patchLines: FocusedPatchLine[],
	hunkContext?: string,
) {
	const oldPath = fileDiff.prevName ?? fileDiff.name
	const deletionStart = patchLines.find((line) => line.deletionLineNumber)?.deletionLineNumber ?? 0
	const additionStart = patchLines.find((line) => line.additionLineNumber)?.additionLineNumber ?? 0
	const deletionCount = patchLines.filter((line) => line.prefix !== '+').length
	const additionCount = patchLines.filter((line) => line.prefix !== '-').length
	const hunkHeader = `@@ -${formatHunkRange(deletionStart, deletionCount)} +${formatHunkRange(
		additionStart,
		additionCount,
	)} @@${hunkContext ? ` ${hunkContext}` : ''}`

	return [
		`diff --git a/${oldPath} b/${fileDiff.name}`,
		`--- a/${oldPath}`,
		`+++ b/${fileDiff.name}`,
		hunkHeader,
		...patchLines.map((line) => `${line.prefix}${line.text}`),
	].join('\n')
}

function formatHunkRange(start: number, count: number) {
	return count === 1 ? String(start) : `${start},${count}`
}

function getAdditionLineNumber(
	hunk: FileDiffMetadata['hunks'][number],
	lineIndex: number,
	offset: number,
) {
	return hunk.additionStart + (lineIndex - hunk.additionLineIndex) + offset
}

function getDeletionLineNumber(
	hunk: FileDiffMetadata['hunks'][number],
	lineIndex: number,
	offset: number,
) {
	return hunk.deletionStart + (lineIndex - hunk.deletionLineIndex) + offset
}
