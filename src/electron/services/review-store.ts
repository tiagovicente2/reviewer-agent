import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { PiGeneratedReview } from '@/shared/review'
import { getLegacyDataDir, getUserDataPath } from '../paths'

type StoredReview = {
	repo: string
	pullRequestNumber: number
	headSha: string
	review: PiGeneratedReview
	createdAt: string
	updatedAt: string
}

type LegacyReviewRow = {
	repo: string
	pr_number: number
	head_sha: string
	review_json: string
	created_at: string
	updated_at: string
}

const storePath = join(getUserDataPath(), 'generated-reviews.json')
mkdirSync(getUserDataPath(), { recursive: true })

const store = loadStore()
let writeQueued = false

export function saveGeneratedReview(params: {
	pullRequest: GitHubPullRequestDetails
	review: PiGeneratedReview
}): PiGeneratedReview {
	const id = getReviewStoreKey(params.pullRequest)
	const now = new Date().toISOString()
	store[id] = {
		repo: params.pullRequest.repo,
		pullRequestNumber: params.pullRequest.pullRequestNumber,
		headSha: params.pullRequest.headSha,
		review: params.review,
		createdAt: store[id]?.createdAt ?? now,
		updatedAt: now,
	}
	queueWriteStore()
	return params.review
}

export function getSavedGeneratedReview(params: {
	repo: string
	pullRequestNumber: number
	headSha: string
}): PiGeneratedReview | null {
	return store[getReviewStoreKey(params)]?.review ?? null
}

function loadStore(): Record<string, StoredReview> {
	try {
		return JSON.parse(readFileSync(storePath, 'utf8')) as Record<string, StoredReview>
	} catch {
		const migratedStore = migrateLegacyReviews()
		if (Object.keys(migratedStore).length > 0) {
			void writeFile(storePath, JSON.stringify(migratedStore)).catch((error: unknown) => {
				console.error('Could not persist migrated generated reviews.', error)
			})
		}
		return migratedStore
	}
}

function migrateLegacyReviews(): Record<string, StoredReview> {
	const legacyDatabasePath = join(getLegacyDataDir(), 'review-agent.sqlite')
	if (!existsSync(legacyDatabasePath)) return {}

	const result = spawnSync(
		'sqlite3',
		[
			'-json',
			legacyDatabasePath,
			'SELECT repo, pr_number, head_sha, review_json, created_at, updated_at FROM generated_reviews;',
		],
		{ encoding: 'utf8' },
	)

	if (result.status !== 0 || !result.stdout.trim()) {
		return {}
	}

	try {
		const rows = JSON.parse(result.stdout) as LegacyReviewRow[]
		return rows.reduce<Record<string, StoredReview>>((nextStore, row) => {
			const review = JSON.parse(row.review_json) as PiGeneratedReview
			const entry = {
				repo: row.repo,
				pullRequestNumber: row.pr_number,
				headSha: row.head_sha,
				review,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			}
			nextStore[getReviewStoreKey(entry)] = entry
			return nextStore
		}, {})
	} catch (error) {
		console.error('Could not migrate legacy generated reviews.', error)
		return {}
	}
}

function queueWriteStore() {
	if (writeQueued) return
	writeQueued = true
	queueMicrotask(() => {
		writeQueued = false
		void writeFile(storePath, JSON.stringify(store)).catch((error: unknown) => {
			console.error('Could not persist generated reviews.', error)
		})
	})
}

function getReviewStoreKey(params: { repo: string; pullRequestNumber: number; headSha: string }) {
	return `${params.repo}#${params.pullRequestNumber}:${params.headSha}`
}
