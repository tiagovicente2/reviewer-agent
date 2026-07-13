import type { ReviewSeverity } from '@/shared/review'

export function severityColorPalette(severity: ReviewSeverity): 'cyan' | 'gray' | 'red' {
	if (severity === 'critical' || severity === 'high') return 'red'
	if (severity === 'medium') return 'cyan'
	return 'gray'
}
