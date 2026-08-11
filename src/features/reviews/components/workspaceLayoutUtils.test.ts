import { describe, expect, it } from 'vitest'
import {
	clampPaneWidth,
	filesPane,
	inboxPane,
	resizePaneFromKey,
	resizePaneFromPointer,
} from './workspaceLayoutUtils'

describe('clampPaneWidth', () => {
	it('clamps widths at both limits and preserves widths inside them', () => {
		expect(clampPaneWidth(200, inboxPane.minWidth, inboxPane.maxWidth)).toBe(240)
		expect(clampPaneWidth(320, inboxPane.minWidth, inboxPane.maxWidth)).toBe(320)
		expect(clampPaneWidth(420, inboxPane.minWidth, inboxPane.maxWidth)).toBe(384)
	})
})

describe('resizePaneFromPointer', () => {
	it('applies pointer deltas in both directions', () => {
		expect(resizePaneFromPointer(288, 500, 548, inboxPane.minWidth, inboxPane.maxWidth)).toBe(336)
		expect(resizePaneFromPointer(288, 500, 468, inboxPane.minWidth, inboxPane.maxWidth)).toBe(256)
	})

	it('clamps pointer updates at both limits', () => {
		expect(resizePaneFromPointer(288, 500, 300, inboxPane.minWidth, inboxPane.maxWidth)).toBe(240)
		expect(resizePaneFromPointer(288, 500, 700, inboxPane.minWidth, inboxPane.maxWidth)).toBe(384)
	})
})

describe('resizePaneFromKey', () => {
	it('moves left and right by the configured 16 pixel step', () => {
		expect(resizePaneFromKey(filesPane.defaultWidth, 'ArrowLeft', filesPane)).toBe(208)
		expect(resizePaneFromKey(filesPane.defaultWidth, 'ArrowRight', filesPane)).toBe(240)
	})

	it('clamps arrow updates at both limits', () => {
		expect(resizePaneFromKey(filesPane.minWidth, 'ArrowLeft', filesPane)).toBe(filesPane.minWidth)
		expect(resizePaneFromKey(filesPane.maxWidth, 'ArrowRight', filesPane)).toBe(filesPane.maxWidth)
	})

	it('moves to the minimum with Home and the maximum with End', () => {
		expect(resizePaneFromKey(filesPane.defaultWidth, 'Home', filesPane)).toBe(filesPane.minWidth)
		expect(resizePaneFromKey(filesPane.defaultWidth, 'End', filesPane)).toBe(filesPane.maxWidth)
	})

	it('leaves the width unchanged for unrelated keys', () => {
		expect(resizePaneFromKey(filesPane.defaultWidth, 'Enter', filesPane)).toBe(
			filesPane.defaultWidth,
		)
	})
})
