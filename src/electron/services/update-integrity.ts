export function getUpdateArtifactName(platform: NodeJS.Platform, architecture: string) {
	if (platform === 'win32' && architecture === 'x64') {
		return 'reviewer-agent-windows-x64.zip'
	}
	if (platform === 'linux' && architecture === 'x64') {
		return 'reviewer-agent-linux-x64.tar.gz'
	}
	if (platform === 'darwin' && architecture === 'arm64') {
		return 'reviewer-agent-macos-arm64.tar.gz'
	}
	return null
}

export function getExpectedChecksum(manifest: string, artifactName: string) {
	for (const line of manifest.split(/\r?\n/)) {
		const match = line.trim().match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/)
		if (match?.[2] === artifactName) return match[1]?.toLowerCase() ?? null
	}
	return null
}
