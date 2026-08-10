import { useCallback, useState } from 'react'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { GeneratedReview } from '@/shared/review'
import { formatReviewForExport } from '@/shared/review-export'

export function useReviewExport({
	detail,
	generatedReview,
}: {
	detail: GitHubPullRequestDetails | null
	generatedReview: GeneratedReview | null
}) {
	const [exportState, setExportState] = useState<AsyncState>('idle')
	const [exportError, setExportError] = useState('')
	const { showToast } = useToast()

	const copyReviewToClipboard = useCallback(async () => {
		if (!detail || !generatedReview) return
		setExportState('loading')
		setExportError('')
		try {
			await navigator.clipboard.writeText(
				formatReviewForExport({ pullRequest: detail, review: generatedReview }),
			)
			setExportState('idle')
			showToast({ title: 'Review copied', tone: 'success' })
		} catch (unknownError) {
			setExportError(getErrorMessage(unknownError))
			setExportState('error')
		}
	}, [detail, generatedReview, showToast])

	const saveReviewToFile = useCallback(async () => {
		if (!detail || !generatedReview) return
		setExportState('loading')
		setExportError('')
		try {
			const result = await appRpc.request.exportReviewToFile({
				pullRequest: detail,
				review: generatedReview,
			})
			setExportState('idle')
			showToast({ title: 'Review exported', description: result.filePath, tone: 'success' })
		} catch (unknownError) {
			setExportError(getErrorMessage(unknownError))
			setExportState('error')
		}
	}, [detail, generatedReview, showToast])

	return { copyReviewToClipboard, exportError, exportState, saveReviewToFile }
}
