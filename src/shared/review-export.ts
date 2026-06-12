import type { GitHubPullRequestDetails } from './github'
import type { GeneratedReview } from './review'

export type ExportReviewParams = {
	pullRequest: GitHubPullRequestDetails
	review: GeneratedReview
}

export type ExportReviewResult = {
	filePath: string
}

export function formatReviewForExport({ pullRequest, review }: ExportReviewParams) {
	const findings = review.findings.length
		? review.findings
				.map((finding, index) => {
					const location = finding.lineStart
						? `${finding.filePath}:${finding.lineStart}${finding.lineEnd ? `-${finding.lineEnd}` : ''}`
						: finding.filePath
					const comment = finding.suggestedCommentBody || finding.body
					return [
						`### ${index + 1}. ${finding.title}`,
						`- Severity: ${finding.severity}`,
						`- Location: ${location}`,
						`- Confidence: ${Math.round(finding.confidence * 100)}%`,
						'',
						finding.body,
						comment && comment !== finding.body
							? ['', '**Suggested comment**', '', comment].join('\n')
							: '',
						finding.fixSuggestion
							? ['', '**Fix suggestion**', '', finding.fixSuggestion].join('\n')
							: '',
					]
						.filter(Boolean)
						.join('\n')
				})
				.join('\n\n')
		: 'No findings.'

	return [
		`# Review export: ${pullRequest.repo}#${pullRequest.pullRequestNumber}`,
		'',
		`- PR: ${pullRequest.title}`,
		`- URL: ${pullRequest.url}`,
		`- Head: ${pullRequest.headRefName} (${pullRequest.headSha.slice(0, 7)})`,
		`- Base: ${pullRequest.baseRefName}`,
		`- Model: ${review.modelLabel}`,
		`- Generated: ${review.generatedAt}`,
		`- Verdict: ${review.verdictRecommendation}`,
		`- Severity: ${review.severity}`,
		review.diffWasTruncated ? '- Diff: truncated before review generation' : '',
		'',
		'## Summary',
		'',
		review.summary,
		'',
		'## Publishable body',
		'',
		review.publishableBody || review.summary,
		'',
		'## Findings',
		'',
		findings,
	]
		.filter((part) => part !== '')
		.join('\n')
		.concat('\n')
}

export function getReviewExportFileName(
	pullRequest: GitHubPullRequestDetails,
	review: GeneratedReview,
) {
	const repo = pullRequest.repo.replace(/[^\w.-]+/g, '-')
	const generatedAt = review.generatedAt.replace(/[:.]/g, '-')
	return `${repo}-pr-${pullRequest.pullRequestNumber}-${generatedAt}.md`
}
