import { rename, writeFile } from 'node:fs/promises'

export async function writeJsonFileAtomically(path: string, value: unknown) {
	const temporaryPath = `${path}.tmp`
	await writeFile(temporaryPath, `${JSON.stringify(value)}\n`)
	await rename(temporaryPath, path)
}

export function pruneRecordByUpdatedAt<T extends { updatedAt: string }>(
	record: Record<string, T>,
	maxEntries: number,
) {
	const entries = Object.entries(record)
	if (entries.length <= maxEntries) return record

	return Object.fromEntries(
		entries
			.sort(([, left], [, right]) => right.updatedAt.localeCompare(left.updatedAt))
			.slice(0, maxEntries),
	) as Record<string, T>
}
