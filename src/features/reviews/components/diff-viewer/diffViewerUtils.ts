import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs/direct/types.js'
import type { PiInlineComment } from '@/shared/review'

export type DiffAnnotation = {
	comments: Array<{
		author?: string
		body: string
		createdAt?: string
	}>
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
	const annotationsByLine = new Map<string, DiffLineAnnotation<DiffAnnotation>>()
	const comments = [
		...(inlineCommentsByPath.get(fileDiff.name) ?? []),
		...(fileDiff.prevName ? (inlineCommentsByPath.get(fileDiff.prevName) ?? []) : []),
	]

	for (const comment of comments) {
		const side = comment.side === 'LEFT' ? 'deletions' : 'additions'
		const key = `${side}:${comment.line}`
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
				lineNumber: comment.line,
				metadata: { comments: [threadComment] },
				side,
			})
		}
	}

	return [...annotationsByLine.values()]
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
