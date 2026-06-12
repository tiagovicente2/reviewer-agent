import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	type ExportReviewParams,
	type ExportReviewResult,
	formatReviewForExport,
	getReviewExportFileName,
} from '@/shared/review-export'
import { getAppSettings } from './settings'

export function exportReviewToFile(params: ExportReviewParams): ExportReviewResult {
	const directory = getAppSettings().reviewExportDirectory.trim()
	if (!directory) throw new Error('Set a review export directory in Settings first.')

	mkdirSync(directory, { recursive: true })
	const filePath = join(directory, getReviewExportFileName(params.pullRequest, params.review))
	writeFileSync(filePath, formatReviewForExport(params), 'utf8')
	return { filePath }
}
