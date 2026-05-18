import { mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { GitHubPullRequestDetails } from '@/shared/github'
import { getUserDataPath } from '../paths'

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

const cachePath = join(getUserDataPath(), 'pull-request-cache.json')
mkdirSync(dirname(cachePath), { recursive: true })

const cache = loadCache()
let writeQueued = false

export function getCachedPullRequestDetails(params: {
	repo: string
	pullRequestNumber: number
	headSha?: string
}): GitHubPullRequestDetails | null {
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
	queueWriteCache()
}

export function getCachedPullRequestDiff(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
}): string | null {
	return cache.diffs[getPullRequestCacheKey(params)]?.diff ?? null
}

export function saveCachedPullRequestDiff(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
	diff: string
}) {
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
	queueWriteCache()
}

function loadCache(): PullRequestCache {
	try {
		const persisted = JSON.parse(readFileSync(cachePath, 'utf8')) as Partial<PullRequestCache>
		return { details: persisted.details ?? {}, diffs: persisted.diffs ?? {} }
	} catch {
		return { details: {}, diffs: {} }
	}
}

function queueWriteCache() {
	if (writeQueued) return
	writeQueued = true
	queueMicrotask(() => {
		writeQueued = false
		void writeFile(cachePath, JSON.stringify(cache)).catch((error: unknown) => {
			console.error('Could not persist pull request cache.', error)
		})
	})
}

function getPullRequestCacheKey(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
}) {
	return `${params.repo}#${params.pullRequestNumber}:${params.headSha}`
}
