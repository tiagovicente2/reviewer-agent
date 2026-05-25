import type { ReactNode } from 'react'
import { css } from 'styled-system/css'
import { Box } from 'styled-system/jsx'

export function InfoTooltip({ children, message }: { children?: ReactNode; message: string }) {
	return (
		<Box
			display="inline-flex"
			alignItems="center"
			position="relative"
			verticalAlign="middle"
			className={css({
				_hover: { '& [data-tooltip]': { opacity: 1, visibility: 'visible' } },
			})}
		>
			<button
				type="button"
				aria-label={message}
				className={css({
					alignItems: 'center',
					borderColor: 'gray.7',
					borderRadius: 'full',
					borderWidth: '1px',
					color: 'fg.muted',
					display: 'inline-flex',
					h: '5',
					justifyContent: 'center',
					lineHeight: '1',
					p: '0',
					w: '5',
				})}
			>
				{children ?? <InfoIcon />}
			</button>
			<Box
				data-tooltip
				bg="gray.3"
				borderColor="gray.7"
				borderRadius="l2"
				borderWidth="1px"
				top="50%"
				boxShadow="lg"
				color="fg.default"
				fontSize="xs"
				left="calc(100% + 0.5rem)"
				maxW="16rem"
				opacity="0"
				p="2"
				position="absolute"
				transform="translateY(-50%)"
				transition="opacity 120ms ease"
				visibility="hidden"
				whiteSpace="normal"
				w="16rem"
				zIndex="tooltip"
			>
				{message}
			</Box>
		</Box>
	)
}

function InfoIcon() {
	return (
		<svg aria-hidden="true" fill="none" height="14" viewBox="0 0 10 10" width="14">
			<path d="M5 4.2v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
			<circle cx="5" cy="2.6" fill="currentColor" r="0.8" />
		</svg>
	)
}
