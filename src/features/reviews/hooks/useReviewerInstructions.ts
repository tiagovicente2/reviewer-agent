import { useEffect, useState } from 'react'
import { appRpc } from '@/app/rpc'
import type { ReviewerInstruction } from '@/shared/settings'

export function useReviewerInstructions() {
	const [instructions, setInstructions] = useState<ReviewerInstruction[]>([])
	const [selectedInstructionId, setSelectedInstructionId] = useState('')

	useEffect(() => {
		let cancelled = false
		appRpc.request
			.getAppSettings()
			.then((settings) => {
				if (cancelled) return
				setInstructions(settings.reviewerInstructions)
				setSelectedInstructionId(
					(current) =>
						settings.reviewerInstructions.find((instruction) => instruction.id === current)?.id ??
						settings.reviewerInstructions[0]?.id ??
						'',
				)
			})
			.catch(Object)
		return () => {
			cancelled = true
		}
	}, [])

	return { instructions, selectedInstructionId, setSelectedInstructionId }
}
