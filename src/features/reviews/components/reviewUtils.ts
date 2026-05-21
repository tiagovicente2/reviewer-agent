import type { ReviewSeverity } from '@/shared/review'

export function severityColorPalette(severity: ReviewSeverity): 'cyan' | 'gray' | 'red' {
	if (severity === 'critical' || severity === 'high') return 'red'
	if (severity === 'medium') return 'cyan'
	return 'gray'
}

export function stripMarkdownFence(value: string) {
	return value
		.replace(/^```(?:diff|patch)?\n/i, '')
		.replace(/\n```$/i, '')
		.trim()
}

export function diffLineColor(line: string) {
	if (line.startsWith('+') && !line.startsWith('+++')) return 'review.blue'
	if (line.startsWith('-') && !line.startsWith('---')) return 'red.11'
	if (line.startsWith('@@')) return 'cyan.11'
	return 'fg.muted'
}
