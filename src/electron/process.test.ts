import { describe, expect, it } from 'vitest'
import { runCommand } from './process'

describe('process streaming', () => {
	it('decodes streamed UTF-8 split across chunks', async () => {
		const chunks: string[] = []
		const script = [
			'const value = Buffer.from("a😀b")',
			'process.stdout.write(value.subarray(0, 3))',
			'setTimeout(() => process.stdout.write(value.subarray(3)), 0)',
		].join(';')

		const result = await runCommand(process.execPath, ['-e', script], {
			onStdout: (chunk) => chunks.push(chunk),
		})

		expect(result.stdout).toBe('a😀b')
		expect(chunks.join('')).toBe('a😀b')
		expect(chunks.join('')).not.toContain('�')
	})
})
