import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs/direct/types.js'
import type { PiInlineComment } from '@/shared/review'

export type DiffAnnotation = {
	body: string
}

export function groupInlineCommentsByPath(inlineComments: PiInlineComment[]) {
	const commentsByPath = new Map<string, PiInlineComment[]>()
	for (const comment of inlineComments) {
		commentsByPath.set(comment.path, [...(commentsByPath.get(comment.path) ?? []), comment])
	}
	return commentsByPath
}

export function getLineAnnotations(
	fileDiff: FileDiffMetadata,
	inlineCommentsByPath: Map<string, PiInlineComment[]>,
): DiffLineAnnotation<DiffAnnotation>[] {
	return [
		...(inlineCommentsByPath.get(fileDiff.name) ?? []),
		...(fileDiff.prevName ? (inlineCommentsByPath.get(fileDiff.prevName) ?? []) : []),
	].map((comment) => ({
		lineNumber: comment.line,
		metadata: {
			body: comment.body,
		},
		side: comment.side === 'LEFT' ? 'deletions' : 'additions',
	}))
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
