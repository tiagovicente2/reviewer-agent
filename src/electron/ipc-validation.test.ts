import { describe, expect, it } from 'vitest'
import { validateMainRequest } from './ipc-validation'

describe('ipc-validation', () => {
	it('validates restartApp request', () => {
		expect(() => validateMainRequest('restartApp', undefined)).not.toThrow()
		expect(() => validateMainRequest('restartApp', { invalid: true } as never)).toThrow()
	})

	it('validates installUpdate and getUpdateStatus requests', () => {
		expect(() => validateMainRequest('installUpdate', undefined)).not.toThrow()
		expect(() => validateMainRequest('installUpdate', 'bad' as never)).toThrow()
		expect(() => validateMainRequest('getUpdateStatus', undefined)).not.toThrow()
		expect(() => validateMainRequest('getUpdateStatus', 123 as never)).toThrow()
	})
})
