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
	maxBufferBytes?: number
	onStderr?: (chunk: string) => void
	onStdout?: (chunk: string) => void
	timeoutMs?: number
}

const DEFAULT_MAX_BUFFER_BYTES = 25 * 1024 * 1024
const KILL_GRACE_MS = 1500

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
			detached: process.platform !== 'win32',
			env: options.env,
			stdio: ['pipe', 'pipe', 'pipe'],
		})

		const stdoutChunks: Buffer[] = []
		const stderrChunks: Buffer[] = []
		const stdoutDecoder = options.onStdout ? new StringDecoder('utf8') : undefined
		const stderrDecoder = options.onStderr ? new StringDecoder('utf8') : undefined
		const maxBufferBytes = options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES
		let capturedBytes = 0
		let timeout: NodeJS.Timeout | undefined
		let forceKillTimeout: NodeJS.Timeout | undefined
		let settled = false

		function finish(error?: Error, result?: SpawnBufferResult) {
			if (settled) return
			settled = true
			if (timeout) clearTimeout(timeout)
			if (forceKillTimeout) clearTimeout(forceKillTimeout)
			if (error) reject(error)
			else if (result) resolve(result)
		}

		if (options.timeoutMs) {
			timeout = setTimeout(() => {
				terminateChild(child, 'SIGTERM')
				forceKillTimeout = setTimeout(() => terminateChild(child, 'SIGKILL'), KILL_GRACE_MS)
				finish(new Error(`${command} timed out.`))
			}, options.timeoutMs)
		}

		child.stdout.on('data', (chunk: Buffer) => {
			capturedBytes += chunk.byteLength
			if (capturedBytes > maxBufferBytes) {
				terminateChild(child, 'SIGTERM')
				finish(new Error(`${command} exceeded output buffer limit.`))
				return
			}
			stdoutChunks.push(chunk)
			if (stdoutDecoder) {
				const decoded = stdoutDecoder.write(chunk)
				if (decoded) options.onStdout?.(decoded)
			}
		})
		child.stderr.on('data', (chunk: Buffer) => {
			capturedBytes += chunk.byteLength
			if (capturedBytes > maxBufferBytes) {
				terminateChild(child, 'SIGTERM')
				finish(new Error(`${command} exceeded output buffer limit.`))
				return
			}
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

function terminateChild(child: ReturnType<typeof spawn>, signal: NodeJS.Signals) {
	try {
		if (process.platform !== 'win32' && child.pid) {
			process.kill(-child.pid, signal)
			return
		}
		child.kill(signal)
	} catch {
		// Process already exited.
	}
}
