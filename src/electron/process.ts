import { spawn } from 'node:child_process'

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

		child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
		child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
		child.on('error', (error) => finish(error))
		child.on('close', (code) => {
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
