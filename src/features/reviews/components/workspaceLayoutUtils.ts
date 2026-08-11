export const inboxPane = { defaultWidth: 384, minWidth: 240, maxWidth: 384, step: 16 } as const
export const filesPane = { defaultWidth: 224, minWidth: 176, maxWidth: 320, step: 16 } as const

export function clampPaneWidth(width: number, minWidth: number, maxWidth: number) {
	return Math.min(maxWidth, Math.max(minWidth, width))
}

export function resizePaneFromPointer(
	startWidth: number,
	startClientX: number,
	clientX: number,
	minWidth: number,
	maxWidth: number,
) {
	return clampPaneWidth(startWidth + clientX - startClientX, minWidth, maxWidth)
}

export function resizePaneFromKey(
	width: number,
	key: string,
	{ minWidth, maxWidth, step }: { minWidth: number; maxWidth: number; step: number },
) {
	if (key === 'Home') return minWidth
	if (key === 'End') return maxWidth
	if (key === 'ArrowLeft') return clampPaneWidth(width - step, minWidth, maxWidth)
	if (key === 'ArrowRight') return clampPaneWidth(width + step, minWidth, maxWidth)
	return width
}
