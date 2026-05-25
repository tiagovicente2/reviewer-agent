import { spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'

export type SpawnResult = {
	exitCode: number
	stdout: string
	stderr: string
}

export type SpawnBufferResult = {
	exitCode: number
	stdout: ArrayBuffer
	stderr: string
}

type SpawnOptions = {
	cwd?: string
	env?: NodeJS.ProcessEnv
	input?: string
	onStderr?: (chunk: string) => void
	onStdout?: (chunk: string) => void
	timeoutMs?: number
}

export function runCommand(command: string, args: string[], options: SpawnOptions = {}) {
	return runCommandBuffer(command, args, options).then(({ exitCode, stdout, stderr }) => ({
		exitCode,
		stdout: Buffer.from(stdout).toString('utf8'),
		stderr,
	}))
}

export function runCommandBuffer(command: string, args: string[], options: SpawnOptions = {}) {
	return new Promise<SpawnBufferResult>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: options.env,
			stdio: ['pipe', 'pipe', 'pipe'],
		})

		const stdoutChunks: Buffer[] = []
		const stderrChunks: Buffer[] = []
		const stdoutDecoder = options.onStdout ? new StringDecoder('utf8') : undefined
		const stderrDecoder = options.onStderr ? new StringDecoder('utf8') : undefined
		let timeout: NodeJS.Timeout | undefined
		let settled = false

		function finish(error?: Error, result?: SpawnBufferResult) {
			if (settled) return
			settled = true
			if (timeout) clearTimeout(timeout)
			if (error) reject(error)
			else if (result) resolve(result)
		}

		if (options.timeoutMs) {
			timeout = setTimeout(() => {
				child.kill()
				finish(new Error(`${command} timed out.`))
			}, options.timeoutMs)
		}

		child.stdout.on('data', (chunk: Buffer) => {
			stdoutChunks.push(chunk)
			if (stdoutDecoder) {
				const decoded = stdoutDecoder.write(chunk)
				if (decoded) options.onStdout?.(decoded)
			}
		})
		child.stderr.on('data', (chunk: Buffer) => {
			stderrChunks.push(chunk)
			if (stderrDecoder) {
				const decoded = stderrDecoder.write(chunk)
				if (decoded) options.onStderr?.(decoded)
			}
		})
		child.on('error', (error) => finish(error))
		child.on('close', (code) => {
			const remainingStdout = stdoutDecoder?.end()
			if (remainingStdout) options.onStdout?.(remainingStdout)
			const remainingStderr = stderrDecoder?.end()
			if (remainingStderr) options.onStderr?.(remainingStderr)
			const stdout = Buffer.concat(stdoutChunks)
			finish(undefined, {
				exitCode: code ?? 1,
				stdout: stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.byteLength),
				stderr: Buffer.concat(stderrChunks).toString('utf8'),
			})
		})

		if (options.input !== undefined) {
			child.stdin.end(options.input)
		} else {
			child.stdin.end()
		}
	})
}
