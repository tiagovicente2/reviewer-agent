import { describe, expect, it } from 'vitest'
import { getExpectedChecksum, getUpdateArtifactName } from './update-integrity'

describe('update integrity', () => {
	it('selects only release artifacts that are actually published', () => {
		expect(getUpdateArtifactName('linux', 'x64')).toBe('reviewer-agent-linux-x64.tar.gz')
		expect(getUpdateArtifactName('darwin', 'arm64')).toBe('reviewer-agent-macos-arm64.tar.gz')
		expect(getUpdateArtifactName('win32', 'x64')).toBe('reviewer-agent-windows-x64.zip')
		expect(getUpdateArtifactName('linux', 'arm64')).toBeNull()
	})

	it('requires an exact artifact name with a valid SHA-256 digest', () => {
		const checksum = 'A'.repeat(64)
		const manifest = `${checksum}  reviewer-agent-linux-x64.tar.gz.backup\n${checksum}  reviewer-agent-linux-x64.tar.gz`

		expect(getExpectedChecksum(manifest, 'reviewer-agent-linux-x64.tar.gz')).toBe(
			checksum.toLowerCase(),
		)
		expect(
			getExpectedChecksum(
				'not-a-checksum  reviewer-agent-linux-x64.tar.gz',
				'reviewer-agent-linux-x64.tar.gz',
			),
		).toBeNull()
		expect(getExpectedChecksum(manifest, 'missing.tar.gz')).toBeNull()
	})
})
