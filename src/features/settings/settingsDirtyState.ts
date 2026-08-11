import type { AppSettings, ReviewerInstruction } from '@/shared/settings'

function instructionsEqual(left: ReviewerInstruction[], right: ReviewerInstruction[]) {
	return (
		left.length === right.length &&
		left.every((instruction, index) => {
			const other = right[index]
			return (
				other !== undefined &&
				instruction.id === other.id &&
				instruction.name === other.name &&
				instruction.content === other.content
			)
		})
	)
}

export function hasUnsavedSettings(current: AppSettings | null, persisted: AppSettings | null) {
	if (!current || !persisted) return false

	return (
		current.colorMode !== persisted.colorMode ||
		current.codeAgent !== persisted.codeAgent ||
		current.model !== persisted.model ||
		current.reviewLanguage !== persisted.reviewLanguage ||
		current.reviewExportDirectory !== persisted.reviewExportDirectory ||
		!instructionsEqual(current.reviewerInstructions, persisted.reviewerInstructions)
	)
}
