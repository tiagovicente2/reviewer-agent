import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs/direct/types.js'
import type { ReviewInlineComment } from '@/shared/review'

export type DiffAnnotation = {
	comments: Array<{
		author?: string
		body: string
		createdAt?: string
	}>
}

export function groupInlineCommentsByPath(inlineComments: ReviewInlineComment[]) {
	const commentsByPath = new Map<string, ReviewInlineComment[]>()
	for (const comment of inlineComments) {
		commentsByPath.set(comment.path, [...(commentsByPath.get(comment.path) ?? []), comment])
	}
	return commentsByPath
}

export function getLineAnnotations(
	fileDiff: FileDiffMetadata,
	inlineCommentsByPath: Map<string, ReviewInlineComment[]>,
): DiffLineAnnotation<DiffAnnotation>[] {
	const annotationsByLine = new Map<string, DiffLineAnnotation<DiffAnnotation>>()
	const comments = [
		...(inlineCommentsByPath.get(fileDiff.name) ?? []),
		...(fileDiff.prevName ? (inlineCommentsByPath.get(fileDiff.prevName) ?? []) : []),
	]

	const availableLines = getAvailableAnnotationLines(fileDiff)

	for (const comment of comments) {
		const side = comment.side === 'LEFT' ? 'deletions' : 'additions'
		if (!availableLines[side].has(comment.line)) continue

		const lineNumber = comment.line
		const key = `${side}:${lineNumber}`
		const existing = annotationsByLine.get(key)
		const threadComment = {
			author: comment.author,
			body: comment.body,
			createdAt: comment.createdAt,
		}

		if (existing) {
			existing.metadata.comments.push(threadComment)
		} else {
			annotationsByLine.set(key, {
				lineNumber,
				metadata: { comments: [threadComment] },
				side,
			})
		}
	}

	return [...annotationsByLine.values()]
}

function getAvailableAnnotationLines(fileDiff: FileDiffMetadata) {
	const additions = new Set<number>()
	const deletions = new Set<number>()

	for (const hunk of fileDiff.hunks) {
		for (const content of hunk.hunkContent) {
			if (content.type === 'context') {
				for (let index = 0; index < content.lines; index += 1) {
					deletions.add(getDeletionLineNumber(hunk, content.deletionLineIndex, index))
					additions.add(getAdditionLineNumber(hunk, content.additionLineIndex, index))
				}
				continue
			}

			for (let index = 0; index < content.deletions; index += 1) {
				deletions.add(getDeletionLineNumber(hunk, content.deletionLineIndex, index))
			}
			for (let index = 0; index < content.additions; index += 1) {
				additions.add(getAdditionLineNumber(hunk, content.additionLineIndex, index))
			}
		}
	}

	return {
		additions,
		deletions,
	}
}

function getDeletionLineNumber(
	hunk: FileDiffMetadata['hunks'][number],
	lineIndex: number,
	offset: number,
) {
	return hunk.deletionStart + (lineIndex - hunk.deletionLineIndex) + offset
}

function getAdditionLineNumber(
	hunk: FileDiffMetadata['hunks'][number],
	lineIndex: number,
	offset: number,
) {
	return hunk.additionStart + (lineIndex - hunk.additionLineIndex) + offset
}

export function getScrollableParent(node: HTMLElement) {
	let parent = node.parentElement
	while (parent) {
		const style = window.getComputedStyle(parent)
		const canScrollY = /(auto|scroll)/.test(style.overflowY)
		if (canScrollY && parent.scrollHeight > parent.clientHeight) {
			return parent
		}
		parent = parent.parentElement
	}

	return null
}

export function getFileDiffKey(fileDiff: FileDiffMetadata) {
	return fileDiff.cacheKey ?? `${fileDiff.prevName ?? ''}->${fileDiff.name}:${fileDiff.type}`
}
