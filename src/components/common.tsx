import type { ReactNode } from 'react'
import { css } from 'styled-system/css'
import { Box } from 'styled-system/jsx'

export function StatusCard({
	body,
	title,
	tone = 'gray',
}: {
	body: string
	title: string
	tone?: 'gray' | 'red'
}) {
	return (
		<Box bg={tone === 'red' ? 'red.subtle.bg' : 'gray.2'} borderRadius="l2" p="4">
			<Box color={tone === 'red' ? 'red.11' : 'fg.default'} fontWeight="semibold">
				{title}
			</Box>
			<Box color={tone === 'red' ? 'red.11' : 'fg.muted'} mt="1" textStyle="sm">
				{body}
			</Box>
		</Box>
	)
}

export function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean
	onClick: () => void
	children: ReactNode
}) {
	return (
		<Box
			as="button"
			onClick={onClick}
			className={css({
				paddingX: '3',
				paddingY: '1.5',
				borderRadius: 's',
				fontSize: 'sm',
				fontWeight: 'medium',
				transition: 'all 150ms ease',
				cursor: 'pointer',
				backgroundColor: active ? 'gray.1' : 'transparent',
				color: active ? 'fg.default' : 'fg.muted',
				border: 'none',
				_hover: {
					backgroundColor: active ? 'gray.2' : 'gray.3',
					color: 'fg.default',
				},
			})}
		>
			{children}
		</Box>
	)
}

export function Code({ children }: { children: string }) {
	return (
		<Box as="code" bg="gray.3" borderRadius="l1" color="fg.default" px="1.5" py="0.5">
			{children}
		</Box>
	)
}
