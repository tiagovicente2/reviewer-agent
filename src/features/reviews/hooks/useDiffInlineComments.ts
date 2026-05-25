import { useMemo } from 'react'
import type { GeneratedReview } from '@/shared/review'

function getCommentIdentity(path: string, side: string, body: string) {
	return `${path}:${side}:${body.trim()}`
}

export function useDiffInlineComments(generatedReview: GeneratedReview | null) {
	return useMemo(() => {
		if (!generatedReview) return []

		const comments = [...generatedReview.inlineComments]
		const existingCommentIndexes = new Map(
			comments.map((comment, index) => [
				getCommentIdentity(comment.path, comment.side, comment.body),
				index,
			]),
		)

		for (const finding of generatedReview.findings) {
			const body = finding.suggestedCommentBody?.trim()
			if (!finding.filePath || !finding.lineStart || !body) continue

			const key = getCommentIdentity(finding.filePath, 'RIGHT', body)
			const existingIndex = existingCommentIndexes.get(key)
			if (existingIndex !== undefined) {
				comments[existingIndex] = {
					...comments[existingIndex],
					body,
					line: finding.lineStart,
				}
				continue
			}

			existingCommentIndexes.set(key, comments.length)
			comments.push({
				body,
				line: finding.lineStart,
				path: finding.filePath,
				side: 'RIGHT',
			})
		}

		return comments
	}, [generatedReview])
}
