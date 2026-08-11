import { useRef } from 'react'
import { css } from 'styled-system/css'
import { resizePaneFromKey, resizePaneFromPointer } from './workspaceLayoutUtils'

type PaneLimits = {
	minWidth: number
	maxWidth: number
	step: number
}

type PaneResizeHandleProps = {
	ariaLabel: string
	controls: string
	limits: PaneLimits
	onChange: (width: number) => void
	value: number
}

type PointerResize = {
	pointerId: number
	startClientX: number
	startWidth: number
}

const resizeHandleClassName = css({
	alignSelf: 'stretch',
	cursor: 'col-resize',
	display: { base: 'none', lg: 'block' },
	minH: '8',
	outline: 'none',
	position: 'relative',
	touchAction: 'none',
	userSelect: 'none',
	w: 'full',
	zIndex: '1',
	'&::before': {
		bg: 'gray.6',
		content: '""',
		insetBlock: '0',
		left: '0',
		position: 'absolute',
		transition: 'background-color 150ms ease, box-shadow 150ms ease',
		w: '1px',
	},
	'&:hover::before': {
		bg: 'cyan.8',
	},
	'&:focus-visible::before': {
		bg: 'cyan.9',
		boxShadow: '0 0 0 2px token(colors.cyan.5)',
	},
})

export function PaneResizeHandle({
	ariaLabel,
	controls,
	limits,
	onChange,
	value,
}: PaneResizeHandleProps) {
	const pointerResize = useRef<PointerResize | null>(null)

	return (
		<>
			{/* biome-ignore lint/a11y/useSemanticElements: A focusable separator needs range and keyboard semantics. */}
			<div
				role="separator"
				aria-label={ariaLabel}
				aria-controls={controls}
				aria-orientation="vertical"
				aria-valuemin={limits.minWidth}
				aria-valuemax={limits.maxWidth}
				aria-valuenow={value}
				className={resizeHandleClassName}
				onKeyDown={(event) => {
					if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
					event.preventDefault()
					onChange(resizePaneFromKey(value, event.key, limits))
				}}
				onLostPointerCapture={() => {
					pointerResize.current = null
				}}
				onPointerCancel={(event) => {
					if (pointerResize.current?.pointerId !== event.pointerId) return
					pointerResize.current = null
					if (event.currentTarget.hasPointerCapture(event.pointerId)) {
						event.currentTarget.releasePointerCapture(event.pointerId)
					}
				}}
				onPointerDown={(event) => {
					pointerResize.current = {
						pointerId: event.pointerId,
						startClientX: event.clientX,
						startWidth: value,
					}
					event.currentTarget.setPointerCapture(event.pointerId)
					event.preventDefault()
				}}
				onPointerMove={(event) => {
					const resize = pointerResize.current
					if (!resize || resize.pointerId !== event.pointerId) return
					onChange(
						resizePaneFromPointer(
							resize.startWidth,
							resize.startClientX,
							event.clientX,
							limits.minWidth,
							limits.maxWidth,
						),
					)
				}}
				onPointerUp={(event) => {
					if (pointerResize.current?.pointerId !== event.pointerId) return
					pointerResize.current = null
					if (event.currentTarget.hasPointerCapture(event.pointerId)) {
						event.currentTarget.releasePointerCapture(event.pointerId)
					}
				}}
				tabIndex={0}
			/>
		</>
	)
}
