export function normalizeVersion(version: string) {
	return version.trim().replace(/^v/i, '')
}

export function compareVersions(left: string, right: string) {
	const leftParts = normalizeVersion(left).split('.').map(toNumber)
	const rightParts = normalizeVersion(right).split('.').map(toNumber)
	const length = Math.max(leftParts.length, rightParts.length)

	for (let index = 0; index < length; index += 1) {
		const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
		if (difference !== 0) return difference
	}

	return 0
}

function toNumber(part: string) {
	const value = Number.parseInt(part, 10)
	return Number.isFinite(value) ? value : 0
}
