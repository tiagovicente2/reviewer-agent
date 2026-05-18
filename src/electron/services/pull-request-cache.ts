import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { GitHubPullRequestDetails } from '@/shared/github'

type DetailsEntry = {
	repo: string
	pullRequestNumber: number
	headSha: string
	details: GitHubPullRequestDetails
	createdAt: string
	updatedAt: string
}

type DiffEntry = {
	repo: string
	pullRequestNumber: number
	headSha: string
	diff: string
	createdAt: string
	updatedAt: string
}

type PullRequestCache = {
	details: Record<string, DetailsEntry>
	diffs: Record<string, DiffEntry>
}

const cachePath = getCachePath()
mkdirSync(dirname(cachePath), { recursive: true })

export function getCachedPullRequestDetails(params: {
	repo: string
	pullRequestNumber: number
	headSha?: string
}): GitHubPullRequestDetails | null {
	const cache = readCache()
	if (params.headSha) {
		return (
			cache.details[getPullRequestCacheKey({ ...params, headSha: params.headSha })]?.details ?? null
		)
	}

	const entries = Object.values(cache.details)
		.filter(
			(entry) => entry.repo === params.repo && entry.pullRequestNumber === params.pullRequestNumber,
		)
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
	return entries[0]?.details ?? null
}

export function saveCachedPullRequestDetails(details: GitHubPullRequestDetails) {
	const cache = readCache()
	const metadata = { ...details, diff: '' }
	const now = new Date().toISOString()
	const id = getPullRequestCacheKey(details)
	cache.details[id] = {
		repo: details.repo,
		pullRequestNumber: details.pullRequestNumber,
		headSha: details.headSha,
		details: metadata,
		createdAt: cache.details[id]?.createdAt ?? now,
		updatedAt: now,
	}
	writeCache(cache)
}

export function getCachedPullRequestDiff(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
}): string | null {
	return readCache().diffs[getPullRequestCacheKey(params)]?.diff ?? null
}

export function saveCachedPullRequestDiff(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
	diff: string
}) {
	const cache = readCache()
	const now = new Date().toISOString()
	const id = getPullRequestCacheKey(params)
	cache.diffs[id] = {
		repo: params.repo,
		pullRequestNumber: params.pullRequestNumber,
		headSha: params.headSha,
		diff: params.diff,
		createdAt: cache.diffs[id]?.createdAt ?? now,
		updatedAt: now,
	}
	writeCache(cache)
}

function readCache(): PullRequestCache {
	try {
		if (!existsSync(cachePath)) return { details: {}, diffs: {} }
		const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as Partial<PullRequestCache>
		return { details: cache.details ?? {}, diffs: cache.diffs ?? {} }
	} catch {
		return { details: {}, diffs: {} }
	}
}

function writeCache(cache: PullRequestCache) {
	writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`)
}

function getPullRequestCacheKey(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
}) {
	return `${params.repo}#${params.pullRequestNumber}:${params.headSha}`
}

function getCachePath() {
	const baseDir =
		process.env.XDG_DATA_HOME ??
		(process.env.HOME ? join(process.env.HOME, '.local', 'share') : join(process.cwd(), '.data'))
	return join(baseDir, 'pr-review-agent', 'pull-request-cache.json')
}
